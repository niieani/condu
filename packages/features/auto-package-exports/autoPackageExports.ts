import * as path from "node:path";
import {
  defineFeature,
  type ReadonlyConduProject,
  type PackageJsonPublishModifier,
} from "condu";
import type { ConduPackageJson } from "@condu/workspace-utils/packageJsonTypes.js";

export interface AutoPackageExportsOptions {
  /**
   * Custom exports condition to add (using the package name)
   * that points to the source TypeScript files
   */
  customExportsCondition?: boolean;

  /**
   * Automatically use a single file in a directory if it's the only one
   * @default true
   */
  useSingleFileInDirectory?: boolean;
}

/**
 * Feature for auto-generating package.json exports based on source files
 */
export function autoPackageExports(options: AutoPackageExportsOptions = {}) {
  const { customExportsCondition = false, useSingleFileInDirectory = true } =
    options;

  return defineFeature("auto-package-exports", {
    defineRecipe(condu) {
      // Apply to all packages
      condu.in({ kind: "package" }).modifyPublishedPackageJson(
        createExportsModifier({
          customExportsCondition,
          useSingleFileInDirectory,
          project: condu.project,
        }),
      );
    },
  });
}

/**
 * Creates a modifier function that adds exports to package.json
 */
// Function to normalize file paths for comparison
function toCompareCase(str: string): string {
  return str.replace(/[^\dA-Za-z]/g, "").toLowerCase();
}

function createExportsModifier({
  customExportsCondition,
  useSingleFileInDirectory,
  project,
}: AutoPackageExportsOptions & {
  project: ReadonlyConduProject;
}): PackageJsonPublishModifier {
  return async (
    pkg: ConduPackageJson,
    { globalRegistry, targetPackage, publishableSourceFiles },
  ) => {
    // Safely access config and conventions
    const config = project.config || {};
    const conventions = config.conventions || {};
    const sourceDir = conventions.sourceDir || ".";

    const { absPath: packagePath } = targetPackage;

    // Determine the source directory for this package
    const packageSourceDir = path.join(packagePath, sourceDir);

    // Map to store preferred entry points for each directory
    const preferredDirectoryEntries = new Map<string, string>();

    try {
      // Scan the source directory to find entry points
      const { readdir } = await import("node:fs/promises");

      // Recursive function to scan directories
      async function scanDirectory(dirPath: string) {
        try {
          const entries = await readdir(dirPath, { withFileTypes: true });

          // First, handle directories
          for (const entry of entries.filter((e) => e.isDirectory())) {
            if (entry.name === "node_modules" || entry.name.startsWith(".")) {
              continue;
            }
            await scanDirectory(path.join(dirPath, entry.name));
          }

          // Then, handle files
          const files = entries.filter((e) => !e.isDirectory());

          // If there's only one file in the directory and useSingleFileInDirectory is true
          if (useSingleFileInDirectory && files.length === 1) {
            const entry = files[0];
            if (entry && !shouldSkipFile(entry.name)) {
              // Only use the single file if its basename matches the directory name
              const directoryName = path.basename(dirPath);
              const fileBaseName = path.basename(
                entry.name,
                path.extname(entry.name),
              );

              if (fileBaseName === directoryName) {
                preferredDirectoryEntries.set(dirPath, entry.name);
              }
            }
            return;
          }

          // Otherwise, look for preferred entry points
          for (const entry of files) {
            if (shouldSkipFile(entry.name)) {
              continue;
            }

            const directoryBaseName = path.basename(dirPath);
            const basename = path.basename(
              entry.name,
              path.extname(entry.name),
            );
            const existingPreference = preferredDirectoryEntries.get(dirPath);

            if (
              basename === "index" ||
              (basename === "main" &&
                !existingPreference?.startsWith("index")) ||
              (!existingPreference &&
                (basename === directoryBaseName ||
                  toCompareCase(basename) === toCompareCase(directoryBaseName)))
            ) {
              preferredDirectoryEntries.set(dirPath, entry.name);
            }
          }
        } catch (error) {
          // Directory might not exist, just continue
        }
      }

      await scanDirectory(packageSourceDir);
    } catch (error) {
      // If there's an error reading the directory, just return the original package
      return pkg;
    }

    // Generate exports entries
    const generatedExports = Object.fromEntries(
      [...preferredDirectoryEntries]
        .map(([dir, entry]) => {
          // Get the path relative to the package source directory
          const pathToDir = path.relative(packageSourceDir, dir);
          const basename = path.basename(entry, path.extname(entry));
          const suffixedPath = pathToDir === "" ? pathToDir : `${pathToDir}/`;

          // Make sure we're only including paths within this package
          if (pathToDir.startsWith("..")) {
            return undefined; // Skip this entry as it's outside the package
          }

          const exportEntry: Record<string, string> = {
            source: `./${suffixedPath}${entry}`,
            bun: `./${suffixedPath}${entry}`,
            import: `./${suffixedPath}${basename}.js`,
            require: `./${suffixedPath}${basename}.cjs`,
            default: `./${suffixedPath}${basename}.js`,
          };

          // Add custom exports condition if enabled
          if (customExportsCondition && pkg["name"]) {
            // Use the package name (without scope) as the condition name
            const conditionName = pkg["name"].split("/").pop() || pkg["name"];
            exportEntry[conditionName] = `./${suffixedPath}${entry}`;
          }

          return [pathToDir === "" ? "." : `./${pathToDir}`, exportEntry];
        })
        // Filter out undefined entries
        .filter(
          (entry): entry is [string, Record<string, string>] =>
            entry !== undefined,
        ),
    );

    // Merge with existing exports
    return {
      ...pkg,
      ["exports"]: {
        ...generatedExports,
        "./*.json": "./*.json",
        "./*.js": {
          bun: "./*.ts",
          import: "./*.js",
          require: "./*.cjs",
          default: "./*.js",
        },
        ...(typeof pkg["exports"] === "object" ? pkg["exports"] : {}),
      },
      // Set type to module if not already set
      ["type"]: pkg["type"] || "module",
    };
  };
}

/**
 * Determines if a file should be skipped when generating exports
 */
function shouldSkipFile(filename: string): boolean {
  return (
    filename.includes(".test.") ||
    filename.includes(".fixture.") ||
    /\.d\.[cm]?ts$/.test(filename) ||
    /tsconfig\..*\.json$/.test(filename) ||
    filename.includes(".gen.") ||
    filename.includes(".generated.")
  );
}
