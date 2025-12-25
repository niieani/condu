import { ensureDependencyIn } from "../../ensureDependency.js";
import type { LoadConfigOptions } from "../../api/configTypes.js";
import type { ConduPackageEntry } from "./ConduPackageEntry.js";
import {
  loadConduConfigFnFromFs,
  loadConduProject,
} from "../../loadProject.js";
import { isMatching } from "ts-pattern";
import type {
  ConduApi,
  FeatureDefinition,
  PeerContextReducer,
  ScopedRecipeApi,
} from "./conduApiTypes.js";
import {
  type CollectedState,
  type CollectionContext,
  ConduReadonlyCollectedStateView,
  type CollectedDependency,
  type CollectionStage,
  type DependencyDefinitionInput,
} from "./CollectedState.js";
import type { ConduProject } from "./ConduProject.js";
import {
  FileManager,
  type FileManagerOptions,
  type ModifyUserEditableFileOptions,
} from "./FileManager.js";
import type { PeerContext } from "../../extendable.js";
import { UpsertMap } from "@condu/core/utils/UpsertMap.js";
import type { UnionToIntersection } from "type-fest";
import type { ConduReporter as ReporterInstance } from "../../reporter/ConduReporter.js";

export interface ProjectAndCollectedState {
  project: ConduProject;
  collectedState: CollectedState;
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
}

type AllPossiblePeerContexts = UnionToIntersection<
  PeerContext[keyof PeerContext]
>;

export async function apply(
  options: LoadConfigOptions = {},
): Promise<ProjectAndCollectedState | undefined> {
  const { ConduReporter } = await import("../../reporter/ConduReporter.js");
  const reporter = ConduReporter.get();
  const startTime = Date.now();

  try {
    reporter.startPhase("loading");

    const projectLoadData = await loadConduConfigFnFromFs(options);
    const project = await loadConduProject(projectLoadData);
    if (!project) {
      return;
    }

    const featureCount = project.config.features.length;
    if (
      reporter.getMode() !== "ci" ||
      reporter.getVerbosity() === "verbose"
    ) {
      reporter.success(`Found ${featureCount} features to apply`);
    }
    reporter.endPhase("loading", { success: true });

    const collected = await collectState({ ...options, project });

    reporter.endPhase("collecting", { success: true });

    const applyResult = await applyAndCommitCollectedState(collected);

    // Print summary
    reporter.startPhase("complete");
    const duration = Date.now() - startTime;

    // Build summary from collected state
    const { fileManager } = collected.collectedState;
    const filesArray = Array.from(fileManager.files.values());
    const evaluatedFiles = filesArray.filter(
      (f) => f.isManaged || f.lastApplyKind === "no-longer-generated",
    );
    const manualReviewItems = filesArray
      .filter((f) => f.manualReviewDetails)
      .map((f) => ({
        path:
          f.targetPackage === project.workspace
            ? f.relPath
            : `${f.targetPackage.relPath}${f.relPath}`,
        managedBy: f.managedByFeatures.map((mf) => mf.featureName),
        message: f.manualReviewDetails!,
      }));

    // Count files by their status
    const appliedFiles = filesArray.filter(
      (f) => f.status === "applied" && f.hadChanges,
    );
    const skippedFiles = filesArray.filter(
      (f) => f.status === "skipped" && f.hadChanges,
    );
    const changedFiles = evaluatedFiles.filter(
      (f) =>
        f.hadChanges ||
        f.status === "needs-user-input" ||
        f.lastApplyKind === "no-longer-generated",
    );
    const unchangedFilesCount = evaluatedFiles.length - changedFiles.length;

    const packagesWithChangedFiles = new Set(
      changedFiles.map((f) => f.targetPackage.relPath),
    );
    for (const pkg of applyResult.packagesTouched) {
      packagesWithChangedFiles.add(pkg.relPath);
    }

    const noChanges =
      changedFiles.length === 0 &&
      applyResult.dependencyStats.changed === 0 &&
      applyResult.dependencyStats.removed === 0;

    if (noChanges) {
      const message = "No changes required (already up to date)";
      if (reporter.getMode() === "quiet") {
        reporter.write(message);
      } else {
        reporter.info(message);
      }
    }

    reporter.endPhase("applying", { success: true });

    const summary = {
      totalFeatures: featureCount,
      totalFiles: evaluatedFiles.length,
      filesEvaluated: evaluatedFiles.length,
      filesChanged: changedFiles.length,
      filesUnchanged: unchangedFilesCount,
      filesCreated: appliedFiles.filter(
        (f) => f.lastApplyKind === "generated" || f.lastApplyKind === "symlink",
      ).length,
      filesUpdated: appliedFiles.filter(
        (f) => f.lastApplyKind === "user-editable",
      ).length,
      filesDeleted: filesArray.filter(
        (f) => f.lastApplyKind === "no-longer-generated",
      ).length,
      filesSkipped: skippedFiles.length,
      filesNeedingReview: manualReviewItems.length,
      packagesModified: packagesWithChangedFiles.size,
      depsEvaluated: applyResult.dependencyStats.evaluated,
      depsChanged: applyResult.dependencyStats.changed,
      depsUnchanged:
        applyResult.dependencyStats.evaluated -
        applyResult.dependencyStats.changed,
      depsRemoved: applyResult.dependencyStats.removed,
      duration,
      errors: [],
      warnings: [],
      manualReviewItems,
    };

    reporter.printSummary(summary);
    reporter.endPhase("complete", { success: true });

    return collected;
  } catch (error) {
    reporter.error("Apply failed", error as Error);
    reporter.endPhase("complete", {
      success: false,
      error: error as Error,
    });
    throw error;
  }
}

