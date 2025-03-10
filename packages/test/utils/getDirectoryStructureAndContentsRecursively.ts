import fs from "node:fs";
import path from "node:path";

export interface DirectoryItems {
  [name: string]: string | DirectoryItems;
}

// Get a snapshot of the full filesystem
export const getDirectoryStructureAndContentsRecursively = async (
  dirPath: string,
  directoryItems: DirectoryItems = {},
  ignore: string[] = [],
): Promise<DirectoryItems> => {
  const result = directoryItems;
  const files = await fs.promises.readdir(dirPath, {
    withFileTypes: true,
  });

  for (const file of files) {
    if (ignore.includes(file.name)) {
      continue;
    }
    const fullPath = path.join(dirPath, file.name);

    if (file.isDirectory()) {
      result[file.name] ??= await getDirectoryStructureAndContentsRecursively(
        fullPath,
        {},
        ignore,
      );
    } else if (file.isFile()) {
      try {
        result[file.name] = await fs.promises.readFile(fullPath, "utf-8");
      } catch (e) {
        result[file.name] = String(e);
      }
    } else if (file.isSymbolicLink()) {
      result[file.name] = `symlink to: ${await fs.promises.readlink(fullPath)}`;
    } else {
      result[file.name] = `unknown file type`;
    }
  }

  return result;
};
