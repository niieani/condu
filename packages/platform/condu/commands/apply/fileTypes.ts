import type {
  ConduPackageEntry,
  ReadonlyConduPackageEntry,
} from "./ConduPackageEntry.js";
import type {
  ConduReadonlyCollectedStateView,
  CollectionContext,
} from "./CollectedState.js";
import type { CURRENT_CACHE_VERSION } from "../../constants.js";
import type {
  FileNameToSerializedTypeMapping,
  GlobalFileAttributes,
} from "../../extendable.js";
import type { SymlinkTarget } from "./ManagedFileLifecycle.js";
import type { ConduFile } from "./ConduFile.js";
export interface ApplyAndCommitArg {
  collectedStateReadOnlyView: ConduReadonlyCollectedStateView;
  overwriteWithoutAsking?: boolean;
}

export interface FileDestination {
  relPath: string;
  targetPackage: ConduPackageEntry;
}

export interface WrittenFile {
  content: string | SymlinkTarget;
  modifiedAt: number;
  size: number;
  doNotCache?: boolean | undefined;
}

export interface WrittenFileInCache extends Omit<WrittenFile, "doNotCache"> {
  /** full path relative to the root of the workspace */
  path: string;
  content: string | { target: string };
}

export interface FilesJsonCacheFileVersion1 {
  cacheVersion: typeof CURRENT_CACHE_VERSION;
  files: readonly WrittenFileInCache[];
}

export type JsonFileName = `${string}.${"json" | "jsonc" | "json5"}`;
export type YamlFileName = `${string}.${"yaml" | "yml"}`;

export interface FallbackFileNameToDeserializedTypeMapping {
  [file: JsonFileName]: object;
  [file: YamlFileName]: object;
}

export type DefinedFileNames = keyof FileNameToSerializedTypeMapping;
export type FallbackFileNames = keyof FallbackFileNameToDeserializedTypeMapping;
export type PossibleDeserializedValue =
  | object
  | string
  | number
  | boolean
  | null;

export type ResolvedSerializedType<PathT extends string> =
  PathT extends DefinedFileNames
    ? FileNameToSerializedTypeMapping[PathT]
    : PathT extends FallbackFileNames
      ? FallbackFileNameToDeserializedTypeMapping[PathT]
      : string;

export type NeedsCustomSerializer<PathT extends string> =
  PathT extends keyof FileNameToSerializedTypeMapping ? true : false;

export type IfPreviouslyDefined = "error" | "overwrite" | "ignore";

export interface ContentFunctionArgs {
  targetPackage: ReadonlyConduPackageEntry;
  globalRegistry: ConduReadonlyCollectedStateView;
}

export type InitialContent<DeserializedT> =
  | DeserializedT
  | (({
      globalRegistry,
      targetPackage,
    }: ContentFunctionArgs) =>
      | DeserializedT
      | Promise<DeserializedT>
      | undefined);

export interface SymlinkTargetContent {
  symlinkTarget: string;
}

export type InitialContentWithContext<DeserializedT> = (
  | { content: InitialContent<DeserializedT> }
  | SymlinkTargetContent
) & {
  context: CollectionContext;
};

// Define options interfaces
export type GenerateFileOptions<DeserializedT> =
  | GenerateSymlinkFileOptions
  | GenerateRegularFileOptions<DeserializedT>;

export type GenerateFileOptionsForPath<PathT extends string> =
  NeedsCustomSerializer<PathT> extends true
    ? GenerateRegularFileWithRequiredStringifyOptions<
        ResolvedSerializedType<PathT>
      >
    : GenerateFileOptions<ResolvedSerializedType<PathT>>;

export type PartialGlobalFileAttributes = Partial<GlobalFileAttributes>;

export interface WithGlobalFileAttributes {
  attributes?: PartialGlobalFileAttributes;
}

export interface GenerateSymlinkFileOptions
  extends WithGlobalFileAttributes,
    SymlinkTargetContent {
  /** defaults to 'error' */
  ifPreviouslyDefined?: IfPreviouslyDefined;
}

export interface GenerateRegularFileWithRequiredStringifyOptions<DeserializedT>
  extends WithGlobalFileAttributes {
  /** if the function returns undefined, we will remove the file */
  content: InitialContent<DeserializedT>;

  /** defaults to stringify based on file extension */
  stringify: (content: DeserializedT) => string;

  /** defaults to 'error' */
  ifPreviouslyDefined?: IfPreviouslyDefined;
}

