import fs from "node:fs/promises";
import path from "node:path";
import { ensureDependencyIn } from "../../ensureDependency.js";
import type {
  CollectedFileDef,
  DependencyDef,
  Hooks,
  StateFlags,
  LoadConfigOptions,
  MatchPackage,
  WorkspaceSubPackage,
} from "@condu/types/configTypes.js";
import { groupBy, isDeepEqual, partition } from "remeda";
import { loadConduProject } from "../../loadProject.js";
import { nonEmpty } from "@condu/core/utils/filter.js";
import { isMatching } from "ts-pattern";
import {
  FILE_STATE_PATH,
  readPreviouslyWrittenFileCache,
  writeFiles,
  type FilesJsonCacheFileVersion1,
  type WrittenFile,
} from "./readWrite.js";
import { autolink } from "../../builtin-features/autolink.js";

import {
  type FeatureDefinition,
  type PeerContext,
  type ConduApi,
  type CollectedState,
  type GetPeerContext,
  type StateDeclarationApi,
  type ModifyUserEditableFileOptions,
  type GenerateFileOptions,
  type ResolvedSerializedType,
  type ModifyGeneratedFileOptions,
  type CollectionContext,
  FileManager,
  type ConduProject,
  type ConduPackageEntry,
  ConduCollectedDataPublicApi,
} from "@condu/cli/commands/apply/applyTypes.js";

// Helper function to topologically sort features based on 'after' dependencies
function topologicalSortFeatures(
  features: FeatureDefinition[],
): FeatureDefinition[] {
  const [featuresToRunAtTheEnd, remainingFeatures] = partition(
    features,
    (f) => f.after === "*",
  );

  const sortedFeatures = topologicalSortFeaturesInternal(remainingFeatures);

  return [...sortedFeatures, ...featuresToRunAtTheEnd];
}

function topologicalSortFeaturesInternal(
  features: FeatureDefinition[],
): FeatureDefinition[] {
  // Build a dependency graph
  const graph = new Map<string, Set<string>>(); // feature name -> set of features it depends on

  // First, initialize graph with all features
  for (const feature of features) {
    graph.set(feature.name, new Set());
  }

  // Build the dependency edges
  for (const feature of features) {
    let after = feature.after;
    if (!after) continue;

    let dependencies: string[];
    if (typeof after === "string") {
      dependencies = [after];
    } else {
      dependencies = after;
    }

    for (const dep of dependencies) {
      if (!graph.has(dep)) {
        throw new Error(
          `Feature ${feature.name} depends on unknown feature ${dep}`,
        );
      }
      graph.get(feature.name)!.add(dep);
    }
  }

  // Now, perform topological sort
  const sorted: FeatureDefinition[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (temp.has(name)) {
      throw new Error("Circular dependency detected in features");
    }
    temp.add(name);
    const deps = graph.get(name)!;
    for (const dep of deps) {
      visit(dep);
    }
    temp.delete(name);
    visited.add(name);
    const feature = features.find((f) => f.name === name)!;
    sorted.push(feature);
  }

  for (const feature of features) {
    visit(feature.name);
  }

  return sorted;
}

export async function apply(options: LoadConfigOptions = {}) {
  // TODO: add a mutex file lock to prevent concurrent runs of apply
  const { throwOnManualChanges } = options;
  const project = await loadConduProject(options);
  if (!project) {
    return;
  }

  const { manifest, config, projectConventions } = project;

  // add autolink built-in feature if not disabled
  const features =
    config.autolink || !("autolink" in config)
      ? [
          ...config.features,
          autolink(
            typeof config.autolink === "object" ? config.autolink : undefined,
          ),
        ]
      : config.features;

  // Topologically sort the features
  const sortedFeatures = topologicalSortFeatures(features);

  // Initialize the PeerContext
  let peerContext: Record<string, unknown> = {};

  // Collect initialPeerContext from features
  for (const feature of sortedFeatures) {
    if ("initialPeerContext" in feature && feature.initialPeerContext) {
      peerContext[feature.name] = feature.initialPeerContext;
    }
  }

  // Run mergePeerContext functions
  for (const feature of sortedFeatures) {
    if (feature.mergePeerContext) {
      const reducers = await feature.mergePeerContext(project);
      for (const [key, reducer] of Object.entries(reducers)) {
        // any as this is impossible to type correctly
        peerContext[key] = await reducer(peerContext[key] as any);
      }
    }
  }

  const fileManager = new FileManager(
    project.workspace,
    project.workspacePackages,
  );

  // Create the object to collect changes
  const changes: CollectedState = {
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
      collectionContext: {
        featureName: feature.name,
      },
      changesCollector: changes,
    });

    await feature.defineRecipe(
      conduApi,
      peerContext[feature.name] as PeerContext[keyof PeerContext],
    );
  }

  // Now process the collected changes
  await applyCollectedChanges(changes, project);
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
  root: createStateDeclarationApi({
    matchingPackages: [project.workspace],
    changesCollector,
    collectionContext,
  }),
  packages: project.allPackages,
  with(criteria: MatchPackage): StateDeclarationApi {
    const matchPackageFn = isMatching(criteria);
    const matchAllPackages =
      Object.keys(criteria).length === 1 &&
      "kind" in criteria &&
      criteria.kind === "package";

    // TODO: check if any packages matched and maybe add a warning if zero matches?
    const matchingPackages = matchAllPackages
      ? project.workspacePackages
      : project.allPackages.filter((pkg) => matchPackageFn(pkg));

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

async function applyCollectedChanges(
  changes: CollectedState,
  project: ConduProject,
) {
  const collectedDataApi = new ConduCollectedDataPublicApi(changes);
  const {
    fileManager,
    dependencies,
    resolutions,
    packageJsonModifications,
    releasePackageJsonModifications,
  } = changes;
  // we can delay loading cache until before fileManager.applyAllFiles
  // that way we can speed up the process by not reading cache if we only want publishing changes
  await fileManager.readCache();
  // compute the content and write any changes to file system
  await fileManager.applyAllFiles(collectedDataApi);

  for (const { dependencyDefinition, targetPackage, context } of dependencies) {
    // transform the dependency definitions into actual package.json modifications
    packageJsonModifications.push({
      targetPackage,
      modifier: async (manifest) => {
        // TODO maybe return a list of changes instead of mutating? immutability-helper style?
        await ensureDependencyIn(manifest, dependencyDefinition);
        return manifest;
      },
      context,
    });
  }

  // TODO: move to respective package manager feature
  if (Object.keys(resolutions).length > 0) {
    // transform the resolutions into actual package.json modifications
    packageJsonModifications.push({
      targetPackage: project.workspace,
      modifier: (manifest) => ({
        ...manifest,
        resolutions: {
          ...manifest.resolutions,
          ...resolutions,
        },
      }),
      context: { featureName: "builtin:dependency-resolutions" },
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
    touchedPackages.add(targetPackage);
  }

  for (const pkg of touchedPackages) {
    await pkg.applyAndCommit();
  }

  // sync defined workspaces to package.json
  // TODO: maybe this could live in pnpm/yarn feature instead?
  // let didChangeManifest = false;
  // const projectGlobs = projectConventions
  //   ?.map((project) => project.glob)
  //   .sort();
  // if (
  //   projectGlobs &&
  //   (!Array.isArray(manifest.workspaces) ||
  //     !isDeepEqual((manifest.workspaces ?? []).sort(), projectGlobs))
  // ) {
  //   manifest.workspaces = projectGlobs;
  //   didChangeManifest = true;
  // }
}
