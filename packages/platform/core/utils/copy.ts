// possibly use @reflink/reflink
// or in bun it should be supported to do: fs.copyFileSync('a', 'b', fs.constants.COPYFILE_FICLONE_FORCE)
// we probably wanna use glob to list all source and then copy them one by one

import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

interface FileData {
  entry: Dirent;
  directoryPath: string;
}

type FilterFn = (entry: FileData) => boolean;

export async function* walkDirectoryRecursively(
  directoryPath: string,
  filter?: FilterFn,
): AsyncIterableIterator<FileData> {
  // const files = await fs.readdir(directoryPath, { withFileTypes: true });

  // we're not using the recursive option,
  // because we want to be able to filter out directories and not recurse into them
  const dirHandle = await fs.opendir(directoryPath);
  try {
    for await (const file of dirHandle) {
      // TODO: support recursing into directory symlinks?
      if (file.isDirectory()) {
        const thisDirPath = path.join(directoryPath, file.name);
        if (!filter || filter({ entry: file, directoryPath: thisDirPath })) {
          yield* walkDirectoryRecursively(thisDirPath, filter);
        }
      } else {
        const fileData = { directoryPath, entry: file };
        if (!filter || filter(fileData)) {
          yield fileData;
        }
      }
    }
  } finally {
    await dirHandle.close();
  }
}

export const copyFiles = async ({
  sourceDir,
  targetDir,
  filter,
}: {
  sourceDir: string;
  targetDir: string;
  filter?: FilterFn;
}) => {
  const work: Promise<void>[] = [];
  const createdDirectories = new Set<string>();

  await fs.mkdir(targetDir, { recursive: true });

  for await (const {
    directoryPath,
    entry: { name: fileName },
  } of walkDirectoryRecursively(sourceDir, filter)) {
    const relativePathToDir = path.relative(sourceDir, directoryPath);
    const thisTargetDir = path.join(targetDir, relativePathToDir);
    const targetFilePath = path.join(thisTargetDir, fileName);
    work.push(
      (async (): Promise<void> => {
        if (!createdDirectories.has(thisTargetDir)) {
          // recursive shouldn't be necessary since we're walking directories in order
          await fs.mkdir(thisTargetDir, { recursive: true });
          createdDirectories.add(thisTargetDir);
        }
        const sourceFilePath = path.join(directoryPath, fileName);
        await fs.copyFile(
          sourceFilePath,
          targetFilePath,
          // use copy-on-write strategy for performance if supported
          fs.constants.COPYFILE_FICLONE,
        );
        console.log(`Copied ${targetFilePath}`);
      })().catch((error) => {
        console.error(`Error copying ${targetFilePath}:\n${error.message}`);
      }),
    );
  }

  // TODO: could show progress bar
  await Promise.all(work);
};
