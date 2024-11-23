import fs from "node:fs/promises";
import path from "node:path";
import { ensureDependency } from "../../ensureDependency.js";
import type {
  CollectedFileDef,
  CollectedState,
  DependencyDef,
  Hooks,
  ConduConfigWithInferredValuesAndProject,
  StateFlags,
  WorkspacePackage,
  LoadConfigOptions,
  Project,
  MatchPackage,
  WorkspaceSubPackage,
} from "@condu/types/configTypes.js";
import { groupBy, isDeepEqual } from "remeda";
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
  type Condu,
  type ChangesCollector,
  type GetPeerContext,
  type PackageCondu,
  type ModifyUserEditableFileOptions,
  type GenerateFileOptions,
  type ResolvedSerializedType,
  type ModifyGeneratedFileOptions,
  type CollectionContext,
  FileManager,
} from "@condu/cli/commands/apply/applyTypes.js";

export async function apply(options: LoadConfigOptions = {}) {
  // TODO: add a mutex file lock to prevent concurrent runs of apply
  const { throwOnManualChanges } = options;
  const project = await loadConduProject(options);
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

  // TODO: project already has config, we can improve this type
  const configAndProject = {
    ...config,
    project,
  };

  // Run mergePeerContext functions
  for (const feature of sortedFeatures) {
    if (feature.mergePeerContext) {
      const reducers = await feature.mergePeerContext(configAndProject);
      for (const [key, reducer] of Object.entries(reducers)) {
        // any as this is impossible to type correctly
        peerContext[key] = await reducer(peerContext[key] as any);
      }
    }
  }

  const fileManager = new FileManager(project, project.workspacePackages);

  // Create the object to collect changes
  const changes: ChangesCollector = {
    fileManager,
    dependencies: [],
    resolutions: {},
    packageJsonModifications: [],
    releasePackageJsonModifications: [],
  };

  // Run apply functions in topological order
  for (const feature of sortedFeatures) {
    const collectionContext = {
      featureName: feature.name,
    };

    await feature.apply(
      createConduApi({
        project,
        collectionContext,
        changesCollector: changes,
      }),
      peerContext[feature.name] as PeerContext[keyof PeerContext],
    );
  }

  // Now process the collected changes
  await processCollectedChanges(changes);
}

