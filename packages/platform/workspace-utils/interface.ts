import type { TDepMap, TGraph } from "toposource";
import type {
  IPackageEntry,
  IPackageEntryWithWriteManifest,
} from "./packageJsonTypes.js";

export type IPackageDeps = Record<string, string>;

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

export interface IGetWorkspaceOptions extends IGetManifestPaths {
  workspacesExtra: string[];
  filter: (entry: IPackageEntry) => boolean;
  pkgFilter: (entry: IPackageEntry) => boolean;
}

export interface ITopoOptionsNormalized extends IGetWorkspaceOptions {
  depFilter: (entry: IDepEntry) => boolean;
}

export interface IWorkspaceContext {
  packages: Record<string, IPackageEntryWithWriteManifest>;
  root: IPackageEntryWithWriteManifest;
  options: IGetWorkspaceOptions;
}

export interface ITopoContext extends IWorkspaceContext {
  nodes: string[];
  edges: [string, string | undefined][];
  queue: string[];
  sources: string[];
  graphs: TGraph[];
  next: TDepMap;
  prev: TDepMap;
}
