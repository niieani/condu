import { UpsertMap } from "@condu/core/utils/UpsertMap.js";
import path from "node:path";
import type {
  WorkspaceRootPackage,
  WorkspaceSubPackage,
} from "./ConduPackageEntry.js";
import type { ConduReadonlyCollectedStateView } from "./CollectedState.js";
import { getRootPackageRelativePath } from "./getRootPackageRelativePath.js";
import {
  IS_INTERACTIVE,
  FILE_STATE_PATH,
  CURRENT_CACHE_VERSION,
} from "../../constants.js";
import { ConduFile } from "./ConduFile.js";
import { SymlinkTarget } from "./ManagedFileLifecycle.js";
import type {
  FileManagerOptions,
  FileDestination,
  FilesJsonCacheFileVersion1,
  WrittenFileInCache,
} from "./fileTypes.js";
export * from "./fileTypes.js";
export { ConduFile } from "./ConduFile.js";
export { SymlinkTarget, write } from "./ManagedFileLifecycle.js";
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
    const { ConduReporter } = await import("../../reporter/ConduReporter.js");
    const reporter = ConduReporter.get();

    reporter.startPhase("applying");

    const arg = { collectedStateReadOnlyView } as const;

    // apply all files in parallel (TODO: limit concurrency)
    const applyPromises: Promise<void>[] = Array.from(
      this.files.values(),
      (file) => file.applyAndCommit(arg),
    );
    const results = await Promise.allSettled(applyPromises);
    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );

    for (const file of this.files.values()) {
      // any files that need user input/confirmation need to be handled sequentially
      if (file.manualConflictResolution) {
        reporter.pauseForUserInput();
        try {
          if (!IS_INTERACTIVE || this.throwOnManualChanges) {
            process.exitCode = 1;
            if (this.throwOnManualChanges) {
              throw new Error(
                `Manual changes present in ${file.relPath}, please resolve the conflict by running 'condu apply' interactively.`,
              );
            }
            reporter.warn(
              `Please resolve the conflict in '${file.relPath}' by running 'condu apply' interactively. Skipping due to diff:`,
            );
            await file.manualConflictResolution.printDiff();
            file.status = "skipped";
            file.manualReviewDetails ??=
              "Kept existing changes; rerun 'condu apply' after reconciling this file.";
          } else {
            await file.manualConflictResolution.promptUserInteractively();
          }
          file.manualConflictResolution = undefined;
        } catch (error) {
          errors.push(error);
        } finally {
          reporter.resumeAfterUserInput();
        }
      }
    }

    for (const file of this.files.values()) {
      const operationType = this.mapLastApplyKindToOperation(
        file.lastApplyKind,
      );
      const fileStatus = this.mapFileStatusToReporterStatus(file);
      const filePath =
        file.targetPackage === this.rootPackage
          ? file.relPath
          : path.join(file.targetPackage.relPath, file.relPath);

      if (!file.hadChanges && fileStatus === "success") {
        continue;
      }

      reporter.reportFile({
        path: filePath,
        operation: operationType,
        status: fileStatus,
        managedBy: file.managedByFeatures.map((f) => f.featureName),
        details: file.manualReviewDetails,
      });
    }
    // write the updated cache file
    await this.cacheFile.applyAndCommit({
      ...arg,
      overwriteWithoutAsking: true,
    });
    if (errors.length)
      throw new AggregateError(errors, "Failed to apply managed files");
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

  private mapLastApplyKindToOperation(
    lastApplyKind: string | undefined,
  ): "generated" | "updated" | "created" | "deleted" | "skipped" {
    if (!lastApplyKind) return "skipped";

    switch (lastApplyKind) {
      case "generated":
      case "symlink":
        return "generated";
      case "created":
        return "created";
      case "updated":
      case "user-edited":
        return "updated";
      case "deleted":
      case "no-longer-generated":
        return "deleted";
      case "unchanged":
        return "skipped";
      case "skipped":
      case "non-fs":
      case "invalid":
      default:
        return "skipped";
    }
  }

  private mapFileStatusToReporterStatus(
    file: ConduFile<any>,
  ): "success" | "conflict" | "error" | "needs-review" {
    if (file.manualReviewDetails) {
      return "needs-review";
    }

    switch (file.status) {
      case "applied":
        return "success";
      case "needs-user-input":
        return "needs-review";
      case "skipped":
        return file.manualReviewDetails ? "needs-review" : "success";
      default:
        return "success";
    }
  }
}
