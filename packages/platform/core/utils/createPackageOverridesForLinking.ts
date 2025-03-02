import { getWorkspace } from "@condu/workspace-utils/topo.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export interface LinkingOptions {
  /** the foreign project that you want to link to */
  linkedProjectDir?: string;
  /** the project you're aiming to install linked dependencies in */
  targetPackageDir: string;
  /**
   * the protocol you want to use to resolve the dependencies
   * @example "file:" or "link:"
   */
  protocol?: string;
  /** e.g. to prefix target path with 'build' or 'dist' */
  modifyTargetDir?: (dir: string) => string;
}

export async function createPackageOverridesForLinking({
  linkedProjectDir,
  targetPackageDir,
  protocol = "link:",
  modifyTargetDir,
}: LinkingOptions) {
  const project = await getWorkspace({ cwd: linkedProjectDir });
  // resolve the real path in case it's a symlink, which would cause an incorrect relative path
  const realTargetPackageDir = await fs.realpath(targetPackageDir);
  const overrideList = Object.values(project.packages).map(
    ({ relPath: dir, manifest }) =>
      [
        manifest.name,
        `${protocol}${path.relative(
          realTargetPackageDir,
          path.join(
            project.root.absPath,
            modifyTargetDir ? modifyTargetDir(dir) : dir,
          ),
        )}`,
      ] as const,
  );
  return overrideList;
}

// const __dirname = new URL(".", import.meta.url).pathname;

// const overrides = await createOverrides({
//   targetPackageDir: path.join(__dirname, "example-repo"),
// });

// console.log(JSON.stringify(overrides, undefined, 2));
