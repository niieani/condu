import fs from "node:fs/promises";
import path from "node:path";
import {
  SymlinkTarget,
  type FileDef,
  type GetExistingContentFn,
  type WorkspacePackage,
} from "@condu/types/configTypes.js";
import { stringify as yamlStringify, parse as yamlParse } from "yaml";
import {
  stringify as commentJsonStringify,
  parse as commentJsonParse,
} from "comment-json";
import { P, match } from "ts-pattern";
import { printUnifiedDiff } from "print-diff";
import readline from "node:readline/promises";
import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";

export const FILE_STATE_PATH = `${CONDU_CONFIG_DIR_NAME}/.cache/files.json`;

const stringify = (obj: unknown, filePath: string) =>
  /\.ya?ml$/i.test(filePath)
    ? yamlStringify(obj)
    : commentJsonStringify(obj, undefined, 2);

const CURRENT_CACHE_VERSION = 1;

export interface FilesJsonCacheFileVersion1 {
  cacheVersion: typeof CURRENT_CACHE_VERSION;
  files: readonly WrittenFileInCache[];
}

export interface WrittenFileInCache extends Omit<WrittenFile, "doNotCache"> {
  /** full path relative to the root of the workspace */
  path: string;
  content: string | { target: string };
}

export interface WrittenFile {
  content: string | SymlinkTarget;
  modifiedAt: number;
  size: number;
  doNotCache?: boolean | undefined;
}

interface CachedWrittenFile {
  lastApply: WrittenFile;
  /**
   * the current file as is present in the FS
   * if the file was deleted, this will be "deleted"
   **/
  fsState: Omit<WrittenFile, "path"> | "deleted" | "unchanged";
}

const createGetExistingContentFn =
  (targetPath: string, onExecuted: () => void): GetExistingContentFn =>
  async (defaultFallback?) => {
    onExecuted();
    const extension = path.extname(targetPath);
    try {
      const file = (await fs.readFile(targetPath)).toString();
      return match(extension)
        .with(P.string.regex(/\.ya?ml$/i), () => yamlParse(file))
        .with(P.string.regex(/\.json5?$/i), () => commentJsonParse(file))
        .otherwise(() => file);
    } catch {
      return defaultFallback;
    }
  };

interface WriteFileConfig extends WriteFilesConfigBase {
  file: FileDef;
  rootDir: string;
}

const writeFileFromDef = async ({
  file,
  rootDir,
  targetPackage,
  workspaceDirAbs,
  previouslyWrittenFiles,
  throwOnManualChanges,
}: WriteFileConfig): Promise<
  (() => Promise<WrittenFile>) | WrittenFile | undefined
> => {
  const targetPath = path.join(rootDir, file.path);
  const pathFromWorkspaceDirAbs = path.relative(workspaceDirAbs, targetPath);

  const previouslyWritten = previouslyWrittenFiles.get(pathFromWorkspaceDirAbs);
  // marking as handled:
  previouslyWrittenFiles.delete(pathFromWorkspaceDirAbs);

  let usedExistingContent = false;
  const resolvedContent =
    typeof file.content === "function"
      ? await file.content({
          pkg: targetPackage,
          getExistingContentAndMarkAsUserEditable: createGetExistingContentFn(
            targetPath,
            () => {
              usedExistingContent = true;
            },
          ),
        })
      : file.content;

  if (resolvedContent === undefined) {
    if (previouslyWritten) {
      console.log(`Deleting, no longer needed: ${pathFromWorkspaceDirAbs}`);
      await fs.rm(targetPath).catch((reason) => {
        console.error(`Failed to delete ${pathFromWorkspaceDirAbs}: ${reason}`);
      });
    }
    // nothing to add to cache state:
    return;
  }

  const newContent =
    typeof resolvedContent === "string" ||
    resolvedContent instanceof SymlinkTarget
      ? resolvedContent
      : stringify(resolvedContent, file.path);

  if (
    previouslyWritten?.fsState === "unchanged" &&
    newContent.toString() === previouslyWritten.lastApply.content.toString()
  ) {
    // TODO: if (DEBUG)
    // console.log(`Already fresh: ${pathFromWorkspaceDirAbs}`);
    return previouslyWritten.lastApply;
  }
  const fsContent = previouslyWritten?.fsState;

  // only show diff if we're not "enhancing" a manually editable file,
  // and the file doesn't have the 'alwaysOverwrite' flag
  if (
    previouslyWritten &&
    typeof fsContent === "object" &&
    !usedExistingContent &&
    !file.alwaysOverwrite
  ) {
    if (fsContent.content.toString() === newContent.toString()) {
      return {
        path: pathFromWorkspaceDirAbs,
        ...fsContent,
      };
    } else if (newContent instanceof SymlinkTarget) {
      if (fsContent.content instanceof SymlinkTarget) {
        // linked content mismatch, unlink the existing file
        console.log(`Unlinking: ${pathFromWorkspaceDirAbs}`);
        await fs.unlink(targetPath);
      }
      return write({
        targetPath,
        content: newContent,
        pathFromWorkspaceDirAbs,
      });
    }

    if (throwOnManualChanges) {
      throw new Error(
        `Manual changes present in ${pathFromWorkspaceDirAbs}, cannot continue.`,
      );
    }
    const isInteractive =
      process.stdout.isTTY &&
      process.stdin.isTTY &&
      process.env["npm_lifecycle_event"] !== "postinstall";

    // this needs to happen sequentially, because we're prompting the user for input:
    return async () => {
      console.log(`Manual changes present in ${pathFromWorkspaceDirAbs}`);
      printUnifiedDiff(
        fsContent.content.toString(),
        newContent,
        process.stdout,
      );
      if (!isInteractive) {
        process.exitCode = 1;
        console.log(
          `Please resolve the conflict by running 'condu apply' interactively. Skipping: ${pathFromWorkspaceDirAbs}`,
        );
        return previouslyWritten.lastApply;
      }

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
        return write({
          targetPath,
          content: newContent,
          pathFromWorkspaceDirAbs,
        });
      } else {
        process.exitCode = 1;
        console.log(
          `Please update your config and re-run 'condu apply' when ready. Skipping: ${pathFromWorkspaceDirAbs}`,
        );
        return previouslyWritten.lastApply;
      }
    };
  }

  return write({
    targetPath,
    content: newContent,
    pathFromWorkspaceDirAbs,
    ignoreCache: file.alwaysOverwrite,
  });
};

