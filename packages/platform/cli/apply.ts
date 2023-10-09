import fs from "fs/promises";
import path from "path";
import { ensureDependency } from "./toolchain.js";
import type {
  CollectedFileDef,
  CollectedState,
  DependencyDef,
  FileDef,
  RepoConfigWithInferredValues,
  RepoPackageJson,
  StateFlags,
} from "@repo/core/configTypes.js";
import { groupBy, equals } from "remeda";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import { type LoadConfigOptions, loadRepoProject } from "./loadProject.js";
import { getDefaultGitBranch } from "@repo/core/utils/getDefaultGitBranch.js";
import yaml from "yaml";
import { nonEmpty } from "@repo/core/utils/filter.js";
import { isMatching } from "ts-pattern";

export async function collectState(
  config: RepoConfigWithInferredValues,
): Promise<CollectedState> {
  const state: CollectedState = {
    files: [],
    devDependencies: [],
    tasks: [],
  };

  const { project } = config;
  // TODO: topo-sort features by `order` config

  const flags: { [K in keyof StateFlags]?: string } = {};

  for (const feature of config.features) {
    // const featureConfig = feature.order;
    const featureState = await feature.actionFn(config, state);
    if (featureState.files) {
      const flattenedFiles = (
        await Promise.all(
          featureState.files.map(async (file): Promise<CollectedFileDef[]> => {
            if (!file) return [];
            const matchPackage = file.matchPackage;
            if (!matchPackage) {
              return [{ ...file, targetDir: ".", target: project.manifest }];
            }
            const packages = [
              ...(await project.getWorkspacePackages()),
              project,
            ];
            console.log(
              "packages",
              packages.map(({ manifest }) => manifest.workspacePath),
            );
            const isMatchingPackage = isMatching(matchPackage);

            // TODO: check if any packages matched and maybe add a warning if zero matches?
            return packages.flatMap((pkg) =>
              isMatchingPackage(pkg.manifest)
                ? [{ ...file, targetDir: pkg.dir, target: pkg.manifest }]
                : [],
            );
          }),
        )
      ).flat();
      state.files.push(...flattenedFiles);
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

const writeFileFromDef = async (
  file: FileDef,
  rootDir: string,
  manifest: RepoPackageJson,
) => {
  const resolvedContent =
    typeof file.content === "function"
      ? await file.content(manifest)
      : file.content;
  if (resolvedContent === "undefined") {
    return;
  }
  const targetPath = path.join(rootDir, file.path);
  const parentDir = path.dirname(targetPath);
  const content =
    typeof resolvedContent === "string"
      ? resolvedContent
      : stringify(resolvedContent, file.path);

  console.log(`Writing ${targetPath}`);
  await fs.mkdir(parentDir, { recursive: true });
  return fs.writeFile(targetPath, content);
};

export function writeFiles(
  files: readonly FileDef[],
  rootDir: string,
  manifest: RepoPackageJson,
) {
  return Promise.allSettled(
    files.map((file) =>
      // TODO: add logging
      // TODO: add manual diffing with confirmation that change is ok
      writeFileFromDef(file, rootDir, manifest),
    ),
  );
}

const defaultPackageManager = "yarn";
const defaultNodeVersion = "20.7.0";
const DEFAULT_SOURCE_EXTENSIONS = [
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
];

export async function apply(options: LoadConfigOptions = {}) {
  const project = await loadRepoProject(options);
  if (!project) {
    return;
  }

  const {
    manifest,
    writeProjectManifest,
    projectDir,
    config,
    projectConventions,
    getWorkspacePackages,
  } = project;

  const projectGlobs = projectConventions.map((project) => project.glob).sort();

  // TODO: migrate to https://github.com/Effect-TS/schema
  // const config = t.decodeOrThrow(
  //   RepoConfigValidator,
  //   importedConfigFile.default,
  //   `Errors in config file`,
  // );

  let didChangeManifest = false;

  const defaultBranch: string =
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
      sourceExtensions:
        config.conventions?.sourceExtensions ?? DEFAULT_SOURCE_EXTENSIONS,
    },
    workspaceDir: projectDir,
    project,
  });

  const filesByPackageDir = groupBy(
    collectedState.files,
    (file) => file.targetDir,
  );

  for (const [targetPackageDir, files] of Object.entries(filesByPackageDir)) {
    const { target } = files[0];
    if (targetPackageDir === ".") {
      await writeFiles(files, projectDir, target);
      continue;
    }

    await writeFiles(files, path.join(projectDir, targetPackageDir), target);
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
