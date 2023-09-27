import fs from "fs/promises";
import path from "path";
import { ensureDependency } from "./toolchain.js";
import type {
  CollectedState,
  DependencyDef,
  FileDef,
  RepoConfigWithInferredValues,
  StateFlags,
} from "../core/configTypes.js";
import { groupBy, equals } from "remeda";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import { type LoadConfigOptions, loadProject } from "./loadProject.js";
import { getDefaultGitBranch } from "../core/utils/getDefaultGitBranch.js";
import yaml from "yaml";
import { nonEmpty } from "../core/utils/filter.js";

export async function collectState(
  config: RepoConfigWithInferredValues,
): Promise<CollectedState> {
  const state: CollectedState = {
    files: [],
    devDependencies: [],
    tasks: [],
  };

  // TODO: topo-sort features by `order` config

  const flags: { [K in keyof StateFlags]?: string } = {};

  for (const feature of config.features) {
    // const featureConfig = feature.order;
    const featureState = await feature.actionFn(config, state);
    if (featureState.files) {
      state.files.push(...featureState.files.filter(nonEmpty));
    }
    if (featureState.tasks) {
      if (flags.preventAdditionalTasks) {
        console.warn(
          `Feature ${feature.name} adds tasks, but the previously evaluated ${flags.preventAdditionalTasks} feature set the 'preventAdditionalTasks' flag already. This is likely due to the order of features being incorrect.`,
        );
      }
      state.tasks.push(...featureState.tasks.filter(nonEmpty));
    }
    if (featureState.devDependencies) {
      state.devDependencies.push(
        ...featureState.devDependencies.filter(nonEmpty),
      );
    }
    if (featureState.flags) {
      for (const key of featureState.flags) {
        // first feature to set a flag wins
        flags[key] ||= feature.name;
      }
    }
  }

  // TODO: store file list, tasks and dependencies in a git-committed file, so that any removals/upgrades can be flagged as changes during diffing
  // e.g. .config/toolchain/.files
  // e.g. .config/toolchain/.dependencies // automatically updated when doing 'yarn add' so that it's compatible with dep. auto-updaters
  // TODO: also store version of each feature, so that we can detect if a feature has been upgraded

  return state;
}

const stringify = (obj: unknown, filePath: string) =>
  filePath.match(/\.ya?ml$/i)
    ? yaml.stringify(obj)
    : JSON.stringify(obj, null, 2);

const writeFileFromDef = async (file: FileDef, rootDir: string) => {
  if (typeof file.content === "undefined") {
    return;
  }
  const content =
    typeof file.content === "string"
      ? file.content
      : stringify(file.content, file.path);
  console.log(`Writing ${file.path}`);
  const targetPath = path.join(rootDir, file.path);
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  return fs.writeFile(path.join(rootDir, file.path), content);
};

export function writeFiles(files: readonly FileDef[], rootDir: string) {
  return Promise.allSettled(
    files.map((file) =>
      // TODO: add logging
      // TODO: add manual diffing with confirmation that change is ok
      writeFileFromDef(file, rootDir),
    ),
  );
}

const WORKSPACE = "[WORKSPACE]";

const defaultPackageManager = "yarn";
const defaultNodeVersion = "20.7.0";

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

  const defaultBranch =
    config.git?.defaultBranch ?? (await getDefaultGitBranch(projectDir));
  const { packageManager, engines } = manifest;
  const [packageManagerName, packageManagerVersion] = packageManager?.split(
    "@",
  ) ?? [defaultPackageManager];
  const nodeVersion = engines?.node ?? defaultNodeVersion;

  // sync defined workspaces to package.json
  if (
    !Array.isArray(manifest.workspaces) ||
    !equals((manifest.workspaces ?? []).sort(), projectGlobs)
  ) {
    // TODO: support pnpm workspaces
    manifest.workspaces = projectGlobs;
    didChangeManifest = true;
  }

  const collectedState = await collectState({
    ...config,
    git: {
      ...config.git,
      defaultBranch,
    },
    node: {
      ...(packageManagerName === "yarn" ||
      packageManagerName === "pnpm" ||
      packageManagerName === "npm"
        ? {
            packageManager: {
              name: packageManagerName,
              version: packageManagerVersion,
            },
          }
        : {
            packageManager: {
              name: defaultPackageManager,
            },
          }),
      version: nodeVersion,
    },
    conventions: {
      ...config.conventions,
      sourceDir: config.conventions?.sourceDir ?? "src",
      sourceExtensions: config.conventions?.sourceExtensions ?? [
        "ts",
        "tsx",
        "mts",
        "cts",
        "js",
        "jsx",
        "mjs",
        "cjs",
        "json",
      ],
    },
    manifest,
    workspaceDir: projectDir,
  });

  const flattenedFiles = collectedState.files.flatMap((file) =>
    file
      ? (file.targetPackages ?? [WORKSPACE]).map((targetPackage) => ({
          ...file,
          targetPackage,
        }))
      : [],
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

  for (const packageNameOrDef of collectedState.devDependencies) {
    let dependencyDef: DependencyDef;
    if (typeof packageNameOrDef === "string") {
      const [packageAliasPart, versionOrTag] = packageNameOrDef
        .slice(1)
        .split("@", 2) as [string, string | undefined];
      dependencyDef = {
        packageAlias: `${packageNameOrDef[0]}${packageAliasPart}`,
        versionOrTag,
      };
    } else {
      dependencyDef = packageNameOrDef;
    }
    // TODO parallelize?
    didChangeManifest ||= await ensureDependency({
      manifest,
      target: "devDependencies",
      ...dependencyDef,
    });
  }

  if (didChangeManifest) {
    await writeProjectManifest(manifest);
    // TODO: run 'yarn install' or whatever the package manager is if manifest changed
  }
}