// Helper function to topologically sort features based on 'after' dependencies
function topologicalSortFeatures(
  features: FeatureDefinition[],
): FeatureDefinition[] {
  const nonStarFeatures = features.filter((f) => f.after !== "*");
  const starFeatures = features.filter((f) => f.after === "*");

  const sortedNonStarFeatures =
    topologicalSortFeaturesInternal(nonStarFeatures);

  const sortedStarFeatures = topologicalSortFeaturesInternal(starFeatures);

  return [...sortedNonStarFeatures, ...sortedStarFeatures];
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

function createConduApi({
  project,
  collectionContext,
  changesCollector,
}: {
  project: Project;
  collectionContext: CollectionContext;
  changesCollector: ChangesCollector;
}): Condu {
  const packages = [project, ...project.workspacePackages];

  const condu: Condu = {
    config: { ...project.config, project },
    root: createGenerationApi({
      matchingPackages: [project],
      changesCollector,
      collectionContext,
    }),
    packages,
    with(criteria: MatchPackage): PackageCondu {
      const matchPackageFn = isMatching(criteria);
      const matchAllPackages =
        Object.keys(criteria).length === 1 &&
        "kind" in criteria &&
        criteria.kind === "package";

      // TODO: check if any packages matched and maybe add a warning if zero matches?
      const matchingPackages = matchAllPackages
        ? workspacePackages
        : packages.filter((pkg) => matchPackageFn(pkg));

      return createGenerationApi({
        matchingPackages,
        changesCollector,
        collectionContext,
      });
    },
  };

  return condu;
}

function createGenerationApi({
  matchingPackages,
  changesCollector,
  collectionContext,
}: {
  matchingPackages: readonly WorkspacePackage[];
  changesCollector: ChangesCollector;
  collectionContext: CollectionContext;
}): PackageCondu {
  return {
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
          .setInitialContent(options, collectionContext);
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
    addManagedDevDependency(dependency) {
      for (const pkg of matchingPackages) {
        changesCollector.dependencies.push({
          pkg,
          dependency,
          type: "dev",
        });
      }
    },
    addManagedDependency(dependency) {
      for (const pkg of matchingPackages) {
        changesCollector.dependencies.push({
          pkg,
          dependency,
          type: "prod",
        });
      }
    },
    setDependencyResolutions(resolutions) {
      Object.assign(changesCollector.resolutions, resolutions);
    },
    mergePackageJson(modifier) {
      for (const pkg of matchingPackages) {
        changesCollector.packageJsonModifications.push({
          pkg,
          modifier,
        });
      }
    },
    mergeReleasePackageJson(modifier) {
      for (const pkg of matchingPackages) {
        changesCollector.releasePackageJsonModifications.push({
          pkg,
          modifier,
        });
      }
    },
  };
}

async function processCollectedChanges(changes: ChangesCollector) {
  // TODO
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

async function processFileChanges(
  pkg: WorkspacePackage,
  filePath: string,
  fileChanges: CollectedFileChange[],
) {
  let content: string | undefined;
  let exists = false;

  const absolutePath = path.join(pkg.absPath, filePath);

  try {
    content = await fs.readFile(absolutePath, "utf8");
    exists = true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  for (const change of fileChanges) {
    if (change.type === "createManagedFile") {
      if (exists) {
        console.warn(
          `File ${filePath} in package ${pkg.name} already exists, skipping creation.`,
        );
      } else {
        const options = change.options as CreateManagedFileOptions;
        if (typeof options.content === "function") {
          content = options.content(pkg.manifest);
        } else {
          content = options.content;
        }
        await fs.writeFile(absolutePath, content, "utf8");
        exists = true;
      }
    } else if (change.type === "modifyManagedFile") {
      if (!exists && change.options.ifNotCreated === "error") {
        throw new Error(
          `File ${filePath} in package ${pkg.name} does not exist.`,
        );
      }
      if (!exists && change.options.ifNotCreated === "create") {
        content = "";
        exists = true;
      }
      if (exists) {
        const options = change.options as ModifyManagedFileOptions;
        content = options.content(content || "", pkg.manifest);
        await fs.writeFile(absolutePath, content, "utf8");
      }
    } else if (change.type === "modifyUserEditableFile") {
      const options = change.options as ModifyUserEditableFileOptions;
      if (!exists && options.createIfNotExists !== false) {
        content = "";
        exists = true;
      }
      if (exists) {
        content = options.content(content || "", pkg.manifest);
        await fs.writeFile(absolutePath, content, "utf8");
      }
    }
  }
}

async function processDependencies(
  pkg: WorkspacePackage,
  deps: CollectedDependency[],
) {
  let manifestChanged = false;

  for (const dep of deps) {
    const dependenciesKey =
      dep.type === "dev" ? "devDependencies" : "dependencies";
    pkg.manifest[dependenciesKey] = pkg.manifest[dependenciesKey] || {};
    if (!pkg.manifest[dependenciesKey][dep.dependency]) {
      pkg.manifest[dependenciesKey][dep.dependency] = "latest"; // Or a specific version
      manifestChanged = true;
    }
  }

  if (manifestChanged) {
    await writePackageManifest(pkg);
  }
}

async function processResolutions(
  condu: Condu,
  resolutions: Record<string, string>,
) {
  // Assuming resolutions are applied to the root package
  const rootPkg = condu.packages.find((p) => p.kind === "workspace");
  if (!rootPkg) return;

  rootPkg.manifest.resolutions = {
    ...(rootPkg.manifest.resolutions || {}),
    ...resolutions,
  };

  await writePackageManifest(rootPkg);
}

async function processPackageJsonModification(mod: PackageJsonModification) {
  const pkg = mod.pkg;
  const newManifest = mod.modifier(pkg.manifest);
  pkg.manifest = newManifest;
  await writePackageManifest(pkg);
}

async function processReleasePackageJsonModification(
  mod: PackageJsonModification,
) {
  const pkg = mod.pkg;
  // Assuming release manifest is handled separately
  const newManifest = mod.modifier(pkg.manifest);
  // Handle release manifest
}

async function writePackageManifest(pkg: WorkspacePackage) {
  const manifestPath = path.join(pkg.absPath, "package.json");
  const content = JSON.stringify(pkg.manifest, null, 2) + "\n";
  await fs.writeFile(manifestPath, content, "utf8");
}
