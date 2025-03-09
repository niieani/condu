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
  PossibleFeatureNames,
  RecipeFunction,
  ScopedRecipeApi,
} from "./conduApiTypes.js";
import {
  type CollectedState,
  type CollectionContext,
  ConduReadonlyCollectedStateView,
  type CollectedDependency,
  type CollectionStage,
} from "./CollectedState.js";
import type { ConduProject } from "./ConduProject.js";
import {
  FileManager,
  type FileManagerOptions,
  type ModifyUserEditableFileOptions,
} from "./FileManager.js";
import type { PeerContext } from "../../extendable.js";
import { autolink } from "../../builtin-features/autolink.js";
import { UpsertMap } from "@condu/core/utils/UpsertMap.js";
import { topologicalSortFeatures } from "./topologicalSortFeatures.js";
import type { UnionToIntersection } from "type-fest";

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
  const projectLoadData = await loadConduConfigFnFromFs(options);
  const project = await loadConduProject(projectLoadData);
  if (!project) {
    return;
  }
  const collected = await collectState({ ...options, project });

  await applyAndCommitCollectedState(collected);

  return collected;
}

interface CollectStateConfig extends FileManagerOptions {
  project: ConduProject;
}

/**
 * Converts recipe functions to feature definitions
 *
 * @param feature A feature definition or recipe function
 * @returns A feature definition
 */
function mapInlineRecipeToFeature(
  feature: RecipeFunction,
): FeatureDefinition<string> {
  // TODO: maybe fallback to sha of the recipe function.toString()?
  const name =
    feature.name || `recipe-${Math.random().toString(36).slice(2, 10)}`;
  return {
    name,
    defineRecipe: feature,
    stack:
      new Error().stack?.split("\n").slice(2).join("\n") ?? import.meta.url,
  };
}

export async function collectState(
  options: CollectStateConfig,
): Promise<ProjectAndCollectedState> {
  // TODO: add a mutex file lock to prevent concurrent runs of apply
  const { project, ...fsOptions } = options;
  const { config } = project;

  // Process recipe functions into feature definitions
  const processedFeatures = config.features.map((feature) =>
    typeof feature === "function" ? mapInlineRecipeToFeature(feature) : feature,
  );

  // add autolink built-in feature if not disabled
  const features =
    config.autolink || !("autolink" in config)
      ? [
          ...processedFeatures,
          autolink(
            typeof config.autolink === "object" ? config.autolink : undefined,
          ),
        ]
      : processedFeatures;

  // Deduplicate features by name, ensuring later features override earlier ones
  const deduplicatedFeaturesMap = new Map<string, FeatureDefinition<any>>();

  for (const feature of features) {
    if (deduplicatedFeaturesMap.has(feature.name)) {
      console.warn(
        `Duplicate feature found: ${feature.name}. The first definition will be used.`,
      );
    } else {
      deduplicatedFeaturesMap.set(feature.name, feature);
    }
  }

  const deduplicatedFeatures = Array.from(deduplicatedFeaturesMap.values());

  // Topologically sort the deduplicated features
  const sortedFeatures = topologicalSortFeatures(deduplicatedFeatures);

  // Initialize the PeerContext
  let peerContext: Partial<Record<(string & {}) | keyof PeerContext, unknown>> =
    { global: config.globalPeerContext };

  // Collect initialPeerContext from features
  for (const feature of sortedFeatures) {
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
  for (const feature of sortedFeatures) {
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
  for (const feature of sortedFeatures) {
    const conduApi = createConduApi({
      project,
      collectionContext: { featureName: feature.name },
      changesCollector,
      collectedStateReadOnlyView,
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
  }

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
}: {
  project: ConduProject;
  collectionContext: CollectionContext;
  changesCollector: CollectedState;
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
}): ConduApi => ({
  project,
  root: createStateDeclarationApi({
    matchingPackages: [project.workspace],
    changesCollector,
    collectionContext,
    matchesAllWorkspacePackages: false,
    collectedStateReadOnlyView,
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
    });
  },
});

const createStateDeclarationApi = ({
  matchingPackages,
  changesCollector,
  collectionContext,
  collectedStateReadOnlyView,
  matchesAllWorkspacePackages,
}: {
  matchingPackages: readonly ConduPackageEntry[];
  changesCollector: CollectedState;
  collectionContext: CollectionContext;
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
  matchesAllWorkspacePackages: boolean;
}): ScopedRecipeApi => ({
  ignoreFile(relPath, options) {
    assertFreshCollectorState(changesCollector, collectionContext, ["fresh"]);

    for (const pkg of matchingPackages) {
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
    return this;
  },
  modifyPackageJson(modifier) {
    assertFreshCollectorState(changesCollector, collectionContext, [
      "fresh",
      "recipes-defined",
    ]);

    for (const pkg of matchingPackages) {
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
      changesCollector.tasks.push({
        targetPackage: pkg,
        taskDefinition: { name, ...task },
        context: collectionContext,
      });
    }
    return this;
  },
});

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
}: ProjectAndCollectedState) {
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
          await ensureDependencyIn(manifest, dependencyDefinition);
          noLongerManagedDependencies.delete(
            dependencyDefinition.installAsAlias ?? dependencyDefinition.name,
          );
        }

        for (const name of noLongerManagedDependencies) {
          if (manifest.dependencies?.[name]) {
            delete manifest.dependencies[name];
          }
          if (manifest.devDependencies?.[name]) {
            delete manifest.devDependencies[name];
          }
          if (manifest.peerDependencies?.[name]) {
            delete manifest.peerDependencies[name];
          }
          if (manifest.optionalDependencies?.[name]) {
            delete manifest.optionalDependencies[name];
          }
          if (manifest.condu?.managedDependencies?.[name]) {
            delete manifest.condu.managedDependencies[name];
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
