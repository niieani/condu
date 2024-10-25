import type {
  ConduConfigWithInferredValuesAndProject,
  ConduPackageJson,
  WorkspacePackage,
} from "./configTypes.js";

// Define PeerContext as an empty interface to be extended via declaration merging
export interface PeerContext {
  // TODO: maybe we move as much of functionality into condu context that's always there?
  condu: { _: string };
}

// Define PeerContextReducer
export type PeerContextReducer = {
  [K in keyof PeerContext]?: (
    current: PeerContext[K],
  ) => PeerContext[K] | Promise<PeerContext[K]>;
};

export type GetPeerContext<NameT extends keyof PeerContext | (string & {})> =
  NameT extends keyof PeerContext ? PeerContext[NameT] : never;

// Define the FeatureDefinition interface for the new API
export type FeatureDefinition<
  NameT extends keyof PeerContext | (string & {}) =
    | keyof PeerContext
    | (string & {}),
> = {
  name: NameT;
  // todo should this allow regex for dynamically created features?
  after?: Array<string> | string;
  mergePeerContext?: (
    config: ConduConfigWithInferredValuesAndProject,
  ) => Promise<PeerContextReducer> | PeerContextReducer;
  apply: (
    condu: Condu,
    peerContext: GetPeerContext<NameT>,
  ) => void | Promise<void>;
} & (NameT extends keyof PeerContext
  ? { initialPeerContext: GetPeerContext<NameT> }
  : {});

// Define the Condu interface
export interface Condu {
  config: ConduConfigWithInferredValuesAndProject;
  root: PackageCondu;
  with(criteria: PackageCriteria): PackageCondu;
  packages: WorkspacePackage[];
}

// Define PackageCondu interface
export interface PackageCondu {
  createManagedFile(path: string, options: CreateManagedFileOptions): void;
  modifyManagedFile(path: string, options: ModifyManagedFileOptions): void;
  modifyUserEditableFile(
    path: string,
    options: ModifyUserEditableFileOptions,
  ): void;
  addManagedDevDependency(dependency: string): void;
  addManagedDependency(dependency: string): void;
  setDependencyResolutions(resolutions: Record<string, string>): void;
  mergePackageJson(modifier: (pkg: ConduPackageJson) => ConduPackageJson): void;
  mergeReleasePackageJson(
    modifier: (pkg: ConduPackageJson) => ConduPackageJson,
  ): void;
}

// Define options interfaces
export interface CreateManagedFileOptions {
  content: string | ((pkg: ConduPackageJson) => string);
}

export interface ModifyManagedFileOptions {
  content: (content: string, pkg: ConduPackageJson) => string;
  ifNotCreated?: "ignore" | "error" | "create";
}

export interface ModifyUserEditableFileOptions {
  createIfNotExists?: boolean;
  content: (content: string, pkg: ConduPackageJson) => string;
}

export interface PackageCriteria {
  name?: string;
  kind?: "workspace" | "package";
}

// Define types for collected changes
export interface ChangesCollector {
  files: CollectedFileChange[];
  dependencies: CollectedDependency[];
  resolutions: Record<string, string>;
  packageJsonModifications: PackageJsonModification[];
  releasePackageJsonModifications: PackageJsonModification[];
}

export interface CollectedFileChange {
  pkg: WorkspacePackage;
  path: string;
  type: "createManagedFile" | "modifyManagedFile" | "modifyUserEditableFile";
  options:
    | CreateManagedFileOptions
    | ModifyManagedFileOptions
    | ModifyUserEditableFileOptions;
}

export interface CollectedDependency {
  pkg: WorkspacePackage;
  dependency: string;
  type: "dev" | "prod";
}

export interface PackageJsonModification {
  pkg: WorkspacePackage;
  modifier: (pkg: ConduPackageJson) => ConduPackageJson;
  type: "normal" | "release";
}
