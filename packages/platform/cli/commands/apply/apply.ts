import { ensureDependencyIn } from "../../ensureDependency.js";
import type { LoadConfigOptions } from "@condu/types/configTypes.js";
import type { ConduPackageEntry } from "./ConduPackageEntry.js";
import { loadConduProject } from "../../loadProject.js";
import { isMatching } from "ts-pattern";
import type {
  ConduApi,
  FeatureDefinition,
  StateDeclarationApi,
} from "./conduApi.js";
import {
  type CollectedState,
  type CollectionContext,
  ConduCollectedStatePublicApi,
  type CollectedDependency,
} from "./CollectedState.js";
import type { ConduProject } from "./ConduProject.js";
import { FileManager } from "./FileManager.js";
import type {
  GlobalPeerContext,
  PeerContext,
} from "../../../types/extendable.js";
import { autolink } from "../../builtin-features/autolink.js";
import { UpsertMap } from "@condu/core/utils/UpsertMap.js";
import { topologicalSortFeatures } from "./topologicalSortFeatures.js";

export interface ProjectAndCollectedState {
  project: ConduProject;
  collectedState: CollectedState;
}

export async function apply(
  options: LoadConfigOptions = {},
): Promise<ProjectAndCollectedState | undefined> {
  const collected = await collectState(options);
  if (!collected) {
    return;
  }

  await applyAndCommitCollectedState(collected);

  return collected;
}

export async function collectState(
  options: LoadConfigOptions = {},
): Promise<ProjectAndCollectedState | undefined> {
  // TODO: add a mutex file lock to prevent concurrent runs of apply
  const { throwOnManualChanges } = options;
  const project = await loadConduProject(options);
  if (!project) {
    return;
  }

  const { config } = project;

  // add autolink built-in feature if not disabled
  const features: FeatureDefinition<any>[] =
    config.autolink || !("autolink" in config)
      ? [
          ...config.features,
          autolink(
            typeof config.autolink === "object" ? config.autolink : undefined,
          ),
        ]
      : config.features;

  // Deduplicate features by name, ensuring later features override earlier ones
  const deduplicatedFeaturesMap = new Map<string, FeatureDefinition<any>>();

  features.forEach((feature) => {
    if (deduplicatedFeaturesMap.has(feature.name)) {
      console.warn(
        `Duplicate feature found: ${feature.name}. The first definition will be used.`,
      );
    } else {
      deduplicatedFeaturesMap.set(feature.name, feature);
    }
  });

  const deduplicatedFeatures = Array.from(deduplicatedFeaturesMap.values());

  // Topologically sort the deduplicated features
  const sortedFeatures = topologicalSortFeatures(deduplicatedFeatures);

  // Initialize the PeerContext
  let peerContext: Partial<Record<(string & {}) | keyof PeerContext, unknown>> =
    {
      global: config.globalPeerContext,
    };

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

  // Run mergePeerContext functions
  for (const feature of sortedFeatures) {
    if (feature.modifyPeerContexts) {
      const reducers = await feature.modifyPeerContexts(
        project,
        peerContext[feature.name] as PeerContext[keyof PeerContext],
      );
      for (const [key, reducer] of Object.entries(reducers)) {
        // `any`, as this is impossible to type correctly
        peerContext[key] = await reducer(peerContext[key] as any);
      }
    }
  }

  const fileManager = new FileManager(
    project.workspace,
    project.workspacePackages,
  );

  // Create the object to collect changes
  const changesCollector: CollectedState = {
    fileManager,
    dependencies: [],
    resolutions: {},
    packageJsonModifications: [],
    releasePackageJsonModifications: [],
    tasks: [],
  };

  // Run apply functions in topological order
  for (const feature of sortedFeatures) {
    const conduApi = createConduApi({
      project,
      collectionContext: { featureName: feature.name },
      changesCollector,
    });

    await feature.defineRecipe(
      conduApi,
      peerContext[feature.name] as PeerContext[keyof PeerContext],
    );
  }
  return { collectedState: changesCollector, project };
}

const createConduApi = ({
  project,
  collectionContext,
  changesCollector,
}: {
  project: ConduProject;
  collectionContext: CollectionContext;
  changesCollector: CollectedState;
}): ConduApi => ({
  project,
  inRoot: createStateDeclarationApi({
    matchingPackages: [project.workspace],
    changesCollector,
    collectionContext,
  }),
  in(criteria) {
    const matchPackageFn = isMatching(criteria);
    const matchAllPackages =
      Object.keys(criteria).length === 1 &&
      "kind" in criteria &&
      criteria.kind === "package";

    // TODO: check if any packages matched and maybe add a warning if zero matches?
    const matchingPackages = matchAllPackages
      ? project.workspacePackages
      : project.allPackages.filter((pkg) => matchPackageFn(pkg));

    // TODO: when matching all packages, we can optimize the gitignore output
    // by using the project.projectConventions[*].glob instead of the package's path

    return createStateDeclarationApi({
      matchingPackages,
      changesCollector,
      collectionContext,
    });
  },
});

const createStateDeclarationApi = ({
  matchingPackages,
  changesCollector,
  collectionContext,
}: {
  matchingPackages: readonly ConduPackageEntry[];
  changesCollector: CollectedState;
  collectionContext: CollectionContext;
}): StateDeclarationApi => ({
  ignoreFile(relPath, options) {
    for (const pkg of matchingPackages) {
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .updateIgnores(options ?? {}, collectionContext);
    }
  },
  generateFile(relPath, options) {
    for (const pkg of matchingPackages) {
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .defineInitialContent(options, collectionContext);
    }
  },
  modifyGeneratedFile(relPath, options) {
    for (const pkg of matchingPackages) {
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .addModification(options, collectionContext);
    }
  },
  modifyUserEditableFile(relPath, options) {
    for (const pkg of matchingPackages) {
      changesCollector.fileManager
        .manageFile({
          targetPackage: pkg,
          relPath,
        })
        .addUserEditableModification(options, collectionContext);
    }
  },
  addManagedDependency(dependencyDef) {
    for (const pkg of matchingPackages) {
      changesCollector.dependencies.push({
        targetPackage: pkg,
        dependencyDefinition: dependencyDef,
        context: collectionContext,
      });
    }
  },
  setDependencyResolutions(resolutions) {
    Object.assign(changesCollector.resolutions, resolutions);
  },
  modifyPackageJson(modifier) {
    for (const pkg of matchingPackages) {
      changesCollector.packageJsonModifications.push({
        targetPackage: pkg,
        modifier,
        context: collectionContext,
      });
      // pkg.addModification(modifier, collectionContext);
    }
  },
  modifyPublishedPackageJson(modifier) {
    for (const pkg of matchingPackages) {
      changesCollector.releasePackageJsonModifications.push({
        targetPackage: pkg,
        modifier,
        context: collectionContext,
      });
      // pkg.addPublishedModification(modifier, collectionContext);
    }
  },
  defineTask(task) {
    for (const pkg of matchingPackages) {
      changesCollector.tasks.push({
        targetPackage: pkg,
        taskDefinition: task,
        context: collectionContext,
      });
    }
  },
});

async function applyAndCommitCollectedState({
  collectedState,
  project,
}: ProjectAndCollectedState) {
  const collectedDataApi = new ConduCollectedStatePublicApi(collectedState);
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
  await fileManager.applyAllFiles(collectedDataApi);

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
    targetPackage.addModification(modifier, context);
    touchedPackages.add(targetPackage);
  }

  for (const {
    targetPackage,
    modifier,
    context,
  } of releasePackageJsonModifications) {
    targetPackage.addPublishedModification(modifier, context);
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
