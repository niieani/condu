import fs from "fs/promises";
import path from "path";
import { ensureDependency, getManifest } from "./toolchain.js";
import { CORE_NAME } from "./constants.js";
import * as t from "../core/utils/io-ts/io-ts.js";
import {
  RepoConfig,
  State,
  FinalState,
  FileDef,
  CONFIGURED,
  ConfiguredRepoConfig,
  RepoConfigWithInferredValues,
} from "../core/configTypes.js";

export async function collectState(
  config: RepoConfigWithInferredValues,
): Promise<State> {
  const state: FinalState = {
    files: [],
    devDependencies: [],
    tasks: [],
  };

  // TODO: sort features by `order` config

  for (const feature of config.features) {
    // const featureConfig = feature.order;
    const featureState = await feature.actionFn(config, state);
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
      typeof file.content === "string"
        ? fs.writeFile(path.join(rootDir, file.path), file.content)
        : Promise.resolve(),
    ),
  );
}

export async function apply({
  startDir = process.cwd(),
}: {
  startDir?: string;
} = {}) {
  const { manifest, writeProjectManifest, projectDir } = await getManifest(
    startDir,
  );
  const configFile = path.join(projectDir, `.config`, `${CORE_NAME}.ts`);
  const importedConfigFile = await import(configFile).catch((error) => {
    console.error(
      `Unable to load the ${CORE_NAME} config file:\n${error.message}`,
    );
  });

  const config: ConfiguredRepoConfig | undefined = importedConfigFile?.default;

  if (!config || typeof config !== "object" || !(CONFIGURED in config)) {
    console.error(
      `Invalid configuration file. Make sure to use the configure option`,
    );
    return;
  }

  // TODO: migrate to https://github.com/Effect-TS/schema
  // const config = t.decodeOrThrow(
  //   RepoConfigValidator,
  //   importedConfigFile.default,
  //   `Errors in config file`,
  // );

  const collectedState = await collectState({
    ...config,
    manifest,
    workspaceDir: projectDir,
  });
  await writeFiles(collectedState.files, projectDir);

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
