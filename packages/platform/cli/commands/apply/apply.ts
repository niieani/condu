import fs from "node:fs/promises";
import path from "node:path";
import { ensureDependency } from "../../toolchain.js";
import type {
  CollectedFileDef,
  CollectedState,
  DependencyDef,
  RepoConfigWithInferredValues,
  StateFlags,
} from "@repo/core/configTypes.js";
import { groupBy, equals } from "remeda";
import { type LoadConfigOptions, loadRepoProject } from "../../loadProject.js";
import { getDefaultGitBranch } from "@repo/core/utils/getDefaultGitBranch.js";
import { nonEmpty } from "@repo/core/utils/filter.js";
import { isMatching } from "ts-pattern";
import {
  FILE_STATE_PATH,
  readPreviouslyWrittenFileCache,
  writeFiles,
  type WrittenFile,
} from "./readWrite.js";
import {
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_NODE_VERSION,
  DEFAULT_SOURCE_EXTENSIONS,
  CONFIG_DIR,
} from "./constants.js";

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
              return [
                {
                  ...file,
                  targetDir: ".",
                  target: project.manifest,
                  featureName: feature.name,
                },
              ];
            }
            const packages = [
              ...(await project.getWorkspacePackages()),
              project,
            ];
            const isMatchingPackage = isMatching(matchPackage);
            const matchAllPackages =
              Object.keys(matchPackage).length === 1 &&
              "kind" in matchPackage &&
              matchPackage.kind === "package";

            // TODO: check if any packages matched and maybe add a warning if zero matches?
            const matches = packages.flatMap((pkg) =>
              isMatchingPackage(pkg.manifest)
                ? [
                    {
                      ...file,
                      targetDir: pkg.dir,
                      target: pkg.manifest,
                      featureName: feature.name,
                      skipIgnore: matchAllPackages,
                    },
                  ]
                : [],
            );

            return matchAllPackages
              ? [
                  ...matches,
                  // this one is used by the gitignore-like features, as it doesn't contain 'content'
                  ...project.projectConventions.map((convention) => ({
                    path: file.path,
                    publish: file.publish,
                    type: file.type,
                    featureName: feature.name,
                    targetDir: convention.glob,
                    target: project.manifest,
                  })),
                ]
              : matches;
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
  ) ?? [DEFAULT_PACKAGE_MANAGER];
  const nodeVersion = engines?.node ?? DEFAULT_NODE_VERSION;

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
              name: DEFAULT_PACKAGE_MANAGER,
            },
          }),
      version: nodeVersion,
    },
    conventions: {
      ...config.conventions,
      sourceDir: config.conventions?.sourceDir ?? "src",
      buildDir: config.conventions?.buildDir ?? "dist",
      sourceExtensions:
        config.conventions?.sourceExtensions ?? DEFAULT_SOURCE_EXTENSIONS,
    },
    workspaceDir: projectDir,
    configDir: path.join(projectDir, CONFIG_DIR),
    project,
  });

  const writableFiles = collectedState.files.filter(({ targetDir, content }) =>
    Boolean(targetDir && content),
  );
  const filesByPackageDir = groupBy(writableFiles, (file) => file.targetDir);

  // TODO: provide the manually changed previouslyWrittenFiles to respective features
  // TODO: would need to add feature name to each cache entry
  const previouslyWrittenFiles = await readPreviouslyWrittenFileCache(
    projectDir,
  );

  const writtenFiles: WrittenFile[] = [];
  for (const [targetPackageDir, files] of Object.entries(filesByPackageDir)) {
    const [{ target }] = files;
    if (!target) continue;

    const written = await writeFiles({
      files,
      projectDir,
      targetPackageDir,
      manifest: target,
      previouslyWrittenFiles,
    });

    writtenFiles.push(...written);
  }

  // anything that's left in 'previouslyWrittenFiles' is no longer being generated, and should be deleted:
  await Promise.all(
    [...previouslyWrittenFiles.values()].map(async (file) => {
      if (file.manuallyChanged) return;
      const fullPath = path.join(projectDir, file.path);
      console.log(`Deleting, no longer needed: ${fullPath}`);
      await fs.rm(fullPath);
    }),
  );

  await writeFiles({
    files: [{ path: FILE_STATE_PATH, content: writtenFiles }],
    manifest,
    projectDir,
    targetPackageDir: ".",
    previouslyWrittenFiles: new Map(),
  });

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
