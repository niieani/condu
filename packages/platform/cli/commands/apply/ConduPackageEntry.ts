import type { WriteManifestFn } from "@condu/types/configTypes.js";
import path from "node:path";
import type {
  CollectionContext,
  DependencyTargetList,
} from "./CollectedState.js";
import type {
  PackageExportsEntryObject,
  PackageJson,
} from "@condu/schema-types/schemas/packageJson.gen.js";
import type { PartialProjectConfig } from "@moonrepo/types";
import type { ProjectManifest } from "@pnpm/types";
import type { Pattern } from "ts-pattern";
import type { ConduProject } from "./ConduProject.js";
import { partition } from "remeda";

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
  #pendingModifications: PackageJsonModification[] = [];
  #publishedModifications: PackageJsonModification[] = [];
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

  addModification(modifier: PackageJsonModifier, context: CollectionContext) {
    this.#pendingModifications.push({ modifier, context });
    this.#managedByFeatures.push(context);
  }

  addPublishedModification(
    modifier: PackageJsonModifier,
    context: CollectionContext,
  ) {
    this.#publishedModifications.push({ modifier, context });
    this.#publishedManagedByFeatures.push(context);
  }

  async applyAndCommit(): Promise<void> {
    for (const { modifier } of this.#pendingModifications) {
      // for now process sequentially in case the modifier does network calls
      // TODO: consider parallelizing with a cap
      this.#manifest = await modifier(this.#manifest);
    }

    this.#pendingModifications = [];

    await this.#writeProjectManifest(this.#manifest);
  }

  async generatePublishManifest({
    entrySources,
    project,
  }: {
    entrySources: EntrySources;
    project: ConduProject;
  }): Promise<ConduPackageJson> {
    let publishManifest = this.#manifest;

    const dependencyManifestOverride = getReleaseDependencies(publishManifest);

    // omit 'directory' from publishConfig in the published package.json
    const { directory: _, ...publishConfig } =
      publishManifest.publishConfig ?? {};

    const newPackageJson: ConduPackageJson = {
      ...publishManifest,
      ...dependencyManifestOverride,
      version: publishManifest.version ?? "0.0.0",
      publishConfig: {
        access: "public",
        ...project.config.publish,
        ...publishConfig,
        // directory: getRelativePublishConfigDirectory(project, pkg),
      },
      exports: {
        ...entrySources,
        "./*.json": "./*.json",
        "./*.js": {
          // types: `./*.d.ts`,
          bun: `./*.ts`,
          import: `./*.js`,
          require: `./*.cjs`,
          default: `./*.js`,
        },
        ...(typeof publishManifest.exports === "object"
          ? publishManifest.exports
          : {}),
      },
      main: entrySources["."]?.require,
      module: entrySources["."]?.import,
      source: entrySources["."]?.source,
      // ensure there's a scripts field so npm doesn't complain with a warning about an invalid package.json
      scripts: publishManifest.scripts ?? {},
      // NOTE: types is unnecessary because of adjacent .d.ts files
      // types: entrySources["."]?.types,
      // TODO: funding
      // TODO: support CJS-first projects (maybe?)
      type: "module",

      // TODO: add unpkg/browser support for cases when bundling (webpack or rollup)
      // jsdelivr, skypack

      // set all necessary fields for deployment:
      // main: "dist/index.js",
      // types: "dist/index.d.ts",
      // files: ["dist"],
      // publishConfig: {
      //   access: "public",
      // },
      // repository: {
      //   type: "git",
      //   url: "",
      // },
    };

    // process this.#publishedModifications sequentially:
    for (const { modifier } of this.#publishedModifications) {
      publishManifest = await modifier(newPackageJson);
    }

    return publishManifest;
  }
}

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

export type PackageJsonModifier = (
  pkg: ConduPackageJson,
) => ConduPackageJson | Promise<ConduPackageJson>;

export interface PackageJsonModification {
  modifier: PackageJsonModifier;
  context: CollectionContext;
}
export type PackageKind = "workspace" | "package";
export type WorkspaceRootPackage = ConduPackageEntry<"workspace">;
export type WorkspaceSubPackage = ConduPackageEntry<"package">;

export interface IPackageEntry<KindT extends PackageKind = PackageKind> {
  kind: KindT;
  /** shortcut to manifest.name */
  name: string;
  scope?: string | undefined;
  scopedName: string;
  manifest: ConduPackageJson;
  manifestRelPath: string;
  manifestAbsPath: string;
  /** relative directory of the package from the workspace path */
  relPath: string;
  /** absolute directory of the package */
  absPath: string;
}

export interface IPackageEntryWithWriteManifest<
  KindT extends PackageKind = PackageKind,
> extends IPackageEntry<KindT> {
  writeProjectManifest: WriteManifestFn;
}
export type MinimalManifest = Pick<
  ConduPackageJson,
  DependencyTargetList | "condu"
>;

export type ManagedDependencyConfig = "presence" | "version";

export interface PackageJsonConduSection
  extends Pick<
    PartialProjectConfig,
    "language" | "platform" | "tags" | "type" | "stack"
  > {
  initialDevelopment?: boolean;
  managedDependencies?: Record<string, ManagedDependencyConfig>;
  defaultScope?: string;
}

export interface ConduPackageJson extends PackageJson {
  // name is mandatory
  name: string;
  condu?: PackageJsonConduSection;

  bolt?: { workspaces?: string[] };
  pnpm?: ProjectManifest["pnpm"];
  resolutions?: Record<string, string>;
  overrides?: Record<string, string>;
}

export type MatchPackage =
  | Pattern.Pattern<ConduPackageEntry>
  | Partial<ConduPackageEntry>;
