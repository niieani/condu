import fs from "node:fs/promises";
import path from "node:path";
import childProcess from "node:child_process";
import os from "node:os";
import { createPackageOverridesForLinking } from "@condu/core/utils/createPackageOverridesForLinking.js";
import { fileURLToPath } from "node:url";
import type { ConduPackageJson } from "condu";

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
export async function createPackageJson(
  dir: string,
  data: Record<string, any> = {},
  conduRoot?: string,
): Promise<ConduPackageJson> {
  const defaultData: ConduPackageJson = {
    name: "condu-test-project",
    version: "0.0.0",
    private: true,
    type: "module",
  };

  const packageJson = { ...defaultData, ...data };

  // Add pnpm overrides if monorepoRoot is provided
  if (conduRoot) {
    try {
      const overrides = await createPackageOverridesForLinking({
        linkedProjectDir: conduRoot,
        targetPackageDir: dir,
      });

      // Convert overrides to pnpm format
      const pnpmOverrides: Record<string, string> = {};
      for (const [pkgName, pkgPath] of overrides) {
        pnpmOverrides[pkgName] = pkgPath;
      }

      // Add overrides to package.json
      packageJson.pnpm = {
        ...(packageJson.pnpm || {}),
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
  options: { cwd: string },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
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
  });
}

/**
 * Runs pnpm install in the specified directory
 */
export async function runPnpmInstall(dir: string): Promise<void> {
  const result = await execCommand("pnpm install", { cwd: dir });
  if (result.code !== 0) {
    throw new Error(`pnpm install failed: ${result.stderr || result.stdout}`);
  }
  if (result.stdout.includes("WARN")) {
    console.log(result.stdout);
  }
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
): Promise<{ dir: string; cleanup: () => Promise<void> }> {
  // Create temporary directory
  const dir = await createTempDir();

  // Initialize git repository
  await initGitRepo(dir);

  // Get monorepo root for linking packages
  const conduRoot = getConduRoot();

  // Create package.json with monorepo links
  await createPackageJson(dir, packageJson, conduRoot);

  // Create condu config
  await createConduConfig(dir, conduConfig);

  // Return dir and cleanup function
  return {
    dir,
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
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
