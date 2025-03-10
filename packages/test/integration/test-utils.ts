import fs from "node:fs/promises";
import path from "node:path";
import childProcess from "node:child_process";
import os from "node:os";
import { createPackageOverridesForLinking } from "@condu/core/utils/createPackageOverridesForLinking.js";
import { fileURLToPath } from "node:url";
import type { ConduPackageJson } from "condu";
import type { DirectoryItems } from "@condu-test/utils/getDirectoryStructureAndContentsRecursively.js";

/**
 * Creates a temporary directory for testing
 */
export async function createTempDir(prefix = "condu-test-"): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/**
 * Initializes a git repository in the given directory
 */
export async function initGitRepo(dir: string): Promise<void> {
  await execCommand("git init", { cwd: dir });
  await execCommand('git config user.name "Condu Test"', { cwd: dir });
  await execCommand('git config user.email "test@condu.test"', { cwd: dir });
}

/**
 * Creates a package.json file in the given directory
 */
export async function createRootPackageJson(
  dir: string,
  data: Partial<ConduPackageJson> = {},
  conduRoot?: string,
): Promise<ConduPackageJson> {
  const packageJson: ConduPackageJson = {
    name: "condu-test-project",
    version: "0.0.0",
    private: true,
    type: "module",
    scripts: { postinstall: "condu apply", ...data.scripts },
    ...data,
  };

  // Add pnpm overrides if conduRoot is provided
  if (conduRoot) {
    try {
      const pnpmOverrides: Record<string, string> = {};

      // Add overrides from condu's own node_modules directory to avoid remote fetches in tests
      const nodeModulesDir = path.join(conduRoot, "node_modules");
      try {
        const entries = await fs.readdir(nodeModulesDir, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          if (
            (entry.isDirectory() || entry.isSymbolicLink()) &&
            !entry.name.startsWith(".")
          ) {
            if (entry.name.startsWith("@")) {
              // Handle scoped packages - go one level deeper
              const scopeDir = path.join(nodeModulesDir, entry.name);
              const scopedEntries = await fs.readdir(scopeDir, {
                withFileTypes: true,
              });

              for (const scopedEntry of scopedEntries) {
                if (
                  (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) &&
                  !scopedEntry.name.startsWith(".")
                ) {
                  const packageName = `${entry.name}/${scopedEntry.name}`;
                  const packagePath = path.join(nodeModulesDir, packageName);
                  pnpmOverrides[packageName] = `link:${packagePath}`;
                }
              }
            } else {
              // Regular package
              pnpmOverrides[entry.name] =
                `link:${path.join(nodeModulesDir, entry.name)}`;
            }
          }
        }
      } catch (error) {
        console.error("Failed to process node_modules directory:", error);
      }

      const overrides = await createPackageOverridesForLinking({
        linkedProjectDir: conduRoot,
        targetPackageDir: dir,
      });

      // Convert overrides to pnpm format
      for (const [pkgName, pkgPath] of overrides) {
        pnpmOverrides[pkgName] = pkgPath;
      }

      // Add overrides to package.json
      packageJson.pnpm = {
        ...packageJson.pnpm,
        overrides: pnpmOverrides,
      };
    } catch (error) {
      console.error("Failed to create package overrides:", error);
    }
  }

  await fs.writeFile(
    path.join(dir, "package.json"),
    JSON.stringify(packageJson, undefined, 2),
  );

  return packageJson;
}

/**
 * Creates a condu configuration file
 */
export async function createConduConfig(
  dir: string,
  config: string,
): Promise<void> {
  const configDir = path.join(dir, ".config");
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(path.join(configDir, "condu.ts"), config);
}

/**
 * Executes a command in a specific directory
 */
export async function execCommand(
  command: string,
  options: { cwd: string; stdin?: string },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    if (process.env["NODE_ENV"] === "test" || options.stdin) {
      const child = childProcess.exec(
        command,
        { cwd: options.cwd },
        (error, stdout, stderr) => {
          resolve({
            stdout,
            stderr,
            code: error ? (error.code ?? 0) : 0,
          });
        },
      );

      if (options.stdin) {
        child.stdin?.write(options.stdin);
        child.stdin?.end();
      }
    } else {
      // used in manual debugging
      const child = childProcess.spawn(command, {
        shell: true,
        cwd: options.cwd,
        stdio: "inherit",
      });

      child.on("close", (code) => {
        resolve({
          stdout: "",
          stderr: "",
          code,
        });
      });
    }
  });
}

/**
 * Runs pnpm install in the specified directory
 */
export async function runPnpmInstall(dir: string) {
  const result = await execCommand("pnpm i", { cwd: dir });
  if (result.code !== 0) {
    throw new Error(`pnpm install failed: ${result.stderr || result.stdout}`);
  }
  if (result.stdout.includes("WARN")) {
    console.log(result.stdout);
  }
  return result;
}

/**
 * Runs condu apply in the specified directory
 */
export async function runConduApply(dir: string): Promise<void> {
  const result = await execCommand("pnpm exec condu apply", { cwd: dir });
  if (result.code !== 0) {
    throw new Error(`condu apply failed: ${result.stderr || result.stdout}`);
  }
}

/**
 * Creates a basic condu test project in a temporary directory
 */
export async function createBasicConduProject(
  conduConfig: string,
  packageJson: Record<string, any> = {},
  directoryStructure?: DirectoryItems,
  tempDir?: string,
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  // Use provided tempDir or create a new one
  const dir = tempDir ?? (await createTempDir());

  // Initialize git repository
  await initGitRepo(dir);

  // Get monorepo root for linking packages
  const conduRoot = getConduRoot();

  // Create package.json for the root package
  await createRootPackageJson(dir, packageJson, conduRoot);

  // Create condu config
  await createConduConfig(dir, conduConfig);

  // Create directory structure and contents if provided
  if (directoryStructure) {
    await createDirectoryStructureAndContents(dir, directoryStructure);
  }

  // Install dependencies and run condu apply (postinstall)
  await runPnpmInstall(dir);

  // TODO: for now we need to run this twice, because `pnpm install` runs `condu apply` which adds `pnpm-workspace.yaml`, which needs another `pnpm install`
  await runPnpmInstall(dir);

  // Return dir and cleanup function
  return {
    dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Creates files and directories recursively based on the provided structure
 */
export async function createDirectoryStructureAndContents(
  rootDir: string,
  structure: DirectoryItems,
): Promise<void> {
  for (const [name, content] of Object.entries(structure)) {
    const itemPath = path.join(rootDir, name);

    if (typeof content === "string") {
      // It's a file, write the content
      await fs.writeFile(itemPath, content);
    } else {
      // It's a directory, create it and recurse
      await fs.mkdir(itemPath, { recursive: true });
      await createDirectoryStructureAndContents(itemPath, content);
    }
  }
}

/**
 * Checks if a file exists and optionally validates its content
 */
export async function checkFile(
  dir: string,
  filePath: string,
  contentValidator?: (content: string) => boolean,
): Promise<boolean> {
  const fullPath = path.join(dir, filePath);

  try {
    const stats = await fs.stat(fullPath);
    if (!stats.isFile()) return false;

    if (contentValidator) {
      const content = await fs.readFile(fullPath, "utf-8");
      return contentValidator(content);
    }

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the root directory of the condu monorepo
 */
export function getConduRoot(): string {
  // Get the directory containing this file
  const thisFilePath = fileURLToPath(import.meta.url);
  const thisDir = path.dirname(thisFilePath);

  // Resolve the root of the monorepo (3 levels up from the integration directory)
  return path.resolve(thisDir, "../../..");
}
