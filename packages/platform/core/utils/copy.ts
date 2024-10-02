// possibly use @reflink/reflink
// or in bun it should be supported to do: fs.copyFileSync('a', 'b', fs.constants.COPYFILE_FICLONE_FORCE)
// we probably wanna use glob to list all source and then copy them one by one

import fs from "node:fs/promises";
import path from "node:path";
import {
  type FilterFn,
  walkDirectoryRecursively,
} from "./walkDirectoryRecursively.js";

interface CopyResult {
  source: string;
  target: string;
  success: boolean;
}
export const copyFiles = async ({
  sourceDir,
  targetDir,
  filter,
  overwrite = false,
}: {
  sourceDir: string;
  targetDir: string;
  filter?: FilterFn;
  overwrite?: boolean;
}): Promise<CopyResult[]> => {
  const work: Promise<CopyResult>[] = [];
  const createdDirectories = new Set<string>();

  await fs.mkdir(targetDir, { recursive: true });

  for await (const {
    directoryPath,
    entry: { name: fileName },
  } of walkDirectoryRecursively(sourceDir, filter)) {
    const relativePathToDir = path.relative(sourceDir, directoryPath);
    const thisTargetDir = path.join(targetDir, relativePathToDir);
    const targetFilePath = path.join(thisTargetDir, fileName);
    const sourceFilePath = path.join(directoryPath, fileName);

    work.push(
      (async (): Promise<CopyResult> => {
        if (!createdDirectories.has(thisTargetDir)) {
          // recursive shouldn't be necessary since we're walking directories in order
          await fs.mkdir(thisTargetDir, { recursive: true });
          createdDirectories.add(thisTargetDir);
        }
        await fs.copyFile(
          sourceFilePath,
          targetFilePath,
          // use copy-on-write strategy for performance if supported
          fs.constants.COPYFILE_FICLONE |
            // and overwrite only if specified
            (overwrite ? 0 : fs.constants.COPYFILE_EXCL),
        );
        // TODO: if debug
        // console.log(`Copied ${targetFilePath}`);
        return {
          source: sourceFilePath,
          target: targetFilePath,
          success: true,
        };
      })().catch((error) => {
        console.error(`Error copying ${targetFilePath}:\n${error.message}`);
        return {
          source: sourceFilePath,
          target: targetFilePath,
          success: false,
        };
      }),
    );
  }

  // TODO: could show progress bar
  return Promise.all(work);
};
