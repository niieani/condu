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
  // we're not using the recursive option,
  // because we want to be able to filter out directories and selectively visit/recurse
  const dirHandle = await fs.opendir(directoryPath);
  // note: we do not need to close the dirHandle,
  // because we are using async iteration
  // and it will be closed automatically when the iteration is done
  for await (const file of dirHandle) {
    // TODO: support recursing into directory symlinks?
    if (file.isDirectory()) {
      const thisDirPath = path.join(directoryPath, file.name);
      if (!keep || keep({ directoryPath: thisDirPath, entry: file })) {
        yield * walkDirectoryRecursively(thisDirPath, keep);
      }
    } else {
      const fileData = { directoryPath, entry: file };
      if (!keep || keep(fileData)) {
        yield fileData;
      }
    }
  }
}
