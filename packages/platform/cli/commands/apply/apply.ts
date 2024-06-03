import fs from "node:fs/promises";
import path from "node:path";
import { ensureDependency } from "../../ensureDependency.js";
import type {
  CollectedFileDef,
  CollectedState,
  DependencyDef,
  Hooks,
  RepoConfigWithInferredValues,
  RepoConfigWithInferredValuesAndProject,
  StateFlags,
  LoadConfigOptions,
  Project,
} from "@condu/core/configTypes.js";
import { groupBy, isDeepEqual } from "remeda";
import { loadRepoProject } from "../../loadProject.js";
import { getDefaultGitBranch } from "@condu/core/utils/getDefaultGitBranch.js";
import { nonEmpty } from "@condu/core/utils/filter.js";
import { isMatching } from "ts-pattern";
import {
  FILE_STATE_PATH,
  readPreviouslyWrittenFileCache,
  writeFiles,
  type WrittenFile,
} from "./readWrite.js";

export const getApplyHook =
  <TOut>(...fns: ((arg: TOut) => TOut | Promise<TOut>)[]) =>
  async (arg: TOut): Promise<TOut> => {
    for (const fn of fns) {
      arg = await fn(arg);
    }
    return arg;
  };

export async function collectState(
  config: RepoConfigWithInferredValuesAndProject,
): Promise<CollectedState> {
  const state: CollectedState = {
    files: [],
    devDependencies: [],
    tasks: [],
    hooksByPackage: {},
  };

  const hooksByPackage: {
    [packageName: string]: {
      [P in keyof Hooks]?: Hooks[P][];
    };
  } = {};

  const { project, features } = config;

  const workspacePackages = await project.getWorkspacePackages();
  const packages = [project, ...workspacePackages];

  // TODO: topo-sort features by `order` config, or support soft dependencies between features
  const flags: { [K in keyof StateFlags]?: string } = {};

  for (const feature of features) {
    // const featureOrder = feature.order;
    const featureConfig = await feature.actionFn(config, state);
    if (!featureConfig) continue;

    for (const featureEffect of featureConfig.effects ?? []) {
      if (!featureEffect) continue;

      const matchPackageFn = isMatching(featureEffect.matchPackage);
      const matchAllPackages =
        featureEffect.matchPackage &&
        Object.keys(featureEffect.matchPackage).length === 1 &&
        "kind" in featureEffect.matchPackage &&
        featureEffect.matchPackage.kind === "package";

      // TODO: check if any packages matched and maybe add a warning if zero matches?
      const matchedPackages = featureEffect.matchPackage
        ? matchAllPackages
          ? workspacePackages
          : packages.filter((pkg) => matchPackageFn(pkg))
        : [project];

      if (featureEffect.files) {
        const flattenedFiles = featureEffect.files.flatMap(
          (file): CollectedFileDef[] => {
            if (!file) return [];

            const matches = matchedPackages.map(
              (pkg): CollectedFileDef => ({
                ...file,
                targetDir: pkg.relPath,
                targetPackage: pkg,
                featureName: feature.name,
                skipIgnore: matchAllPackages,
              }),
            );

            return matchAllPackages
              ? ([
                  ...matches,
                  // this one is used by the gitignore-like features, as it doesn't contain 'content'
                  ...project.projectConventions.map((convention) => ({
                    path: file.path,
                    publish: file.publish,
                    type: file.type,
                    featureName: feature.name,
                    targetDir: convention.glob,
                    targetPackage: project,
                  })),
                ] satisfies CollectedFileDef[])
              : matches;
          },
        );
        state.files.push(...flattenedFiles);
      }
      if (featureEffect.tasks) {
        if (flags.preventAdditionalTasks) {
          console.warn(
            `Feature ${feature.name} adds tasks, but the previously evaluated ${flags.preventAdditionalTasks} feature set the 'preventAdditionalTasks' flag already. This is likely due to the order of features being incorrect.`,
          );
        }
        for (const taskDef of featureEffect.tasks) {
          if (!taskDef) continue;
          state.tasks.push(
            ...matchedPackages.map((pkg) => ({
              ...taskDef,
              target: pkg.manifest,
              featureName: feature.name,
            })),
          );
        }
      }

      // TODO: support per-package dependencies, right now all dependencies are repo-global
      if (featureEffect.devDependencies) {
        state.devDependencies.push(
          ...featureEffect.devDependencies.filter(nonEmpty),
        );
      }

      if (featureEffect.hooks) {
        for (const [_hookName, hookFn] of Object.entries(featureEffect.hooks)) {
          const hookName = _hookName as keyof Hooks;
          for (const pkg of matchedPackages) {
            const hooks = (hooksByPackage[pkg.manifest.name] ||= {});
            const hook = (hooks[hookName] ||= []);
            hook.push(hookFn);
          }
        }
      }
    }

    // map hooks into functions:
    state.hooksByPackage = Object.fromEntries(
      Object.entries(hooksByPackage).map(([packageName, hooks]) => [
        packageName,
        Object.fromEntries(
          Object.entries(hooks).map(([hookName, hookFns]) => [
            hookName,
            getApplyHook(...hookFns),
          ]),
        ),
      ]),
    );

    // flags are global
    if (featureConfig.flags) {
      for (const key of featureConfig.flags) {
        // first feature to set a flag wins
        flags[key] ||= feature.name;
      }
    }
  }

  // TODO: store file list, tasks and dependencies in a git-committed file, so that any removals/upgrades can be flagged as changes during diffing
  // e.g. .config/condu/.files
  // e.g. .config/condu/.dependencies // automatically updated when doing 'yarn add' so that it's compatible with dep. auto-updaters
  // TODO: also store version of each feature, so that we can detect if a feature has been upgraded

  return state;
}

