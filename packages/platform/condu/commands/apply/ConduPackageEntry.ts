import path from "node:path";
import type {
  CollectionContext,
  ConduReadonlyCollectedStateView,
} from "./CollectedState.js";
import type { PackageJson } from "@condu/schema-types/schemas/packageJson.gen.js";
import type { Pattern } from "ts-pattern";
import type { ConduProject } from "./ConduProject.js";
import { partition } from "remeda";
import type {
  PackageKind,
  IPackageEntry,
  ConduPackageJson,
  WriteManifestFn,
  IPackageEntryWithWriteManifest,
} from "@condu/workspace-utils/packageJsonTypes.js";
import type { PostRecipeState } from "./conduApiTypes.js";

// only properties, exclude any functions:
export type ReadonlyConduPackageEntry<KindT extends PackageKind = PackageKind> =
  {
    readonly [K in keyof ConduPackageEntry<KindT> as ConduPackageEntry<KindT>[K] extends Function
      ? never
      : K]: ConduPackageEntry<KindT>[K];
  };

export type InternalModifier = (
  pkg: ConduPackageJson,
) => ConduPackageJson | Promise<ConduPackageJson>;

export class ConduPackageEntry<KindT extends PackageKind = PackageKind>
  implements Omit<IPackageEntry, "writeProjectManifest">
{
  #manifest: ConduPackageJson;
  get manifest(): ConduPackageJson {
    return this.#manifest;
  }
  readonly kind: KindT;
  readonly name: string;
  readonly scope: string | undefined;
  readonly scopedName: string;
  readonly manifestRelPath: string;
  readonly manifestAbsPath: string;
  readonly relPath: string;
  readonly absPath: string;
  readonly #writeProjectManifest: WriteManifestFn;
  #internalModifications: InternalModifier[] = [];
  #pendingModifications: PackageJsonModification[] = [];
  #publishedModifications: PackageJsonPublishModification[] = [];
  #managedByFeatures: CollectionContext[] = [];
  #publishedManagedByFeatures: CollectionContext[] = [];

  constructor(data: IPackageEntryWithWriteManifest<KindT>) {
    this.kind = data.kind;
    this.name = data.name ?? path.basename(data.absPath);
    this.scope = data.scope;
    this.scopedName = data.scopedName;
    this.manifestRelPath = data.manifestRelPath;
    this.manifestAbsPath = data.manifestAbsPath;
    this.relPath = data.relPath;
    this.absPath = data.absPath;
    this.#writeProjectManifest = data.writeProjectManifest;
    this.#manifest = data.manifest;
  }

  addInternalModification(modifier: InternalModifier) {
    this.#internalModifications.push(modifier);
  }

  addModification(
    modifier: PackageJsonModifier,
    context: CollectionContext,
    globalRegistry: ConduReadonlyCollectedStateView,
  ) {
    this.#pendingModifications.push({ modifier, context, globalRegistry });
    this.#managedByFeatures.push(context);
  }

  addPublishedModification(
    modifier: PackageJsonPublishModifier,
    context: CollectionContext,
    globalRegistry: ConduReadonlyCollectedStateView,
  ) {
    this.#publishedModifications.push({ modifier, context, globalRegistry });
    this.#publishedManagedByFeatures.push(context);
  }

  async applyAndCommit(): Promise<void> {
    for (const { modifier, globalRegistry } of this.#pendingModifications) {
      // for now process sequentially in case the modifier does network calls
      // TODO: consider parallelizing with a cap
      this.#manifest = await modifier(this.#manifest, {
        globalRegistry,
        targetPackage: this,
      });
    }

    for (const modifier of this.#internalModifications) {
      this.#manifest = await modifier(this.#manifest);
    }

    this.#pendingModifications = [];

    await this.#writeProjectManifest(this.#manifest);
  }

  async generatePublishManifest({
    project,
    publishableSourceFiles,
  }: {
    project: ConduProject;
    publishableSourceFiles: string[];
  }): Promise<ConduPackageJson> {
    const currentManifest = this.#manifest;

    const dependencyManifestOverride = getReleaseDependencies(currentManifest);

    // omit 'directory' from publishConfig in the published package.json
    const { directory: _, ...publishConfig } =
      currentManifest.publishConfig ?? {};

    let newPackageJson: ConduPackageJson = {
      ...currentManifest,
      ...dependencyManifestOverride,
      version: currentManifest.version ?? "0.0.0",
      publishConfig: {
        access: "public",
        ...project.config.publish,
        ...publishConfig,
        // directory: getRelativePublishConfigDirectory(project, pkg),
      },
      // if we're in Github Actions, let's set the repository based on the environment vars:
      repository:
        currentManifest.repository ??
        (process.env["GITHUB_REPOSITORY"]
          ? {
              type: "git",
              url: `git+${process.env["GITHUB_SERVER_URL"]}/${process.env["GITHUB_REPOSITORY"]}.git`,
              directory: this.relPath,
            }
          : currentManifest.repository),
      // TODO: funding
      // TODO: support CJS-first projects (maybe?)
      type: "module",

      // TODO: add unpkg/browser support for cases when bundling (webpack or rollup)
      // jsdelivr, skypack

      // set all necessary fields for deployment:
      // main: "dist/index.js",
      // types: "dist/index.d.ts",
      // files: ["dist"],
      // repository: {
      //   type: "git",
      //   url: "",
      // },
    };

    // process this.#publishedModifications sequentially:
    for (const { modifier, globalRegistry, context } of this
      .#publishedModifications) {
      newPackageJson = await modifier(newPackageJson, {
        globalRegistry,
        targetPackage: this,
        publishableSourceFiles,
      });
    }

    return newPackageJson;
  }
}