interface CollectStateConfig extends FileManagerOptions {
  project: ConduProject;
}

export async function collectState(
  options: CollectStateConfig,
): Promise<ProjectAndCollectedState> {
  const { ConduReporter } = await import("../../reporter/ConduReporter.js");
  const reporter = ConduReporter.get();

  reporter.startPhase("collecting");

  // TODO: add a mutex file lock to prevent concurrent runs of apply
  const { project, ...fsOptions } = options;
  const { config } = project;
  const { features } = config;

  // Initialize the PeerContext
  let peerContext: Partial<Record<(string & {}) | keyof PeerContext, unknown>> =
    { global: config.globalPeerContext };

  // Collect initialPeerContext from features
  for (const feature of features) {
    if ("initialPeerContext" in feature && feature.initialPeerContext) {
      if (feature.name === "global") {
        throw new Error(
          'Feature name "global" is reserved and cannot be used as a feature name',
        );
      }
      const initialPeerContext =
        typeof feature.initialPeerContext === "function"
          ? await feature.initialPeerContext(project)
          : feature.initialPeerContext;
      peerContext[feature.name] = initialPeerContext;
    }
  }

  const peerContextReducers: [
    string,
    NonNullable<PeerContextReducer[keyof PeerContextReducer]>,
  ][] = [];

  // Run modifyPeerContexts functions
  for (const feature of features) {
    if (feature.modifyPeerContexts) {
      const reducers = await feature.modifyPeerContexts(
        project,
        peerContext[feature.name] as AllPossiblePeerContexts,
      );
      for (const [key, reducer] of Object.entries(reducers)) {
        if (!peerContext[key]) {
          // peer context was never initialized (e.g. because a feature it relates to isn't used), skip
          continue;
        }
        // reduce global peer context from all features first,
        // so it can be available complete, for other context reducers
        if (key === "global") {
          peerContext[key] = await reducer(
            peerContext[key] as AllPossiblePeerContexts,
          );
        } else {
          peerContextReducers.push([key, reducer]);
        }
      }
    }
  }

  // Run other peerContext reducers
  for (const [key, reducer] of peerContextReducers) {
    peerContext[key] = await reducer(
      peerContext[key] as AllPossiblePeerContexts,
    );
  }

  const fileManager = new FileManager(
    project.workspace,
    project.workspacePackages,
    fsOptions,
  );

  // Create the object to collect changes
  const changesCollector: CollectedState = {
    stage: "fresh",
    fileManager,
    dependencies: [],
    resolutions: {},
    packageJsonModifications: [],
    releasePackageJsonModifications: [],
    tasks: [],
    peerContext: peerContext as PeerContext,
  };
  const collectedStateReadOnlyView = new ConduReadonlyCollectedStateView(
    changesCollector,
  );

  const conduApiPerFeature: Array<[FeatureDefinition, ConduApi]> = [];
  // Run apply functions in topological order
  for (const [index, feature] of features.entries()) {
    reporter.startFeature(feature.name, { index, total: features.length });

    const conduApi = createConduApi({
      project,
      collectionContext: { featureName: feature.name },
      changesCollector,
      collectedStateReadOnlyView,
      reporter,
    });
    conduApiPerFeature.push([feature, conduApi]);

    if ("initialPeerContext" in feature) {
      await feature.defineRecipe?.(
        conduApi,
        peerContext[feature.name] as AllPossiblePeerContexts,
      );
    } else {
      await feature.defineRecipe?.(conduApi);
    }

    // Report feature completion with stats
    const featureFiles = Array.from(fileManager.files.values()).filter((f) =>
      f.managedByFeatures.some((mf) => mf.featureName === feature.name),
    );
    const featureDeps = changesCollector.dependencies.filter(
      (d) => d.context.featureName === feature.name,
    );

    reporter.endFeature(feature.name, {
      filesQueued: featureFiles.length,
      depsAdded: featureDeps.length,
      resolutionsSet: 0,
      packagesModified: new Set(
        featureFiles.map((f) => f.targetPackage.relPath),
      ).size,
    });
  }

  // Render feature list after collecting
  reporter.renderFeatureList();

  changesCollector.stage = "recipes-defined";

  for (const [feature, conduApi] of conduApiPerFeature) {
    const garnishApi = {
      ...conduApi,
      globalRegistry: collectedStateReadOnlyView,
    };
    if ("initialPeerContext" in feature) {
      await feature.defineGarnish?.(
        garnishApi,
        peerContext[feature.name] as AllPossiblePeerContexts,
      );
    } else {
      await feature.defineGarnish?.(garnishApi);
    }
  }

  changesCollector.stage = "garnish-defined";

  return {
    project,
    collectedStateReadOnlyView,
    collectedState: changesCollector,
  };
}

