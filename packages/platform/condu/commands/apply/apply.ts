import { createConduApi } from "./recipeDeclarations.js";
import { reconcileDependencies } from "./reconcileDependencies.js";
import type { LoadConfigOptions } from "../../api/configTypes.js";
import type { ConduPackageEntry } from "./ConduPackageEntry.js";
import {
  loadConduConfigFnFromFs,
  loadConduProject,
} from "../../loadProject.js";
import type {
  ConduApi,
  FeatureDefinition,
  PeerContextReducer,
} from "./conduApiTypes.js";
import {
  type CollectedState,
  ConduReadonlyCollectedStateView,
  type CollectedDependency,
} from "./CollectedState.js";
import type { ConduProject } from "./ConduProject.js";
import { FileManager, type FileManagerOptions } from "./FileManager.js";
import type { PeerContext } from "../../extendable.js";
import type { UnionToIntersection } from "type-fest";
import { ConduReporter } from "../../reporter/ConduReporter.js";

export interface ProjectAndCollectedState {
  project: ConduProject;
  collectedState: CollectedState;
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
}

type AllPossiblePeerContexts = UnionToIntersection<
  PeerContext[keyof PeerContext]
>;

export async function apply({
  reporter: suppliedReporter,
  ...options
}: LoadConfigOptions & { reporter?: ConduReporter } = {}): Promise<
  ProjectAndCollectedState | undefined
> {
  using reporter = suppliedReporter ?? new ConduReporter();
  const startTime = Date.now();

  try {
    reporter.startPhase("loading");

    const projectLoadData = await loadConduConfigFnFromFs(options);
    const project = await loadConduProject(projectLoadData);
    if (!project) {
      reporter.endPhase("loading", { success: false });
      reporter.stopSpinner();
      return;
    }

    const featureCount = project.config.features.length;
    if (reporter.getMode() !== "ci" || reporter.getVerbosity() === "verbose") {
      reporter.success(`Found ${featureCount} features to apply`);
    }
    reporter.endPhase("loading", { success: true });

    const collected = await collectState({ ...options, project, reporter });

    reporter.endPhase("collecting", { success: true });

    const applyResult = await applyAndCommitCollectedState(collected);

    // Print summary
    reporter.startPhase("complete");
    const duration = Date.now() - startTime;

    const { packagesTouched, ...fileSummary } =
      collected.collectedState.fileManager.getSummary();
    for (const pkg of applyResult.packagesTouched)
      packagesTouched.add(pkg.relPath);
    const noChanges =
      fileSummary.filesChanged === 0 &&
      fileSummary.filesNeedingReview === 0 &&
      packagesTouched.size === 0 &&
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
      ...fileSummary,
      packagesModified: packagesTouched.size,
      depsEvaluated: applyResult.dependencyStats.evaluated,
      depsChanged: applyResult.dependencyStats.changed,
      depsUnchanged:
        applyResult.dependencyStats.evaluated -
        applyResult.dependencyStats.changed,
      depsRemoved: applyResult.dependencyStats.removed,
      duration,
      errors: [],
      warnings: [],
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
  reporter: ConduReporter;
  project: ConduProject;
}

export async function collectState(
  options: CollectStateConfig,
): Promise<ProjectAndCollectedState> {
  const { reporter } = options;

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
    evaluated: new Set(
      dependencies.map(({ targetPackage, dependencyDefinition }) =>
        JSON.stringify([
          targetPackage.manifestAbsPath,
          dependencyDefinition.installAsAlias ?? dependencyDefinition.name,
        ]),
      ),
    ).size,
    changed: 0,
    removed: 0,
  };

  // Manifest paths identify packages even when a workspace proxy is used.
  const dependenciesByPackage = new Map<
    string,
    { targetPackage: ConduPackageEntry; dependencies: CollectedDependency[] }
  >();
  for (const targetPackage of [project.workspace, ...project.allPackages]) {
    if (!dependenciesByPackage.has(targetPackage.manifestAbsPath)) {
      dependenciesByPackage.set(targetPackage.manifestAbsPath, {
        targetPackage,
        dependencies: [],
      });
    }
  }
  for (const dependency of dependencies) {
    const key = dependency.targetPackage.manifestAbsPath;
    let group = dependenciesByPackage.get(key);
    if (!group) {
      group = { targetPackage: dependency.targetPackage, dependencies: [] };
      dependenciesByPackage.set(key, group);
    }
    group.dependencies.push(dependency);
  }

  // Run after feature modifiers, which may change previous ownership metadata.
  for (const {
    targetPackage,
    dependencies: desired,
  } of dependenciesByPackage.values()) {
    packageJsonModifications.push({
      targetPackage,
      context: { featureName: "condu:dependencies" },
      globalRegistry: collectedStateReadOnlyView,
      modifier: async (manifest) => {
        const result = await reconcileDependencies({
          manifest,
          dependencies: desired.map(
            ({ dependencyDefinition }) => dependencyDefinition,
          ),
        });
        dependencyStats.changed += result.stats.changed;
        dependencyStats.removed += result.stats.removed;
        return result.manifest;
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
    if (!(await pkg.applyAndCommit())) touchedPackages.delete(pkg);
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
