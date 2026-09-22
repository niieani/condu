import type { ConduReporter } from "../../reporter/ConduReporter.js";
import { UpsertMap } from "@condu/core/utils/UpsertMap.js";
import path from "node:path";
import type {
  WorkspaceRootPackage,
  WorkspaceSubPackage,
} from "./ConduPackageEntry.js";
import type { ConduReadonlyCollectedStateView } from "./CollectedState.js";
import { getRootPackageRelativePath } from "./getRootPackageRelativePath.js";
import { FILE_STATE_PATH, CURRENT_CACHE_VERSION } from "../../constants.js";
import { ConduFile } from "./ConduFile.js";
import { SymlinkTarget } from "./ManagedFileLifecycle.js";
import type {
  FileManagerOptions,
  FileDestination,
  FilesJsonCacheFileVersion1,
  WrittenFileInCache,
} from "./fileTypes.js";
export type * from "./fileTypes.js";
export { ConduFile } from "./ConduFile.js";
export { SymlinkTarget, write } from "./ManagedFileLifecycle.js";
// implementation:
export class FileManager {
  files = new UpsertMap<string, ConduFile<any>>();
  cacheFile: ConduFile<FilesJsonCacheFileVersion1>;
  rootPackage: WorkspaceRootPackage;
  packages: readonly WorkspaceSubPackage[];
  throwOnManualChanges: boolean;
  private readonly reporter: ConduReporter;

  constructor(
    rootPackage: WorkspaceRootPackage,
    packages: readonly WorkspaceSubPackage[],
    {
      throwOnManualChanges = false,
      reporter,
    }: FileManagerOptions & { reporter: ConduReporter },
  ) {
    this.throwOnManualChanges = throwOnManualChanges;
    this.reporter = reporter;

    this.cacheFile = new ConduFile({
      reporter,
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
      () => new ConduFile({ ...destination, reporter: this.reporter }),
    );
  }

  async applyAllFiles(
    collectedStateReadOnlyView: ConduReadonlyCollectedStateView,
  ): Promise<void> {
    const { reporter } = this;

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
          if (!reporter.isInteractive() || this.throwOnManualChanges) {
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
      const operationType = file.operation;
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
              reporter: this.reporter,
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

  getSummary() {
    const files = [...this.files.values()].filter(
      (file) =>
        file.hasFileSystemEffects ||
        file.lastApplyKind === "no-longer-generated",
    );
    const changed = files.filter((file) => file.hadChanges);
    const manualReviewItems = files.flatMap((file) =>
      file.manualReviewDetails
        ? [
            {
              path: path.join(file.targetPackage.relPath, file.relPath),
              managedBy: file.managedByFeatures.map(
                ({ featureName }) => featureName,
              ),
              message: file.manualReviewDetails,
            },
          ]
        : [],
    );
    return {
      totalFiles: files.length,
      filesEvaluated: files.length,
      filesChanged: changed.length,
      filesUnchanged: files.filter(
        (file) => !file.hadChanges && !file.manualReviewDetails,
      ).length,
      filesCreated: changed.filter((file) => file.operation === "created")
        .length,
      filesUpdated: changed.filter((file) => file.operation === "updated")
        .length,
      filesDeleted: changed.filter((file) => file.operation === "deleted")
        .length,
      filesSkipped: files.filter((file) => !!file.manualReviewDetails).length,
      filesNeedingReview: manualReviewItems.length,
      manualReviewItems,
      packagesTouched: new Set(
        changed.map((file) => file.targetPackage.relPath),
      ),
    };
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
