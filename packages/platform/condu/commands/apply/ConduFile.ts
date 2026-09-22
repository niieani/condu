import { ManagedFileLifecycle, SymlinkTarget } from "./ManagedFileLifecycle.js";
import type { ConduReporter } from "../../reporter/ConduReporter.js";
import {
  getDefaultStringify,
  getDefaultParse,
} from "./defaultParseAndStringify.js";
import type { CollectionContext } from "./CollectedState.js";
import type {
  PossibleDeserializedValue,
  InitialContentWithContext,
  ModifyGeneratedFileOptionsWithContext,
  ModifyUserEditableFileOptionsWithContext,
  FileDestination,
  PartialGlobalFileAttributes,
  GenerateFileOptions,
  ModifyGeneratedFileOptions,
  ModifyUserEditableFileOptions,
  ApplyAndCommitArg,
  FileKind,
  IfNotCreated,
} from "./fileTypes.js";
export class ConduFile<
  DeserializedT extends PossibleDeserializedValue,
> extends ManagedFileLifecycle {
  // Recipe declarations stay here; lifecycle owns disk state and reconciliation.
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
  private initialContent?: InitialContentWithContext<DeserializedT>;
  private contentModifications: Array<
    ModifyGeneratedFileOptionsWithContext<DeserializedT>
  > = [];
  private editableContentModifications: Array<
    ModifyUserEditableFileOptionsWithContext<DeserializedT>
  > = [];

  // defaults to stringify based on file name/extension
  private stringify: (content: DeserializedT) => string;

  constructor({
    relPath,
    targetPackage,
    reporter,
  }: FileDestination & { reporter: ConduReporter }) {
    // TODO: handle edge case - prevent reaching into other packages by using relative paths or from root (e.g. by specifiying root package + ./packages/file as the path)
    super({ relPath, targetPackage, reporter });
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
        this.reporter.warn(
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
      content = stringified !== undefined ? parse(stringified) : undefined;
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

    if (stringified !== undefined) {
      await this.attemptWriteToFileSystem(stringified, {
        overwriteWithoutAsking:
          kind === "user-editable" || overwriteWithoutAsking,
      });
    } else if (this.lastApply && this.initialContent) {
      await this.deleteFromFileSystem();
      kind = "no-longer-generated";
    } else if (kind === "non-fs") {
      this.status = "skipped";
    }

    this.lastApplyKind = kind;
  }
}
