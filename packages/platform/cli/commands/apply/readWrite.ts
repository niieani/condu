import fs from "node:fs/promises";
import path from "node:path";
import type {
  FileDef,
  GetExistingContentFn,
  WorkspacePackage,
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
  files: WrittenFile[];
}

export interface WrittenFile {
  path: string;
  content: string;
  modifiedAt: number;
  size: number;
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
      ? ((await file.content({
          pkg: targetPackage,
          getExistingContentAndMarkAsUserEditable: createGetExistingContentFn(
            targetPath,
            () => {
              usedExistingContent = true;
            },
          ),
        })) as string | object | undefined)
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
    typeof resolvedContent === "string"
      ? resolvedContent
      : stringify(resolvedContent, file.path);

  if (
    previouslyWritten?.fsState === "unchanged" &&
    newContent === previouslyWritten.lastApply.content
  ) {
    // TODO: if (DEBUG)
    // console.log(`Already fresh: ${pathFromWorkspaceDirAbs}`);
    return previouslyWritten.lastApply;
  }

  // only show diff if we're not "enhancing" a manually editable file,
  // and the file doesn't have the 'alwaysOverwrite' flag
  if (
    typeof previouslyWritten?.fsState === "object" &&
    !usedExistingContent &&
    !file.alwaysOverwrite
  ) {
    if (previouslyWritten.fsState.content === newContent) {
      return {
        path: pathFromWorkspaceDirAbs,
        ...previouslyWritten.fsState,
      };
    }

    if (throwOnManualChanges) {
      throw new Error(
        `Manual changes present in ${pathFromWorkspaceDirAbs}, cannot continue.`,
      );
    }
    const fsContent = previouslyWritten.fsState;
    const isInteractive =
      process.stdout.isTTY &&
      process.stdin.isTTY &&
      process.env["npm_lifecycle_event"] !== "postinstall";

    // this needs to happen sequentially, because we're prompting the user for input:
    return async () => {
      console.log(`Manual changes present in ${pathFromWorkspaceDirAbs}`);
      printUnifiedDiff(fsContent.content, newContent, process.stdout);
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

  return write({ targetPath, content: newContent, pathFromWorkspaceDirAbs });
};

async function write({
  targetPath,
  content,
  pathFromWorkspaceDirAbs,
}: {
  targetPath: string;
  content: string;
  pathFromWorkspaceDirAbs: string;
}): Promise<WrittenFile> {
  console.log(`Writing: ${targetPath}`);
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(targetPath, content);
  const stat = await fs.stat(targetPath);
  const result: WrittenFile = {
    path: pathFromWorkspaceDirAbs,
    content,
    modifiedAt: stat.mtimeMs,
    size: stat.size,
  };
  return result;
}

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
      }),
    ),
  );
  const writtenFiles: WrittenFile[] = [];
  // this needs to happen sequentially, because we're prompting the user for input
  for (const fileOrFn of filesOrFns) {
    if (!fileOrFn) continue;
    writtenFiles.push(
      typeof fileOrFn === "function" ? await fileOrFn() : fileOrFn,
    );
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
    const stat = await fs.stat(cachePath);
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
            // const fileName = path.basename(file.path);
            // if (fileName === "tsconfig.json") {
            //   // TODO: how do we handle tsconfig edited by moon?
            //   // ignore changes for now
            //   return [file.path, { lastApply: file, fsState: "unchanged" }];
            // }
            const fullPath = path.join(workspaceDir, file.path);
            const stat = await fs.stat(fullPath).catch(() => undefined);
            if (!stat) {
              return [file.path, { lastApply: file, fsState: "deleted" }];
            }
            if (stat.mtimeMs === file.modifiedAt && stat.size === file.size) {
              // presuming no changes, no need to re-read the file
              return [file.path, { lastApply: file, fsState: "unchanged" }];
            }
            const newContent = await fs.readFile(fullPath, "utf-8");
            return [
              file.path,
              {
                lastApply: file,
                fsState:
                  newContent === file.content
                    ? "unchanged"
                    : {
                        modifiedAt: stat.mtimeMs,
                        size: stat.size,
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