export async function apply(options: LoadConfigOptions = {}) {
  // TODO: add a mutex lock to prevent concurrent runs of apply
  const { throwOnManualChanges } = options;
  const project = await loadRepoProject(options);
  if (!project) {
    return;
  }

  const {
    manifest,
    writeProjectManifest,
    absPath: workspaceDirAbs,
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

  // sync defined workspaces to package.json
  if (
    !Array.isArray(manifest.workspaces) ||
    !isDeepEqual((manifest.workspaces ?? []).sort(), projectGlobs)
  ) {
    // TODO: support pnpm workspaces
    manifest.workspaces = projectGlobs;
    didChangeManifest = true;
  }

  const collectedState = await collectState({ ...config, project });

  const writableFiles = collectedState.files.filter(
    ({ targetDir, content, type }) =>
      Boolean(targetDir && content && type !== "ignore-only"),
  );
  const filesByPackageDir = groupBy(writableFiles, (file) => file.targetDir);

  // TODO: provide the manually changed previouslyWrittenFiles to respective features
  // TODO: would need to add feature name to each cache entry
  const previouslyWrittenFiles =
    await readPreviouslyWrittenFileCache(workspaceDirAbs);

  const writtenFiles: WrittenFile[] = [];
  for (const [targetPackageDir, files] of Object.entries(filesByPackageDir)) {
    const [{ targetPackage }] = files;
    if (!targetPackage) continue;

    const written = await writeFiles({
      files,
      workspaceDirAbs,
      targetPackageDir,
      targetPackage,
      previouslyWrittenFiles,
      throwOnManualChanges,
    });

    writtenFiles.push(...written);
  }

  // anything that's left in 'previouslyWrittenFiles' is no longer being generated, and should be deleted:
  await Promise.all(
    [...previouslyWrittenFiles.values()].map(async (file) => {
      if (file.manuallyChanged) return;
      const fullPath = path.join(workspaceDirAbs, file.path);
      console.log(`Deleting, no longer needed: ${fullPath}`);
      await fs.rm(fullPath);
    }),
  );

  await writeFiles({
    files: [{ path: FILE_STATE_PATH, content: writtenFiles }],
    targetPackage: project,
    workspaceDirAbs: workspaceDirAbs,
    targetPackageDir: ".",
    previouslyWrittenFiles: new Map(),
    throwOnManualChanges,
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

  await ensurePublishConfigDirectorySet(project);

  return {
    project,
    collectedState,
  };
}

async function ensurePublishConfigDirectorySet(project: Project) {
  for (const pkg of await project.getWorkspacePackages()) {
    // ensure there's a publishConfig.directory set for each package
    // see https://pnpm.io/package_json#publishconfigdirectory
    const originalPackageDir = path.join(project.absPath, pkg.relPath);
    const publishablePackageDir = path.join(
      project.absPath,
      project.config.conventions.buildDir,
      pkg.relPath,
    );
    const relativePath = path.relative(
      originalPackageDir,
      publishablePackageDir,
    );
    const publishableDirectory = pkg.manifest.publishConfig?.["directory"];
    if (publishableDirectory !== relativePath) {
      pkg.manifest.publishConfig ??= {};
      pkg.manifest.publishConfig["directory"] = relativePath;
      await pkg.writeProjectManifest(pkg.manifest);
    }
  }
}
