import type { Dirent } from "node:fs";
import * as fs from "node:fs/promises";
import * as path from "node:path";

interface FileData {
  entry: Dirent;
  directoryPath: string;
}
export type KeepFn = (entry: FileData) => boolean;

export async function* walkDirectoryRecursively(
  directoryPath: string,
  keep?: KeepFn,
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
        if (!keep || keep({ directoryPath: thisDirPath, entry: file })) {
          yield* walkDirectoryRecursively(thisDirPath, keep);
        }
      } else {
        const fileData = { directoryPath, entry: file };
        if (!keep || keep(fileData)) {
          yield fileData;
        }
      }
    }
  } finally {
    await dirHandle.close();
  }
}
