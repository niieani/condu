import fs from "fs/promises";
import path from "path";
import { ensureDependency } from "./toolchain.js";
import {
  RepoConfig,
  State,
  FinalState,
  FileDef,
  RepoConfigWithInferredValues,
} from "../core/configTypes.js";
import { groupBy, equals, sort } from "remeda";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import { LoadConfigOptions, loadProject } from "./loadProject.js";

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

const WORKSPACE = "[WORKSPACE]";

export async function apply(options: LoadConfigOptions = {}) {
  const project = await loadProject(options);
  if (!project) {
    return;
  }

  const {
    manifest,
    writeProjectManifest,
    projectDir,
    config,
    projectConventions,
  } = project;

  const projectGlobs = projectConventions.map((project) => project.glob).sort();

  // TODO: migrate to https://github.com/Effect-TS/schema
  // const config = t.decodeOrThrow(
  //   RepoConfigValidator,
  //   importedConfigFile.default,
  //   `Errors in config file`,
  // );

  const workspaces =
    projectGlobs.length > 0
      ? await findWorkspacePackagesNoCheck(projectDir, {
          patterns: projectGlobs,
        })
      : [];

  let didChangeManifest = false;

  // sync defined workspaces to package.json
  if (!equals((manifest.workspaces ?? []).sort(), projectGlobs)) {
    // TODO: support pnpm workspaces
    manifest.workspaces = projectGlobs;
    didChangeManifest = true;
  }

  const collectedState = await collectState({
    ...config,
    conventions: {
      ...config.conventions,
      sourceDir: config.conventions?.sourceDir ?? "src",
    },
    manifest,
    workspaceDir: projectDir,
  });

  const flattenedFiles = collectedState.files.flatMap((file) =>
    (file.targetPackages ?? [WORKSPACE]).map((targetPackage) => ({
      ...file,
      targetPackage,
    })),
  );
  const filesByPackage = groupBy(flattenedFiles, (file) => file.targetPackage);

  for (const [targetPackage, files] of Object.entries(filesByPackage)) {
    if (targetPackage === WORKSPACE) {
      await writeFiles(files, projectDir);
      continue;
    }
    // TODO: since we take the workspace list from package.json, we need to make sure 'moon' is applied before (race condition?)
    // otherwise, we should transform 'config.projects' into a list of workspaces
    const targetWorkspace = workspaces.find(
      (workspace) => workspace.manifest.name === targetPackage,
    );
    if (!targetWorkspace) {
      console.error(`Unable to find workspace ${targetPackage}`);
      continue;
    }
    await writeFiles(files, targetWorkspace.dir);
  }

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
    // TODO: run 'yarn install' or whatever the package manager is if manifest changed
  }
}