export interface GenerateRegularFileOptions<DeserializedT>
  extends WithGlobalFileAttributes {
  content: InitialContent<DeserializedT>;

  /** defaults to stringify based on file extension */
  stringify?: (content: DeserializedT) => string;

  /** defaults to 'error' */
  ifPreviouslyDefined?: IfPreviouslyDefined;
}

export type IfNotCreated = "ignore" | "error" | "create";

export interface ContentModificationFunctionArgs<DeserializedT>
  extends ContentFunctionArgs {
  content: DeserializedT;
}

export interface ModifyOnlyGeneratedFileOptions<DeserializedT>
  extends WithGlobalFileAttributes {
  content: ({
    content,
    globalRegistry,
    targetPackage,
  }: ContentModificationFunctionArgs<DeserializedT>) =>
    | DeserializedT
    | Promise<DeserializedT>;
  // default is "ignore"
  ifNotCreated?: Exclude<IfNotCreated, "create">;
}

export interface ModifyOrCreateGeneratedFileOptions<DeserializedT>
  extends WithGlobalFileAttributes {
  content: ({
    content,
    globalRegistry,
    targetPackage,
  }: ContentModificationFunctionArgs<DeserializedT | undefined>) =>
    | DeserializedT
    | Promise<DeserializedT>;

  ifNotCreated: "create";

  /** defaults to stringify based on file extension */
  stringify?: (content: DeserializedT) => string;
}

export type ModifyGeneratedFileOptions<DeserializedT> =
  | ModifyOnlyGeneratedFileOptions<DeserializedT>
  | ModifyOrCreateGeneratedFileOptions<DeserializedT>;

export type ModifyUserEditableFileOptions<DeserializedT> =
  | ModifyUserEditableFileOptionsWithBuiltinSerialization<DeserializedT>
  | ModifyUserEditableFileOptionsWithCustomSerialization<DeserializedT>;

export interface ModifyUserEditableFileOptionsWithBuiltinSerialization<
  DeserializedT,
> extends WithGlobalFileAttributes {
  // default is 'create'
  ifNotExists?: IfNotCreated;
  /** if the function returns undefined, we will not modify the file */
  content: ({
    content,
    globalRegistry,
    targetPackage,
  }: ContentModificationFunctionArgs<DeserializedT | undefined>) =>
    | DeserializedT
    | Promise<DeserializedT | undefined>
    | undefined;

  // parse and stringify must exist with a `never` type to make it exact
  // otherwise TS will not discriminate the union correctly
  // by default uses 'json-comment' for .json files, and 'yaml' for .yaml files
  parse?: never;
  stringify?: never;
}

export interface ModifyUserEditableFileOptionsWithCustomSerialization<
  DeserializedT,
> extends WithGlobalFileAttributes {
  // default is 'create'
  ifNotExists?: IfNotCreated;
  /** if the function returns undefined, we will not modify the file */
  content: ({
    content,
    globalRegistry,
    targetPackage,
  }: ContentModificationFunctionArgs<DeserializedT | undefined>) =>
    | DeserializedT
    | Promise<DeserializedT | undefined>
    | undefined;

  parse: (rawFileContent: string) => DeserializedT;
  stringify: (content: DeserializedT) => string;
}

export type ModifyUserEditableFileOptionsWithContext<
  DeserializedT extends PossibleDeserializedValue,
> = ModifyUserEditableFileOptions<DeserializedT> & {
  context: CollectionContext;
};

export type ModifyGeneratedFileOptionsWithContext<
  DeserializedT extends PossibleDeserializedValue,
> = ModifyGeneratedFileOptions<DeserializedT> & {
  context: CollectionContext;
};

export interface FileManagerOptions {
  throwOnManualChanges?: boolean;
}

export type FileKind =
  | "non-fs"
  | "generated"
  | "user-editable"
  | "symlink"
  | "unchanged"
  | "invalid"
  | "no-longer-generated";

export type ReadonlyFile = Readonly<
  Pick<
    ConduFile<any>,
    | "absPath"
    | "relPath"
    | "attributes"
    | "hasFileSystemEffects"
    | "isManaged"
    | "managedByFeatures"
    | "status"
    | "targetPackage"
  >
>;