const createConduApi = ({
  project,
  collectionContext,
  changesCollector,
  collectedStateReadOnlyView,
  reporter,
}: {
  project: ConduProject;
  collectionContext: CollectionContext;
  changesCollector: CollectedState;
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
  reporter: ReporterInstance;
}): ConduApi => ({
  project,
  root: createStateDeclarationApi({
    matchingPackages: [project.workspace],
    changesCollector,
    collectionContext,
    matchesAllWorkspacePackages: false,
    collectedStateReadOnlyView,
    reporter,
  }),
  in(criteria) {
    const matchPackageFn = isMatching(criteria);
    const matchAllWorkspacePackages =
      Object.keys(criteria).length === 1 &&
      "kind" in criteria &&
      criteria.kind === "package";

    // TODO: check if any packages matched and maybe add a warning if zero matches?
    const matchingPackages = matchAllWorkspacePackages
      ? project.workspacePackages
      : project.allPackages.filter((pkg) => matchPackageFn(pkg));

    // TODO: when matching all packages, we can optimize the gitignore output
    // by using the project.projectConventions[*].glob instead of the package's path
    const matchesAllWorkspacePackages =
      matchingPackages.length === project.workspacePackages.length;

    return createStateDeclarationApi({
      matchingPackages,
      changesCollector,
      collectionContext,
      matchesAllWorkspacePackages,
      collectedStateReadOnlyView,
      reporter,
    });
  },
});

