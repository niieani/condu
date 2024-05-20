import type {
  RepoPackageJson,
  WriteManifestFn,
} from "@condu/core/configTypes.js";
import type { TDepMap, TGraph } from "toposource";

export type IPackageDeps = Record<string, string>;

// export interface IPackageJson {
//   name: string;
//   version: string;
//   workspaces?: string[] | { packages?: string[] };
//   bolt?: {
//     workspaces?: string[];
//   };
//   dependencies?: IPackageDeps;
//   devDependencies?: IPackageDeps;
//   optionalDependencies?: IPackageDeps;
//   peerDependencies?: IPackageDeps;
// }

export interface IPackageEntry {
  /** shortcut to manifest.name */
  name: string;
  manifest: RepoPackageJson;
  manifestRelPath: string;
  manifestAbsPath: string;
  /** relative directory of the package from the workspace path */
  relPath: string;
  /** absolute directory of the package */
  absPath: string;
  writeProjectManifest: WriteManifestFn;
}

export interface IDepEntry {
  name: string;
  version: string;
  scope: string;
}

export interface IDepEntryEnriched extends IDepEntry {
  deps: IPackageDeps;
  parent: IPackageEntry;
  pkg: IPackageEntry;
}

export type ITopoOptions = Partial<ITopoOptionsNormalized>;

export interface IGetManifestPaths {
  workspaces: string[];
  cwd: string;
}

export interface ITopoOptionsNormalized extends IGetManifestPaths {
  workspacesExtra: string[];
  filter: (entry: IPackageEntry) => boolean;
  pkgFilter: (entry: IPackageEntry) => boolean;
  depFilter: (entry: IDepEntry) => boolean;
}

export interface ITopoContext {
  packages: Record<string, IPackageEntry>;
  root: IPackageEntry;
  nodes: string[];
  edges: [string, string | undefined][];
  queue: string[];
  sources: string[];
  graphs: TGraph[];
  next: TDepMap;
  prev: TDepMap;
}
