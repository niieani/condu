import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

interface FileData {
  entry: Dirent;
  directoryPath: string;
}
export type FilterFn = (entry: FileData) => boolean;

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
        if (!filter || filter({ directoryPath: thisDirPath, entry: file })) {
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
