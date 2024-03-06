import fs from "node:fs/promises";
import path from "node:path";
import type { FileDef, RepoPackageJson } from "@condu/core/configTypes.js";
import yaml from "yaml";
import commentJson from "comment-json";
import { P, match } from "ts-pattern";
import { printUnifiedDiff } from "print-diff";
import readline from "node:readline/promises";
import { CONFIG_DIR } from "./constants.js";

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

const getGetExistingContent =
  (targetPath: string, onExecuted: () => void) =>
  async (): Promise<string | object | undefined> => {
    onExecuted();
    const extension = path.extname(targetPath);
    const file = (await fs.readFile(targetPath)).toString();
    return match(extension)
      .with(P.string.regex(/\.ya?ml$/i), () => yaml.parse(file))
      .with(P.string.regex(/\.json5?$/i), () => commentJson.parse(file))
      .otherwise(() => file);
  };

const writeFileFromDef = async ({
  file,
  rootDir,
  manifest,
  projectDir,
  previouslyWrittenFiles,
}: {
  file: FileDef;
  rootDir: string;
  manifest: RepoPackageJson;
  projectDir: string;
  previouslyWrittenFiles: Map<string, CachedWrittenFile>;
}): Promise<(() => Promise<WrittenFile>) | WrittenFile | undefined> => {
  const targetPath = path.join(rootDir, file.path);
  const pathFromProjectDir = path.relative(projectDir, targetPath);

  const previouslyWritten = previouslyWrittenFiles.get(pathFromProjectDir);
  // marking as handled:
  previouslyWrittenFiles.delete(pathFromProjectDir);

  let usedExistingContent = false;
  const resolvedContent =
    typeof file.content === "function"
      ? ((await file.content({
          manifest,
          getExistingContentAndMarkAsUserEditable: getGetExistingContent(
            targetPath,
            () => {
              usedExistingContent = true;
            },
          ),
        })) as string | object | undefined)
      : file.content;

  if (resolvedContent === undefined) {
    if (previouslyWritten) {
      console.log(`Deleting, no longer needed: ${pathFromProjectDir}`);
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
    console.log(`Already fresh: ${pathFromProjectDir}`);
    return previouslyWritten;
  }

  // only show diff if we're not "enhancing" a manually editable file
  if (
    typeof previouslyWritten?.manuallyChanged === "object" &&
    !usedExistingContent
  ) {
    const manuallyChanged = previouslyWritten.manuallyChanged;
    // this needs to happen sequentially, because we're prompting the user for input:
    return async () => {
      console.log(`Manual changes present in ${pathFromProjectDir}:`);
      printUnifiedDiff(manuallyChanged.content, content, process.stdout);
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
        return write({ targetPath, content, pathFromProjectDir });
      } else {
        console.log(`Skipping: ${pathFromProjectDir}`);
        return {
          path: file.path,
          writtenAt: previouslyWritten.writtenAt,
          content: previouslyWritten.content,
        };
      }
    };
  }

  return write({ targetPath, content, pathFromProjectDir });
};

async function write({
  targetPath,
  content,
  pathFromProjectDir,
}: {
  targetPath: string;
  content: string;
  pathFromProjectDir: string;
}): Promise<WrittenFile> {
  console.log(`Writing: ${targetPath}`);
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(targetPath, content);
  const stat = await fs.stat(targetPath);
  const result: WrittenFile = {
    path: pathFromProjectDir,
    content,
    writtenAt: stat.mtimeMs,
  };
  return result;
}

export async function writeFiles({
  files,
  targetPackageDir,
  manifest,
  projectDir,
  previouslyWrittenFiles,
}: {
  files: readonly FileDef[];
  targetPackageDir: string;
  manifest: RepoPackageJson;
  projectDir: string;
  previouslyWrittenFiles: Map<string, CachedWrittenFile>;
}) {
  const rootDir = path.join(projectDir, targetPackageDir);
  const filesOrFns = await Promise.all(
    files.map((file) =>
      writeFileFromDef({
        file,
        rootDir,
        manifest,
        projectDir,
        previouslyWrittenFiles,
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
  projectDir: string,
): Promise<Map<string, CachedWrittenFile>> {
  try {
    const file = await fs.readFile(path.join(projectDir, FILE_STATE_PATH));
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
            const fullPath = path.join(projectDir, file.path);
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
