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

import type {
  FeatureDefinition,
  PeerContext,
  Condu,
  ChangesCollector,
  GetPeerContext,
} from "@condu/types/applyTypes.js";

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

  let didChangeManifest = false;

  const projectGlobs = projectConventions
    ?.map((project) => project.glob)
    .sort();

  // sync defined workspaces to package.json
  // TODO: maybe this could live in pnpm/yarn feature instead?
  if (
    projectGlobs &&
    (!Array.isArray(manifest.workspaces) ||
      !isDeepEqual((manifest.workspaces ?? []).sort(), projectGlobs))
  ) {
    manifest.workspaces = projectGlobs;
    didChangeManifest = true;
  }

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
  let peerContext = {} as PeerContext;

  // Collect initialPeerContext from features
  for (const feature of sortedFeatures) {
    if ("initialPeerContext" in feature && feature.initialPeerContext) {
      peerContext[feature.name as "condu"] =
        feature.initialPeerContext as GetPeerContext<"condu">;
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
        const currentValue = peerContext[key as keyof PeerContext];
        const newValue = await reducer(currentValue);
        peerContext[key] = newValue;
      }
    }
  }

  // Create the Condu object to collect changes
  const condu = await createCondu(project);

  // Run apply functions
  for (const feature of sortedFeatures) {
    await feature.apply(condu, peerContext[feature.name]);
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

async function createCondu(project: Project): Promise<Condu> {
  const packages = [project, ...(await project.getWorkspacePackages())];
  const changes: ChangesCollector = {
    files: [],
    dependencies: [],
    resolutions: {},
    packageJsonModifications: [],
    releasePackageJsonModifications: [],
  };

  const condu: Condu = {
    config: project.config,
    root: createPackageCondu([project], changes),
    packages,
    changes,
    with(criteria: PackageCriteria): PackageCondu {
      const matchingPackages = packages.filter((pkg) => {
        if (criteria.name && pkg.name !== criteria.name) return false;
        if (criteria.kind && pkg.kind !== criteria.kind) return false;
        return true;
      });
      return createPackageCondu(matchingPackages, changes);
    },
  };

  return condu;
}

function createPackageCondu(
  pkgs: WorkspacePackage[],
  changes: ChangesCollector,
): PackageCondu {
  return {
    createManagedFile(path, options) {
      for (const pkg of pkgs) {
        changes.files.push({
          pkg,
          path,
          type: "createManagedFile",
          options,
        });
      }
    },
    modifyManagedFile(path, options) {
      for (const pkg of pkgs) {
        changes.files.push({
          pkg,
          path,
          type: "modifyManagedFile",
          options,
        });
      }
    },
    modifyUserEditableFile(path, options) {
      for (const pkg of pkgs) {
        changes.files.push({
          pkg,
          path,
          type: "modifyUserEditableFile",
          options,
        });
      }
    },
    addManagedDevDependency(dependency) {
      for (const pkg of pkgs) {
        changes.dependencies.push({
          pkg,
          dependency,
          type: "dev",
        });
      }
    },
    addManagedDependency(dependency) {
      for (const pkg of pkgs) {
        changes.dependencies.push({
          pkg,
          dependency,
          type: "prod",
        });
      }
    },
    setDependencyResolutions(resolutions) {
      Object.assign(changes.resolutions, resolutions);
    },
    mergePackageJson(modifier) {
      for (const pkg of pkgs) {
        changes.packageJsonModifications.push({
          pkg,
          modifier,
          type: "normal",
        });
      }
    },
    mergeReleasePackageJson(modifier) {
      for (const pkg of pkgs) {
        changes.releasePackageJsonModifications.push({
          pkg,
          modifier,
        });
      }
    },
  };
}

async function processCollectedChanges(condu: Condu) {
  const { changes } = condu;

  // Process files
  // Group file changes by package and path
  const filesByPackageAndPath = new Map<
    string,
    Map<string, CollectedFileChange[]>
  >();

  for (const fileChange of changes.files) {
    const pkgName = fileChange.pkg.name;
    let pkgFiles = filesByPackageAndPath.get(pkgName);
    if (!pkgFiles) {
      pkgFiles = new Map();
      filesByPackageAndPath.set(pkgName, pkgFiles);
    }
    let fileChanges = pkgFiles.get(fileChange.path);
    if (!fileChanges) {
      fileChanges = [];
      pkgFiles.set(fileChange.path, fileChanges);
    }
    fileChanges.push(fileChange);
  }

  // For each package and file, process the collected changes
  for (const [pkgName, pkgFiles] of filesByPackageAndPath.entries()) {
    const pkg = condu.packages.find((p) => p.name === pkgName)!;

    for (const [filePath, fileChanges] of pkgFiles.entries()) {
      // Process the file changes
      await processFileChanges(pkg, filePath, fileChanges);
    }
  }

  // Process dependencies
  // Group dependencies by package
  const dependenciesByPackage = new Map<string, CollectedDependency[]>();
  for (const dep of changes.dependencies) {
    const pkgName = dep.pkg.name;
    let deps = dependenciesByPackage.get(pkgName);
    if (!deps) {
      deps = [];
      dependenciesByPackage.set(pkgName, deps);
    }
    deps.push(dep);
  }

  for (const [pkgName, deps] of dependenciesByPackage.entries()) {
    const pkg = condu.packages.find((p) => p.name === pkgName)!;
    await processDependencies(pkg, deps);
  }

  // Process resolutions
  // Assuming resolutions are global
  if (Object.keys(changes.resolutions).length > 0) {
    await processResolutions(condu, changes.resolutions);
  }

  // Process package.json modifications
  for (const mod of changes.packageJsonModifications) {
    await processPackageJsonModification(mod);
  }

  // Process releasePackageJson modifications
  for (const mod of changes.releasePackageJsonModifications) {
    await processReleasePackageJsonModification(mod);
  }
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
