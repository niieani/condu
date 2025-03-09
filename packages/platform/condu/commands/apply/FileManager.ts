import { UpsertMap } from "@condu/core/utils/UpsertMap.js";
import type {
  ConduPackageEntry,
  ReadonlyConduPackageEntry,
  WorkspaceRootPackage,
  WorkspaceSubPackage,
} from "./ConduPackageEntry.js";
import fs from "node:fs/promises";
import readline from "node:readline/promises";
import path from "node:path";
import { printUnifiedDiff } from "print-diff";
import { match, P } from "ts-pattern";
import type {
  ConduReadonlyCollectedStateView,
  CollectionContext,
} from "./CollectedState.js";
import {
  getDefaultStringify,
  getDefaultParse,
} from "./defaultParseAndStringify.js";
import { getRootPackageRelativePath } from "./getRootPackageRelativePath.js";
import {
  IS_INTERACTIVE,
  FILE_STATE_PATH,
  CURRENT_CACHE_VERSION,
} from "../../constants.js";
import type {
  FileNameToSerializedTypeMapping,
  GlobalFileAttributes,
} from "../../extendable.js";

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

// implementation:
export class FileManager {
  files = new UpsertMap<string, ConduFile<any>>();
  cacheFile: ConduFile<FilesJsonCacheFileVersion1>;
  rootPackage: WorkspaceRootPackage;
  packages: readonly WorkspaceSubPackage[];
  throwOnManualChanges: boolean;

  constructor(
    rootPackage: WorkspaceRootPackage,
    packages: readonly WorkspaceSubPackage[],
    { throwOnManualChanges = false }: FileManagerOptions = {},
  ) {
    this.throwOnManualChanges = throwOnManualChanges;

    this.cacheFile = new ConduFile({
      relPath: FILE_STATE_PATH,
      targetPackage: rootPackage,
    });

    this.cacheFile.defineInitialContent(
      {
        content: () => {
          const filesToCache: WrittenFileInCache[] = [];
          for (const [path, file] of this.files) {
            if (file.shouldCache && file.lastApply) {
              filesToCache.push({
                ...file.lastApply,
                path,
              });
            }
          }
          const cacheContent: FilesJsonCacheFileVersion1 = {
            cacheVersion: CURRENT_CACHE_VERSION,
            files: filesToCache,
          };
          return cacheContent;
        },
        attributes: { alwaysOverwrite: true },
      },
      { featureName: "condu:cache" },
    );

    this.rootPackage = rootPackage;
    this.packages = packages;
  }

  manageFile(destination: FileDestination) {
    const rootRelativePath = path.join(
      destination.targetPackage.relPath,
      destination.relPath,
    );
    return this.files.getOrInsertComputed(
      rootRelativePath,
      () => new ConduFile(destination),
    );
  }

  async applyAllFiles(
    collectedStateReadOnlyView: ConduReadonlyCollectedStateView,
  ): Promise<void> {
    const arg = { collectedStateReadOnlyView } as const;

    // apply all files in parallel (TODO: limit concurrency)
    const applyPromises: Promise<void>[] = Array.from(
      this.files.values(),
      (file) =>
        file.applyAndCommit(arg).then(() => {
          console.log(
            `${file.status} (${file.lastApplyKind}): ${file.relPath} [${file.managedByFeatures.map((f) => f.featureName).join(", ")}]`,
          );
        }),
    );
    await Promise.all(applyPromises);

    for (const file of this.files.values()) {
      // any files that need user input/confirmation need to be handled sequentially
      if (file.askUserToWrite) {
        if (!IS_INTERACTIVE || this.throwOnManualChanges) {
          process.exitCode = 1;
          if (this.throwOnManualChanges) {
            throw new Error(
              `Manual changes present in ${file.relPath}, please resolve the conflict by running 'condu apply' interactively.`,
            );
          }
          console.log(
            `Please resolve the conflict by running 'condu apply' interactively. Skipping: ${file.relPath}`,
          );
          file.status = "skipped";
        } else {
          await file.askUserToWrite();
        }
      }
    }
    // write the updated cache file
    await this.cacheFile.applyAndCommit({
      ...arg,
      overwriteWithoutAsking: true,
    });
  }

