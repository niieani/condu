import fs from "fs/promises";
import path from "path";
import { ensureDependency, getManifest } from "./toolchain.js";

export type FileDef = {
  path: string;
  content: string;
};

export interface Task {
  // e.g. 'test:lint'
  name: string;
  // what is this task for? are we testing something, building, etc.
  type: "test" | "build" | "execute" | "publish";

  // potentially add something like "after" or "before" to ensure order
}

export type State = {
  // these files will be created during execution
  files: readonly FileDef[];
  // we'll ensure these dependencies are installed during execution
  devDependencies: readonly string[];

  tasks: readonly Task[];
};

export type FinalState = {
  files: FileDef[];
  devDependencies: string[];
  tasks: Task[];
};

export type FeatureActionFn = (
  config: RepoConfig,
  state: State,
) => Partial<State>;

export interface RepoConfig {
  engine: "node@20" | "node@latest" | "bun@latest";
  monorepo?: boolean;
  features: readonly FeatureActionFn[];
}

type FeatureDefinition<Name extends string> = {
  name: Name;
  actionFn: FeatureActionFn;
  /** set the order execution */
  order?: {
    after?: string[];
    priority?: "beginning" | "end";
  };
};

export const defineFeature = <Name extends string>({
  actionFn,
  ...config
}: FeatureDefinition<Name>) => Object.assign(actionFn, config);

export function collectState(config: RepoConfig): State {
  const state: FinalState = {
    files: [],
    devDependencies: [],
    tasks: [],
  };

  // TODO: sort features by `order` config

  for (const feature of config.features) {
    const featureState = feature(config, state);
    if (featureState.files) {
      state.files.push(...featureState.files);
    }
    if (featureState.tasks) {
      state.tasks.push(...featureState.tasks);
    }
    if (featureState.devDependencies) {
      state.devDependencies.push(...featureState.devDependencies);
    }
  }

  // TODO: store file list, tasks and dependencies in a git-committed file, so that any removals/upgrades can be flagged as changes during diffing
  // e.g. .config/toolchain/.files
  // e.g. .config/toolchain/.dependencies // automatically updated when doing 'yarn add' so that it's compatible with dep. auto-updaters
  // TODO: also store version of each feature, so that we can detect if a feature has been upgraded

  return state;
}

export function writeFiles(files: readonly FileDef[], rootDir: string) {
  return Promise.allSettled(
    files.map((file) =>
      // TODO: add logging
      // TODO: add manual diffing with confirmation that change is ok
      fs.writeFile(path.join(rootDir, file.path), file.content),
    ),
  );
}

export async function evaluate(config: RepoConfig) {
  const collectedState = collectState(config);
  // TODO:
  const rootDir = process.cwd();

  await writeFiles(collectedState.files, rootDir);

  const { manifest, writeProjectManifest } = await getManifest(rootDir);

  let didChangeManifest = false;
  for (const packageName of collectedState.devDependencies) {
    // TODO parallelize?
    didChangeManifest ||= await ensureDependency({
      packageName,
      manifest,
      target: "devDependencies",
    });
  }

  if (didChangeManifest) {
    await writeProjectManifest(manifest);
  }
}
