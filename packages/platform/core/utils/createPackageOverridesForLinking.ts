import { getWorkspace } from "@condu/workspace-utils/topo.js";
import * as path from "node:path";

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
  protocol = "file:",
  modifyTargetDir,
}: LinkingOptions) {
  const project = await getWorkspace({ cwd: linkedProjectDir });
  const overrideList = Object.values(project.packages).map(
    ({ relPath: dir, manifest }) =>
      [
        manifest.name,
        `${protocol}${path.relative(
          targetPackageDir,
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
