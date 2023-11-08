// possibly use @reflink/reflink
// or in bun it should be supported to do: fs.copyFileSync('a', 'b', fs.constants.COPYFILE_FICLONE_FORCE)
// we probably wanna use glob to list all source and then copy them one by one

import fs from "node:fs/promises";
import path from "node:path";
import {
  type FilterFn,
  walkDirectoryRecursively,
} from "./walkDirectoryRecursively.js";
import {
  changeSourceMapSourcesToBeRelativeToAdjacentFiles,
  type RawSourceMap,
} from "./changeSourceMapSourcesToBeRelativeToAdjacentFiles.js";

interface Result {
  filePath: string;
  success: boolean;
}
export const correctSourceMaps = async ({
  buildDir,
}: {
  buildDir: string;
}): Promise<Result[]> => {
  const work: Promise<Result>[] = [];
  for await (const { directoryPath, entry } of walkDirectoryRecursively(
    buildDir,
    ({ entry }) =>
      entry.isDirectory() || (entry.isFile() && entry.name.endsWith(".map")),
  )) {
    if (entry.isDirectory()) continue;
    const fileName = entry.name;
    const filePath = path.join(directoryPath, fileName);
    work.push(
      (async (): Promise<Result> => {
        const rawMapFile = await fs.readFile(filePath, { encoding: "utf-8" });
        const sourceMap = JSON.parse(rawMapFile) as RawSourceMap;
        const newSourceMap =
          changeSourceMapSourcesToBeRelativeToAdjacentFiles(sourceMap);
        const newRawMapFile = JSON.stringify(newSourceMap);
        if (newRawMapFile !== rawMapFile) {
          await fs.writeFile(filePath, newRawMapFile);
        }
        return {
          filePath,
          success: true,
        };
      })().catch((error) => {
        console.error(
          `Error updating source map for ${filePath}:\n${error.message}`,
        );
        return {
          filePath,
          success: false,
        };
      }),
    );
  }

  // TODO: could show progress bar
  return Promise.all(work);
};