  async readCache(): Promise<void> {
    try {
      const content = await this.cacheFile.getContentFromFileSystem();
      const cacheContentJson = JSON.parse(content!) as object;
      let previouslyWrittenFiles: FilesJsonCacheFileVersion1["files"] = [];
      if (
        "cacheVersion" in cacheContentJson &&
        cacheContentJson.cacheVersion === CURRENT_CACHE_VERSION
      ) {
        const cacheContent = cacheContentJson as FilesJsonCacheFileVersion1;
        if (Array.isArray(cacheContent.files)) {
          previouslyWrittenFiles = cacheContent.files;
        }
      }
      for (const { path: filePath, ...file } of previouslyWrittenFiles) {
        const { targetPackage, packageRelativePath } =
          getRootPackageRelativePath({
            packages: this.packages,
            rootPackage: this.rootPackage,
            rootRelativePath: filePath,
          });

        // we don't need to read the content here
        // until we actually write the file
        // speeding up the loading
        const conduFile = this.files.getOrInsertComputed(
          filePath,
          () =>
            new ConduFile({
              relPath: packageRelativePath,
              targetPackage,
            }),
        );

        if (
          !conduFile.lastApply ||
          file.modifiedAt >= conduFile.lastApply.modifiedAt
        ) {
          // update the lastApply with the cached content
          conduFile.lastApply = {
            ...file,
            content:
              typeof file.content === "string"
                ? file.content
                : new SymlinkTarget(file.content.target),
          };
        }
      }
    } catch {
      // no cache file or invalid
    }
  }
}

export async function write({
  targetPath,
  content,
  ignoreCache,
}: {
  targetPath: string;
  content: string | SymlinkTarget;
  ignoreCache?: boolean;
}): Promise<WrittenFile> {
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  if (typeof content === "string") {
    console.log(`Writing: ${targetPath}`);
    await fs.writeFile(targetPath, content);
  } else {
    console.log(`Creating symlink: ${targetPath} => ${content.target}`);
    await fs.symlink(content.target, targetPath);
  }
  const stat = await fs.lstat(targetPath);
  const result: WrittenFile = {
    content,
    modifiedAt: stat.mtimeMs,
    size: stat.size,
    doNotCache: ignoreCache,
  };
  return result;
}

export type FileKind =
  | "non-fs"
  | "generated"
  | "user-editable"
  | "symlink"
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

export class ConduFile<DeserializedT extends PossibleDeserializedValue> {
  attributes: PartialGlobalFileAttributes = {};
  targetPackage: ConduPackageEntry;
  /** path relative from the package */
  relPath: string;
  /** full absolute path */
  get absPath(): string {
    return path.join(this.targetPackage.absPath, this.relPath);
  }
  // TODO: add featureExecutionOrder
  managedByFeatures: CollectionContext[] = [];
  status: "pending" | "applied" | "skipped" | "needs-user-input" = "pending";
  askUserToWrite?: (() => Promise<void>) | undefined;
  lastApplyKind?: FileKind;
  get isManaged(): boolean {
    return this.managedByFeatures.length > 0;
  }
  get hasFileSystemEffects(): boolean {
    return (
      this.initialContent !== undefined ||
      this.contentModifications.length > 0 ||
      this.editableContentModifications.length > 0
    );
  }
  get shouldCache(): boolean {
    return Boolean(
      this.isManaged &&
        this.hasFileSystemEffects &&
        !this.neverCache &&
        this.status === "applied" &&
        this.lastApply &&
        !this.lastApply.doNotCache,
    );
  }
  private neverCache = false;

  /**
   * the current file as is present in the FS
   * if the file was deleted, this will be "deleted"
   * if the fsState is the same as lastApply, this will be "unchanged"
   **/
  private _fsState?: WrittenFile | "deleted" | "unchanged";
  lastApply: WrittenFile | undefined;

  private initialContent?: InitialContentWithContext<DeserializedT>;
  private contentModifications: Array<
    ModifyGeneratedFileOptionsWithContext<DeserializedT>
  > = [];
  private editableContentModifications: Array<
    ModifyUserEditableFileOptionsWithContext<DeserializedT>
  > = [];

  // defaults to stringify based on file name/extension
  private stringify: (content: DeserializedT) => string;

  constructor({ relPath, targetPackage }: FileDestination) {
    // TODO: handle edge case - prevent reaching into other packages by using relative paths or from root (e.g. by specifiying root package + ./packages/file as the path)
    this.relPath = relPath;
    this.targetPackage = targetPackage;
    // set default stringify based on file name/extension
    this.stringify = getDefaultStringify(this.relPath);
  }