interface WriteFilesConfigBase {
  targetPackage: WorkspacePackage;
  /** workspace directory */
  workspaceDirAbs: string;
  previouslyWrittenFiles: Map<string, CachedWrittenFile>;
  throwOnManualChanges?: boolean;
}

interface WriteFilesConfig extends WriteFilesConfigBase {
  files: readonly FileDef[];
  targetPackageDir: string;
}

export async function writeFiles({
  files,
  targetPackageDir,
  workspaceDirAbs,
  ...rest
}: WriteFilesConfig) {
  const rootDir = path.join(workspaceDirAbs, targetPackageDir);
  const filesOrFns = await Promise.all(
    files.map((file) =>
      writeFileFromDef({
        file,
        rootDir,
        workspaceDirAbs,
        ...rest,
      }).catch((e) => ({
        status: "error",
        error: e,
        pathAbs: path.join(rootDir, file.path),
      })),
    ),
  );
  const writtenFiles: WrittenFile[] = [];
  // this needs to happen sequentially, because we're prompting the user for input
  for (const fileOrFn of filesOrFns) {
    if (!fileOrFn) continue;
    if (typeof fileOrFn === "object" && "error" in fileOrFn) {
      console.error(
        `Failed to write ${fileOrFn.pathAbs}: ${fileOrFn.error.message}`,
      );
      continue;
    }
    const result =
      typeof fileOrFn === "function"
        ? await fileOrFn().catch((e) => ({
            status: "error",
            error: e,
          }))
        : fileOrFn;
    if (typeof result === "object" && "error" in result) {
      // TODO: better error
      console.error(`Failed to write: ${result.error.message}`);
      continue;
    }

    writtenFiles.push(result);
  }
  return writtenFiles;
}

export async function readPreviouslyWrittenFileCache(
  workspaceDir: string,
): Promise<{
  rawCacheFile?: WrittenFile;
  cache: Map<string, CachedWrittenFile>;
}> {
  try {
    const cachePath = path.join(workspaceDir, FILE_STATE_PATH);
    const content = await fs.readFile(cachePath, "utf-8");
    const stat = await fs.lstat(cachePath);
    const cacheContentJson = JSON.parse(content) as object;
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

    const cache = new Map(
      await Promise.all(
        previouslyWrittenFiles.map(
          async (file): Promise<readonly [string, CachedWrittenFile]> => {
            const fullPath = path.join(workspaceDir, file.path);
            const stat = await fs.lstat(fullPath).catch(() => undefined);

            const wasSymlink =
              typeof file.content !== "string" && file.content.target
                ? new SymlinkTarget(file.content.target)
                : undefined;
            const lastApply = { ...file, content: wasSymlink ?? file.content };

            if (!stat) {
              return [file.path, { lastApply, fsState: "deleted" }];
            }

            const modifiedAt = stat.mtimeMs;
            const size = stat.size;

            if (
              modifiedAt === file.modifiedAt &&
              size === file.size &&
              !stat.isSymbolicLink() &&
              !wasSymlink
            ) {
              // presuming no changes, no need to re-read the file
              return [file.path, { lastApply, fsState: "unchanged" }];
            }

            const newSymlinkTo = stat.isSymbolicLink()
              ? await fs.readlink(fullPath).catch(() => undefined)
              : undefined;
            const newContent = newSymlinkTo
              ? new SymlinkTarget(newSymlinkTo)
              : await fs.readFile(fullPath, "utf-8").catch(() => undefined);

            return [
              file.path,
              {
                lastApply,
                fsState:
                  newContent === undefined
                    ? "deleted"
                    : newContent === file.content
                      ? "unchanged"
                      : {
                          modifiedAt,
                          size,
                          content: newContent,
                        },
              },
            ] as const;
          },
        ),
      ),
    );
    return {
      rawCacheFile: {
        path: FILE_STATE_PATH,
        content,
        modifiedAt: stat.mtimeMs,
        size: stat.size,
      },
      cache,
    };
  } catch (e) {
    return { cache: new Map() };
  }
}
