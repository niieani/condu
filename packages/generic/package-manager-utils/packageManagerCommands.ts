/**
 * Utility functions for generating package manager commands
 */

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

/**
 * Options for generating the run command
 */
export interface RunCommandOptions {
  /** Whether to execute in workspace packages recursively (monorepo only) */
  recursive?: boolean;
  /** Use the exact command specified (no prefix/suffix added) */
  exact?: boolean;
  /** Optional filter to apply (only applicable for some package managers) */
  filter?: string;
  /** Whether to use workspace syntax */
  workspace?: boolean;
}

/**
 * Generate a command to run a script based on the package manager
 *
 * @param packageManager - The package manager to use
 * @param scriptName - The name of the script to run
 * @param options - Options for the command
 * @returns The command to run the script
 */
export function getRunCommand(
  packageManager: PackageManager,
  scriptName: string,
  options: RunCommandOptions = {},
): string {
  const {
    recursive = false,
    exact = false,
    filter,
    workspace = false,
  } = options;

  if (exact) {
    return scriptName;
  }

  if (recursive) {
    switch (packageManager) {
      case "npm":
        return `npm run --workspaces ${scriptName}`;
      case "yarn":
        // yarn v2+ uses 'workspace foreach'
        return `yarn workspace foreach ${scriptName}`;
      case "pnpm":
        return `pnpm -r run ${scriptName}`;
      case "bun":
        return `bun --filter "${filter || "*"}" run ${scriptName}`;
      default:
        return `${packageManager} run ${scriptName}`;
    }
  }

  if (workspace && filter) {
    switch (packageManager) {
      case "npm":
        return `npm run --workspace=${filter} ${scriptName}`;
      case "yarn":
        return `yarn workspace ${filter} run ${scriptName}`;
      case "pnpm":
        return `pnpm --filter ${filter} run ${scriptName}`;
      case "bun":
        return `bun --filter ${filter} run ${scriptName}`;
      default:
        return `${packageManager} run ${scriptName}`;
    }
  }

  // Default run command
  return `${packageManager} run ${scriptName}`;
}

/**
 * Generate a command to run multiple scripts in sequence based on the package manager
 *
 * @param packageManager - The package manager to use
 * @param scriptNames - The names of the scripts to run
 * @param options - Options for the command
 * @returns The command to run the scripts
 */
export function getSequentialRunCommands(
  packageManager: PackageManager,
  scriptNames: string[],
  options: RunCommandOptions = {},
): string {
  if (scriptNames.length === 0) {
    return "";
  }

  const commands = scriptNames.map((script) =>
    getRunCommand(packageManager, script, options),
  );
  return commands.join(" && ");
}

/**
 * Generate a command that runs recursively in all packages
 *
 * @param packageManager - The package manager to use
 * @param scriptName - The script to run in all packages
 * @returns The command to run the script recursively
 */
export function getRecursiveRunCommand(
  packageManager: PackageManager,
  scriptName: string,
): string {
  return getRunCommand(packageManager, scriptName, { recursive: true });
}
