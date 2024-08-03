import fs from "node:fs/promises";
import path from "node:path";
import type {
  FileDef,
  GetExistingContentFn,
  ConduPackageJson,
  WorkspacePackage,
} from "@condu/types/configTypes.js";
import yaml from "yaml";
import commentJson from "comment-json";
import { P, match } from "ts-pattern";
import { printUnifiedDiff } from "print-diff";
import readline from "node:readline/promises";
import { CONFIG_DIR } from "@condu/types/constants.js";

export const FILE_STATE_PATH = `${CONFIG_DIR}/.cache/files.json`;

const stringify = (obj: unknown, filePath: string) =>
  /\.ya?ml$/i.test(filePath)
    ? yaml.stringify(obj)
    : commentJson.stringify(obj, undefined, 2);

export interface WrittenFile {
  path: string;
  content: string;
  writtenAt: number;
}

interface CachedWrittenFile extends WrittenFile {
  manuallyChanged?:
    | {
        at: number;
        content: string;
      }
    | "deleted";
}

const createGetExistingContentFn =
  (targetPath: string, onExecuted: () => void): GetExistingContentFn =>
  async (defaultFallback?) => {
    onExecuted();
    const extension = path.extname(targetPath);
    try {
      const file = (await fs.readFile(targetPath)).toString();
      return match(extension)
        .with(P.string.regex(/\.ya?ml$/i), () => yaml.parse(file))
        .with(P.string.regex(/\.json5?$/i), () => commentJson.parse(file))
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
      await fs.rm(targetPath);
    }
    // nothing to add to cache state:
    return;
  }

  const content =
    typeof resolvedContent === "string"
      ? resolvedContent
      : stringify(resolvedContent, file.path);

  if (
    previouslyWritten &&
    !previouslyWritten.manuallyChanged &&
    content === previouslyWritten.content
  ) {
    // TODO: if (DEBUG)
    // console.log(`Already fresh: ${pathFromWorkspaceDirAbs}`);
    return previouslyWritten;
  }

  // only show diff if we're not "enhancing" a manually editable file,
  // and the file doesn't have the 'alwaysOverwrite' flag
  if (
    typeof previouslyWritten?.manuallyChanged === "object" &&
    !usedExistingContent &&
    !file.alwaysOverwrite
  ) {
    if (throwOnManualChanges) {
      throw new Error(
        `Manual changes present in ${pathFromWorkspaceDirAbs}, cannot continue.`,
      );
    }
    const manuallyChanged = previouslyWritten.manuallyChanged;
    const isInteractive =
      process.stdout.isTTY &&
      process.stdin.isTTY &&
      process.env["npm_lifecycle_event"] !== "postinstall";

    // this needs to happen sequentially, because we're prompting the user for input:
    return async () => {
      console.log(`Manual changes present in ${pathFromWorkspaceDirAbs}:`);
      printUnifiedDiff(manuallyChanged.content, content, process.stdout);
      if (!isInteractive) {
        process.exitCode = 1;
        console.log(
          `Please resolve the conflict by running 'condu apply' interactively. Skipping: ${pathFromWorkspaceDirAbs}`,
        );
        return {
          path: file.path,
          writtenAt: previouslyWritten.writtenAt,
          content: previouslyWritten.content,
        };
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
          content,
          pathFromWorkspaceDirAbs,
        });
      } else {
        process.exitCode = 1;
        console.log(
          `Please update your config and re-run 'condu apply' when ready. Skipping: ${pathFromWorkspaceDirAbs}`,
        );
        return {
          path: file.path,
          writtenAt: previouslyWritten.writtenAt,
          content: previouslyWritten.content,
        };
      }
    };
  }

  return write({ targetPath, content, pathFromWorkspaceDirAbs });
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
    writtenAt: stat.mtimeMs,
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
        workspaceDirAbs: workspaceDirAbs,
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
): Promise<Map<string, CachedWrittenFile>> {
  try {
    const file = await fs.readFile(path.join(workspaceDir, FILE_STATE_PATH));
    const cache = JSON.parse(file.toString()) as WrittenFile[];
    return new Map(
      await Promise.all(
        cache.map(
          async (file): Promise<readonly [string, CachedWrittenFile]> => {
            const fileName = path.basename(file.path);
            if (fileName === "tsconfig.json") {
              // TODO: how do we handle tsconfig edited by moon?
              // ignore changes for now
              return [file.path, file];
            }
            const fullPath = path.join(workspaceDir, file.path);
            const stat = await fs.stat(fullPath).catch(() => undefined);
            if (!stat) {
              return [file.path, { ...file, manuallyChanged: "deleted" }];
            }
            const newContent = (await fs.readFile(fullPath)).toString();
            return [
              file.path,
              {
                ...file,
                manuallyChanged: !stat
                  ? "deleted"
                  : stat?.atimeMs !== file.writtenAt &&
                      newContent !== file.content
                    ? {
                        at: stat.atimeMs,
                        content: newContent,
                      }
                    : undefined,
              },
            ] as const;
          },
        ),
      ),
    );
  } catch (e) {
    return new Map();
  }
}
