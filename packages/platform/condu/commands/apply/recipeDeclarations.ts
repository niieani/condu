import path from "node:path";
import { isMatching } from "ts-pattern";
import type { ConduReporter } from "../../reporter/ConduReporter.js";
import type { ConduPackageEntry } from "./ConduPackageEntry.js";
import type { ConduProject } from "./ConduProject.js";
import type { ConduApi, ScopedRecipeApi } from "./conduApiTypes.js";
import type {
  CollectedState,
  CollectionContext,
  CollectionStage,
  DependencyDefinitionInput,
  ConduReadonlyCollectedStateView,
} from "./CollectedState.js";
import type { ModifyUserEditableFileOptions } from "./fileTypes.js";

export const createConduApi = ({
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
  reporter: ConduReporter;
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
  reporter: ConduReporter;
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
        message: `Ensuring dependency ${name}${describeDependencyVersion(dependencyDef)} in ${formatPackageTarget(pkg)} (${dependencyDef?.list ?? "devDependencies"})`,
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
  pkg.kind === "workspace" ? relPath : path.join(pkg.relPath, relPath);

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
  reporter: ConduReporter;
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
