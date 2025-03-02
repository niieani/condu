import type { PackageJson } from "@condu/schema-types/schemas/packageJson.gen.js";
import type { PartialProjectConfig } from "@moonrepo/types";
import type { ProjectManifest } from "@pnpm/types";

export interface ConduPackageJson extends PackageJson {
  // name is mandatory
  name: string;
  condu?: PackageJsonConduSection;

  bolt?: { workspaces?: string[] };
  pnpm?: ProjectManifest["pnpm"];
  resolutions?: Record<string, string>;
  overrides?: Record<string, string>;
}

export interface WriteManifestFnOptions {
  force?: boolean;
  merge?: boolean;
}

export type WriteManifestFn = (
  manifest: ConduPackageJson | PackageJson,
  options?: WriteManifestFnOptions,
) => Promise<void>;

export type PackageKind = "workspace" | "package";

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
  DependencyTargetList | "condu" | "pnpm" | "packageManager"
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

export type DependencyTargetList =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";