const createStateDeclarationApi = ({
  matchingPackages,
  changesCollector,
  collectionContext,
  collectedStateReadOnlyView,
  matchesAllWorkspacePackages,
  reporter,
}: {
  matchingPackages: readonly ConduPackageEntry[];
  changesCollector: CollectedState;
  collectionContext: CollectionContext;
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
  matchesAllWorkspacePackages: boolean;
  reporter: ReporterInstance;
}): ScopedRecipeApi => ({
  ignoreFile(relPath, options) {
    assertFreshCollectorState(changesCollector, collectionContext, ["fresh"]);

    for (const pkg of matchingPackages) {
      const filePath = formatFileTarget(pkg, relPath);
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Ignoring ${filePath}`,
      });
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .updateAttributes(
          { ...options, inAllPackages: matchesAllWorkspacePackages },
          collectionContext,
        );
    }
    return this;
  },
  generateFile(relPath, options) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
      const filePath = formatFileTarget(pkg, relPath);
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Generating ${filePath}`,
      });
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .defineInitialContent(
          {
            ...options,
            attributes: {
              ...options.attributes,
              inAllPackages: matchesAllWorkspacePackages,
            },
          },
          collectionContext,
        );
    }
    return this;
  },
  modifyGeneratedFile(relPath, options) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
      const filePath = formatFileTarget(pkg, relPath);
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Modifying generated file ${filePath}`,
      });
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .addModification(
          {
            ...options,
            attributes: {
              ...options.attributes,
              inAllPackages: matchesAllWorkspacePackages,
            },
          },
          collectionContext,
        );
    }
    return this;
  },
  modifyUserEditableFile(relPath, options: ModifyUserEditableFileOptions<any>) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
      const filePath = formatFileTarget(pkg, relPath);
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Modifying user-editable file ${filePath}`,
      });
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .addUserEditableModification(
          {
            ...options,
            attributes: {
              ...options.attributes,
              inAllPackages: matchesAllWorkspacePackages,
            },
          },
          collectionContext,
        );
    }
    return this;
  },
  ensureDependency(name, dependencyDef) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Ensuring dependency ${name}${describeDependencyVersion(dependencyDef)} in ${formatPackageTarget(pkg)} (${(dependencyDef?.list ?? "devDependencies")})`,
      });
      changesCollector.dependencies.push({
        targetPackage: pkg,
        dependencyDefinition: { name, ...dependencyDef },
        context: collectionContext,
      });
    }
    return this;
  },
  setDependencyResolutions(resolutions) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    Object.assign(changesCollector.resolutions, resolutions);
    logFeatureAction({
      reporter,
      collectionContext,
      message: `Setting dependency resolutions for ${Object.keys(resolutions).join(", ")}`,
    });
    return this;
  },
  modifyPackageJson(modifier) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Modifying package.json in ${formatPackageTarget(pkg)}`,
      });
      changesCollector.packageJsonModifications.push({
        targetPackage: pkg,
        globalRegistry: collectedStateReadOnlyView,
        modifier,
        context: collectionContext,
      });
    }
    return this;
  },
  modifyPublishedPackageJson(modifier) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Modifying published package.json in ${formatPackageTarget(pkg)}`,
      });
      changesCollector.releasePackageJsonModifications.push({
        targetPackage: pkg,
        globalRegistry: collectedStateReadOnlyView,
        modifier,
        context: collectionContext,
      });
      // pkg.addPublishedModification(modifier, collectionContext);
    }
    return this;
  },
  defineTask(name, task) {
    assertFreshCollectorState(changesCollector, collectionContext, ["fresh"]);

    for (const pkg of matchingPackages) {
      logFeatureAction({
        reporter,
        collectionContext,
        message: `Defining task "${name}" in ${formatPackageTarget(pkg)}`,
      });
      changesCollector.tasks.push({
        targetPackage: pkg,
        taskDefinition: { name, ...task },
        context: collectionContext,
      });
    }
    return this;
  },
});

const formatFileTarget = (pkg: ConduPackageEntry, relPath: string): string =>
  pkg.kind === "workspace" ? relPath : `${pkg.relPath}${relPath}`;

const formatPackageTarget = (pkg: ConduPackageEntry): string =>
  pkg.kind === "workspace" ? "workspace" : pkg.relPath;

const describeDependencyVersion = (
  dependency?: DependencyDefinitionInput,
): string => {
  if (!dependency) return "";
  if ("version" in dependency && dependency.version) {
    return `@${dependency.version}`;
  }
  if (dependency.tag) {
    return `@${dependency.tag}`;
  }
  return "";
};

const logFeatureAction = ({
  reporter,
  collectionContext,
  message,
}: {
  reporter: ReporterInstance;
  collectionContext: CollectionContext;
  message: string;
}): void => {
  reporter.log(message, { feature: collectionContext.featureName });
};

function assertFreshCollectorState(
  changesCollector: CollectedState,
  collectionContext: CollectionContext,
  allowedInStates: CollectionStage[],
) {
  if (!allowedInStates.includes(changesCollector.stage)) {
    throw new Error(
      `condu's APIs cannot be used after the recipe function has been executed. Please check ${collectionContext.featureName}'s recipe functions for issues.`,
    );
  }
}

export async function applyAndCommitCollectedState({
  collectedState,
  collectedStateReadOnlyView,
  project,
}: ProjectAndCollectedState): Promise<{
  dependencyStats: {
    evaluated: number;
    changed: number;
    removed: number;
  };
  packagesTouched: Set<ConduPackageEntry>;
}> {
  const {
    fileManager,
    dependencies,
    resolutions,
    packageJsonModifications,
    releasePackageJsonModifications,
  } = collectedState;
  // we can delay loading cache until before fileManager.applyAllFiles
  // that way we can speed up the process by not reading cache if we only want publishing changes
  await fileManager.readCache();
  // compute the content and write any changes to file system
  await fileManager.applyAllFiles(collectedStateReadOnlyView);

  const dependencyStats = {
    evaluated: dependencies.length,
    changed: 0,
    removed: 0,
  };

  // Group dependency additions by target package
  const dependenciesByPackage = new UpsertMap<
    ConduPackageEntry,
    CollectedDependency[]
  >();
  for (const collectedDependency of dependencies) {
    const list = dependenciesByPackage.getOrInsert(
      collectedDependency.targetPackage,
      [],
    );
    list.push(collectedDependency);
  }

  // TODO: move this to a 'dependencies' feature
  // Create a modification to add dependencies per each package
  for (const [targetPackage, packageDependencies] of dependenciesByPackage) {
    packageJsonModifications.push({
      targetPackage,
      context: { featureName: "condu:dependencies" },
      globalRegistry: collectedStateReadOnlyView,
      modifier: async (manifest) => {
        const noLongerManagedDependencies = new Set(
          Object.keys(manifest.condu?.managedDependencies ?? {}),
        );

        // Apply all new dependencies
        for (const { dependencyDefinition } of packageDependencies) {
          const didChange = await ensureDependencyIn(
            manifest,
            dependencyDefinition,
          );
          if (didChange) {
            dependencyStats.changed += 1;
          }
          noLongerManagedDependencies.delete(
            dependencyDefinition.installAsAlias ?? dependencyDefinition.name,
          );
        }

        for (const name of noLongerManagedDependencies) {
          let removed = false;
          if (manifest.dependencies?.[name]) {
            delete manifest.dependencies[name];
            removed = true;
          }
          if (manifest.devDependencies?.[name]) {
            delete manifest.devDependencies[name];
            removed = true;
          }
          if (manifest.peerDependencies?.[name]) {
            delete manifest.peerDependencies[name];
            removed = true;
          }
          if (manifest.optionalDependencies?.[name]) {
            delete manifest.optionalDependencies[name];
            removed = true;
          }
          if (manifest.condu?.managedDependencies?.[name]) {
            delete manifest.condu.managedDependencies[name];
            removed = true;
          }
          if (removed) {
            dependencyStats.removed += 1;
          }
        }

        return manifest;
      },
    });
  }

  // TODO: move to respective package manager feature
  const resolutionsEntries = Object.entries(resolutions);
  if (resolutionsEntries.length > 0) {
    const packageManager = project.config.node.packageManager.name;
    // transform the resolutions into an actual package.json modification
    packageJsonModifications.push({
      targetPackage: project.workspace,
      context: { featureName: "condu:dependency-resolutions" },
      globalRegistry: collectedStateReadOnlyView,
      modifier: (manifest) => {
        const manifestResolutions =
          manifest.resolutions ??
          manifest["pnpm"]?.overrides ??
          manifest.overrides;
        if (manifestResolutions) {
          for (const [packageName, version] of resolutionsEntries) {
            if (manifestResolutions[packageName] !== version) {
              manifestResolutions[packageName] = version;
            }
          }
        } else {
          if (packageManager === "pnpm") {
            manifest["pnpm"] ??= {};
            manifest["pnpm"].overrides = resolutions;
          } else if (packageManager === "yarn") {
            manifest.resolutions = resolutions;
          } else {
            // bun and npm:
            manifest.overrides = resolutions;
          }
        }
        return manifest;
      },
    });
  }

  const touchedPackages = new Set<ConduPackageEntry>();

  for (const { targetPackage, modifier, context } of packageJsonModifications) {
    targetPackage.addModification(
      modifier,
      context,
      collectedStateReadOnlyView,
    );
    touchedPackages.add(targetPackage);
  }

  for (const {
    targetPackage,
    modifier,
    context,
  } of releasePackageJsonModifications) {
    targetPackage.addPublishedModification(
      modifier,
      context,
      collectedStateReadOnlyView,
    );
  }

  for (const pkg of touchedPackages) {
    await pkg.applyAndCommit();
  }

  return {
    dependencyStats,
    packagesTouched: touchedPackages,
  };

  // sync defined workspaces to package.json
  // TODO: this should live in pnpm/yarn feature
  // const projectGlobs = projectConventions
  //   ?.map((project) => project.glob)
  //   .sort();
  // if (
  //   projectGlobs &&
  //   (!Array.isArray(manifest.workspaces) ||
  //     !isDeepEqual((manifest.workspaces ?? []).sort(), projectGlobs))
  // ) {
  //   manifest.workspaces = projectGlobs;
  // }
}