export type WorkspaceRootPackage = ConduPackageEntry<"workspace">;
export type WorkspaceSubPackage = ConduPackageEntry<"package">;

export type EntrySources = Record<
  string,
  {
    types?: string;
    source?: string;
    bun?: string;
    import?: string;
    require?: string;
    default?: string;
  }
>;

/**
 * If 'publishDependencies' are defined in the package.json,
 * returns the new fields for the package.json to be published.
 */
// TODO: extract to a separate feature (builtin?)
function getReleaseDependencies(manifest: PackageJson) {
  const keepDependencies = Array.isArray(manifest["publishDependencies"])
    ? manifest["publishDependencies"]
    : undefined;
  const dependencyEntries = Object.entries(manifest.dependencies ?? {});
  const [finalDependencyEntries, removedDependencyEntries] = keepDependencies
    ? partition(dependencyEntries, ([dep]) =>
        keepDependencies.some((keepDep) =>
          keepDep.startsWith("@") ? dep.startsWith(keepDep) : dep === keepDep,
        ),
      )
    : ([dependencyEntries, []] as const);

  const dependencyManifestOverride = {
    dependencies: Object.fromEntries(finalDependencyEntries),
    // mark removed dependencies as optional peerDependencies:
    // ...(removedDependencyEntries.length > 0
    //   ? {
    //       peerDependencies: {
    //         ...manifest.peerDependencies,
    //         ...Object.fromEntries(removedDependencyEntries),
    //       },
    //       peerDependenciesMeta: {
    //         ...manifest.peerDependenciesMeta,
    //         ...Object.fromEntries(
    //           removedDependencyEntries.map(([dep]) => [
    //             dep,
    //             { optional: true },
    //           ]),
    //         ),
    //       },
    //     }
    //   : {}),
  };
  return dependencyManifestOverride;
}

export interface PackageJsonModifierMeta extends PostRecipeState {
  targetPackage: IPackageEntry;
}

export interface PackageJsonPublishModifierMeta extends PostRecipeState {
  targetPackage: IPackageEntry;
  publishableSourceFiles: string[];
}

export type PackageJsonModifier = (
  pkg: ConduPackageJson,
  { globalRegistry, targetPackage }: PackageJsonModifierMeta,
) => ConduPackageJson | Promise<ConduPackageJson>;

export type PackageJsonPublishModifier = (
  pkg: ConduPackageJson,
  {
    globalRegistry,
    targetPackage,
    publishableSourceFiles,
  }: PackageJsonPublishModifierMeta,
) => ConduPackageJson | Promise<ConduPackageJson>;

// internal type for storing pending modifications
export interface PackageJsonModification extends PostRecipeState {
  modifier: PackageJsonModifier;
  context: CollectionContext;
}

export interface PackageJsonPublishModification extends PostRecipeState {
  modifier: PackageJsonPublishModifier;
  context: CollectionContext;
}

export type MatchPackage =
  | Pattern.Pattern<ReadonlyConduPackageEntry>
  | Partial<ReadonlyConduPackageEntry>;