  #updateAttributes(attributes: PartialGlobalFileAttributes) {
    // only set the flags that are provided
    for (const [key, value] of Object.entries(attributes)) {
      // attributes can only be string, number or boolean
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        this.attributes[key as keyof PartialGlobalFileAttributes] =
          value as NonNullable<
            PartialGlobalFileAttributes[keyof PartialGlobalFileAttributes]
          >;
      }
    }
  }

  updateAttributes(
    attributes: PartialGlobalFileAttributes | undefined,
    context: CollectionContext,
  ) {
    this.managedByFeatures.push(context);
    if (attributes) {
      this.#updateAttributes(attributes);
    }
  }

  defineInitialContent(
    opts: GenerateFileOptions<DeserializedT>,
    context: CollectionContext,
  ) {
    if ("symlinkTarget" in opts) {
      const { symlinkTarget, ifPreviouslyDefined = "error", attributes } = opts;
      if (this.initialContent) {
        if (ifPreviouslyDefined === "error") {
          // TODO: safe error handling instead of throwing
          throw new Error(
            `Initial content already set for file ${this.relPath}`,
          );
        }
        if (ifPreviouslyDefined === "ignore") {
          return this;
        }
      }
      this.updateAttributes(attributes, context);
      this.initialContent = { symlinkTarget, context };
    } else {
      const {
        content,
        stringify,
        ifPreviouslyDefined = "error",
        attributes,
      } = opts;
      if (this.initialContent) {
        if (ifPreviouslyDefined === "error") {
          // TODO: safe error handling instead of throwing
          throw new Error(
            `Initial content already set for file ${this.relPath}`,
          );
        }
        if (ifPreviouslyDefined === "ignore") {
          return this;
        }
      }
      this.updateAttributes(attributes, context);
      this.initialContent = { content, context };
      if (stringify) {
        this.stringify = stringify;
      }
    }
    return this;
  }

  addModification(
    modification: ModifyGeneratedFileOptions<DeserializedT>,
    context: CollectionContext,
  ) {
    const { attributes } = modification;
    this.updateAttributes(attributes, context);
    this.contentModifications.push({ ...modification, context });
    return this;
  }

  addUserEditableModification(
    modification: ModifyUserEditableFileOptions<DeserializedT>,
    context: CollectionContext,
  ) {
    // it's okay to allow modifications to generated files
    // because we can stringify and parse them
    // but it has to happen after all generated modifications
    // what about the opposite?
    // if (this.kind === 'generated') {
    //   throw new Error(`Cannot modify a generated file, use modifyGeneratedFile instead`);
    // }
    const { attributes } = modification;
    this.updateAttributes(attributes, context);
    this.editableContentModifications.push({ ...modification, context });
    this.neverCache = true;
    return this;
  }

  /**
   * Creates the file or applies modifications to it
   * then updates the filesystem.
   * If the file is no longer managed, it will be deleted.
   */
  async applyAndCommit({
    collectedStateReadOnlyView,
    overwriteWithoutAsking,
  }: ApplyAndCommitArg): Promise<void> {
    if (!this.isManaged) {
      if (this.lastApply) {
        // no longer managed, delete the file
        this.lastApplyKind = "no-longer-generated";
        await this.deleteFromFileSystem();
        return;
      } else {
        console.error(
          `File ${this.relPath} is not managed by any feature, yet it wasn't present in cache either.`,
        );
        this.status = "skipped";
        this.lastApplyKind = "invalid";
        return;
      }
    }

    if (!this.hasFileSystemEffects) {
      this.status = "skipped";
      this.lastApplyKind = "non-fs";
      return;
    }

    if (this.initialContent && "symlinkTarget" in this.initialContent) {
      this.lastApplyKind = "symlink";

      if (
        this.contentModifications.length > 0 ||
        this.editableContentModifications.length > 0
      ) {
        throw new Error(
          `Cannot modify a symlinked file: ${this.relPath} in package ${this.targetPackage.name}.`,
        );
      }

      await this.attemptWriteToFileSystem(
        new SymlinkTarget(this.initialContent.symlinkTarget),
        { overwriteWithoutAsking },
      );
      return;
    }

    let kind: FileKind = "non-fs";

    // move all modifications with ifNotExists: "create" to the beginning
    this.editableContentModifications.sort((a, b) =>
      !a.ifNotExists || a.ifNotExists === "create"
        ? -1
        : !b.ifNotExists || b.ifNotExists === "create"
          ? 1
          : 0,
    );

    // move all modifications with ifNotCreated: "create" to the beginning
    this.contentModifications.sort((a, b) =>
      a.ifNotCreated === "create" ? -1 : b.ifNotCreated === "create" ? 1 : 0,
    );

    let content: DeserializedT | undefined =
      typeof this.initialContent?.content === "function"
        ? await this.initialContent.content({
            targetPackage: this.targetPackage,
            globalRegistry: collectedStateReadOnlyView,
          })
        : this.initialContent?.content;

    let ifNotCreated: IfNotCreated = "ignore";

    // reduce the content to the final state
    for (const modification of this.contentModifications) {
      if (content === undefined && modification.ifNotCreated === "create") {
        // if no content, try the modification that can create the file
        content = await modification.content({
          content,
          globalRegistry: collectedStateReadOnlyView,
          targetPackage: this.targetPackage,
        });
        if (modification.stringify) {
          this.stringify = modification.stringify;
        }
      } else {
        if (modification.ifNotCreated === "error") {
          ifNotCreated = "error";
        }
        if (content === undefined) {
          if (ifNotCreated === "error") {
            throw new Error(
              `Cannot generate ${this.relPath}, no initial content provided`,
            );
          }
          this.status = "skipped";
          // nothing to do, finish here
          this.lastApplyKind = "invalid";
          return;
        }
        content = await modification.content({
          content,
          globalRegistry: collectedStateReadOnlyView,
          targetPackage: this.targetPackage,
        });
      }
      // TODO: add debugging breadcrumbs for actually applied creations / modifications
    }

    if (content !== undefined) {
      // if by this point we got content, it's a generated file
      kind = "generated";
    }

    let stringified: string | undefined =
      content !== undefined ? this.stringify(content) : undefined;

    if (this.editableContentModifications.length > 0) {
      if (stringified) {
        // TODO: warn that we are editing a generated file, not a user-provided one
      }
      // user-editable files get parsed from the filesystem contents
      stringified = stringified ?? (await this.getContentFromFileSystem());
    }

    for (const modification of this.editableContentModifications) {
      const parse = modification.parse ?? getDefaultParse(this.relPath);
      content = stringified ? parse(stringified) : undefined;
      if (content === undefined) {
        if (modification.ifNotExists === "ignore") {
          // nothing to do, skip
          continue;
        } else if (modification.ifNotExists === "error") {
          this.status = "skipped";
          this.lastApplyKind = "invalid";
          throw new Error(
            `Cannot edit ${this.relPath}, no initial content provided`,
          );
        }
      }

      if (kind !== "generated") {
        kind = "user-editable";
      }

      // get the next version of the content:
      content = await modification.content({
        content,
        globalRegistry: collectedStateReadOnlyView,
        targetPackage: this.targetPackage,
      });
      const stringify =
        modification.stringify ?? getDefaultStringify(this.relPath);
      stringified = content !== undefined ? stringify(content) : undefined;
    }

    if (stringified) {
      await this.attemptWriteToFileSystem(stringified, {
        overwriteWithoutAsking:
          kind === "user-editable" || overwriteWithoutAsking,
      });
    } else if (kind === "non-fs") {
      this.status = "skipped";
    }
    // else if (kind === "generated") {
    //   await this.deleteFromFileSystem();
    // }

    this.lastApplyKind = kind;
  }

  async ensureFsState(): Promise<WrittenFile | "deleted" | "unchanged"> {
    if (this._fsState) {
      return this._fsState;
    }
    const fullPath = this.absPath;
    const stat = await fs.lstat(fullPath).catch(() => undefined);
    const symlinkTarget = stat?.isSymbolicLink()
      ? await fs.readlink(fullPath).catch(() => undefined)
      : undefined;
    const content = symlinkTarget
      ? new SymlinkTarget(symlinkTarget)
      : await fs.readFile(fullPath, "utf-8").catch(() => undefined);

    if (!stat || content === undefined) {
      // TODO: rename to 'nonexistent'
      this._fsState = "deleted";
      return this._fsState;
    }

    if (this.lastApply?.content === content) {
      this._fsState = "unchanged";
      return this._fsState;
    }

    const modifiedAt = stat.mtimeMs;
    const size = stat.size;

    // TODO: maybe instead of SymlinkTarget, we have 'target' as a separate field?
    const fsState: WrittenFile = {
      content,
      modifiedAt,
      size,
    };

    this._fsState = fsState;
    return fsState;
  }

  async getFsFile(): Promise<WrittenFile | undefined> {
    const fsState = await this.ensureFsState();
    if (fsState === "unchanged") {
      // lastApply is guaranteed to be set if fsState === "unchanged"
      return this.lastApply!;
    }
    if (fsState === "deleted") {
      return undefined;
    }
    return fsState;
  }

  async getContentFromFileSystem(): Promise<string | undefined> {
    const file = await this.getFsFile();
    if (typeof file === "object" && typeof file.content === "string") {
      return file.content;
    }
    return undefined;
  }

  async attemptWriteToFileSystem(
    newContent: string | SymlinkTarget,
    { overwriteWithoutAsking = false } = {},
  ): Promise<void> {
    const targetPath = this.absPath;
    const existingFile = await this.getFsFile();

    if (
      existingFile &&
      existingFile.content.toString().trim() === newContent.toString().trim()
    ) {
      this.status = "applied";
      this.lastApply = existingFile;
      // already up to date
      return;
    }

    // Check if we're replacing a symlink with a regular file
    if (
      existingFile &&
      existingFile.content instanceof SymlinkTarget &&
      !(newContent instanceof SymlinkTarget)
    ) {
      // Need to unlink the symlink before writing regular file content
      console.log(
        `Unlinking symlink before writing file content: ${this.relPath}`,
      );
      await fs.unlink(targetPath);
    }

    if (newContent instanceof SymlinkTarget) {
      if (existingFile && existingFile.content instanceof SymlinkTarget) {
        // linked content mismatch, unlink the existing file
        // no need to ask for confirmation for symlinks
        console.log(`Unlinking: ${this.relPath}`);
        await fs.unlink(targetPath);
      }
      this.status = "applied";
      this.lastApply = await write({
        targetPath,
        content: newContent,
      });
      this._fsState = this.lastApply;
      return;
    }

    const lastEditedByCondu = existingFile === this.lastApply;

    if (
      !existingFile ||
      overwriteWithoutAsking ||
      this.attributes.alwaysOverwrite ||
      // condu can freely overwrite files that it previously generated
      lastEditedByCondu
    ) {
      this.status = "applied";
      // no existing file, or different content
      this.lastApply = await write({
        targetPath,
        content: newContent,
      });
      this._fsState = this.lastApply;
      return;
    } else {
      this.status = "needs-user-input";
      // return a function for interactive overwrite
      // this needs to happen sequentially, because we're prompting the user for input:
      this.askUserToWrite = async () => {
        console.log(
          `[${this.managedByFeatures.map((f) => f.featureName).join(", ")}] Manual changes present in ${this.relPath}`,
        );
        printUnifiedDiff(
          existingFile.content.toString(),
          newContent,
          process.stdout,
        );

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const rawAnswer = await rl.question(
          "Do you want to overwrite the file? (y/n)",
        );
        rl.close();
        const shouldOverwrite = match(rawAnswer)
          .with(P.union("y", "Y", P.string.regex(/yes/i)), () => true)
          .otherwise(() => false);

        if (shouldOverwrite) {
          this.status = "applied";
          this.lastApply = await write({
            targetPath,
            content: newContent,
          });
          this._fsState = this.lastApply;
          this.askUserToWrite = undefined;
          return;
        }
        this.status = "skipped";
        this.askUserToWrite = undefined;
        process.exitCode = 1;
        console.log(
          `Please update your config and re-run 'condu apply' when ready. Skipping: ${this.relPath}`,
        );
      };
    }
  }

  async deleteFromFileSystem(): Promise<void> {
    if (!this.lastApply) {
      // only allow deletion if the file was previously generated
      return;
    }
    const targetPath = this.absPath;
    console.log(`Deleting, no longer needed: ${targetPath}`);
    await fs.unlink(targetPath).catch((reason) => {
      console.error(`Failed to delete ${targetPath}: ${reason}`);
    });
    this._fsState = "deleted";
    this.status = "applied";
    this.lastApply = undefined;
  }
}

export class SymlinkTarget {
  toString() {
    return `symlink:${this.target}`;
  }
  constructor(public readonly target: string) {}
}
