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
  customExportsCondition?: boolean | string;

  /**
   * Automatically use a single file in a directory if it's the only one
   * and its basename is semantically equivalent to the directory name (insensitive to snake_case vs camelCase, etc.)
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
        }),
      );
    },
  });
}

// Function to normalize file paths for comparison
function toCompareCase(str: string): string {
  return str.replace(/[^\dA-Za-z]/g, "").toLowerCase();
}

/**
 * Creates a modifier function that adds exports to package.json
 */
function createExportsModifier({
  customExportsCondition,
  useSingleFileInDirectory,
}: AutoPackageExportsOptions): PackageJsonPublishModifier {
  return async (
    pkg: ConduPackageJson,
    { targetPackage, publishableSourceFiles },
  ) => {
    // Map to store preferred entry points for each directory
    const preferredDirectoryEntries = new Map<string, string>();

    // Process publishable source files
    const filesByDirectory = new Map<string, string[]>();

    // Group files by their directory
    for (const relativePath of publishableSourceFiles) {
      const dir = path.dirname(relativePath);
      const fileName = path.basename(relativePath);

      const dirFiles = filesByDirectory.get(dir) ?? [];
      dirFiles.push(fileName);
      filesByDirectory.set(dir, dirFiles);
    }

    // Process each directory
    for (const [dirPath, files] of filesByDirectory.entries()) {
      if (files.length === 0) continue;

      // If there's only one file in the directory and useSingleFileInDirectory is true
      if (useSingleFileInDirectory && files.length === 1) {
        const fileName = files[0]!;

        // Only use the single file if its basename matches the directory name
        const directoryName = path.basename(dirPath);
        const fileBaseName = path.basename(fileName, path.extname(fileName));

        if (fileBaseName === directoryName) {
          preferredDirectoryEntries.set(dirPath, fileName);
        }
      }

      // Otherwise, look for preferred entry points
      for (const fileName of files) {
        const directoryBaseName =
          dirPath === "." ? targetPackage.scopedName : path.basename(dirPath);

        const basename = path.basename(fileName, path.extname(fileName));
        const existingPreference = preferredDirectoryEntries.get(dirPath);

        if (
          basename === "index" ||
          (basename === "main" && !existingPreference?.startsWith("index")) ||
          (!existingPreference &&
            (basename === directoryBaseName ||
              toCompareCase(basename) === toCompareCase(directoryBaseName)))
        ) {
          preferredDirectoryEntries.set(dirPath, fileName);
        }
      }
    }

    // Generate exports entries
    const generatedExports = Object.fromEntries(
      [...preferredDirectoryEntries].map(([dir, entry]) => {
        const basename = path.basename(entry, path.extname(entry));
        const exportsPath = dir === "." ? dir : `${dir}/`;

        const exportEntry: Record<string, string> = {};

        // Add custom exports condition if enabled
        if (customExportsCondition && pkg.name) {
          // Use the package name or scope (if present) as the condition name
          const conditionName =
            typeof customExportsCondition === "string"
              ? customExportsCondition
              : (targetPackage.scope ?? targetPackage.scopedName);
          exportEntry[conditionName] = `./${exportsPath}${entry}`;
        }

        // object order is significant for node exports
        exportEntry["source"] = `./${exportsPath}${entry}`;
        exportEntry["bun"] = `./${exportsPath}${entry}`;
        exportEntry["import"] = `./${exportsPath}${basename}.js`;
        exportEntry["require"] = `./${exportsPath}${basename}.cjs`;
        exportEntry["default"] = `./${exportsPath}${basename}.js`;

        return [dir === "." ? "." : `./${dir}`, exportEntry];
      }),
    );

    // Merge with existing exports
    return {
      ...pkg,
      exports: {
        ...generatedExports,
        // existing export always override:
        ...(typeof pkg.exports === "object" ? pkg.exports : {}),
        "./*.json": "./*.json",
        "./*.js": {
          bun: "./*.ts",
          import: "./*.js",
          require: "./*.cjs",
          default: "./*.js",
        },
      },
    };
  };
}
