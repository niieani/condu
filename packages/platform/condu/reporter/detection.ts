import type { ReporterMode, ReporterTheme } from "./types.js";

export interface EnvironmentInfo {
  isCI: boolean;
  isTTY: boolean;
  supportsColor: boolean;
  terminalWidth: number;
  isQuiet: boolean;
  preferredTheme: ReporterTheme | undefined;
}

export function detectEnvironment(): EnvironmentInfo {
  return {
    isCI: Boolean(
      process.env["CI"] ||
        process.env["CONTINUOUS_INTEGRATION"] ||
        process.env["GITHUB_ACTIONS"] ||
        process.env["GITLAB_CI"] ||
        process.env["CIRCLECI"] ||
        process.env["TRAVIS"] ||
        process.env["JENKINS_URL"],
    ),
    isTTY: process.stdout.isTTY ?? false,
    supportsColor: detectColorSupport(),
    terminalWidth: process.stdout.columns ?? 80,
    isQuiet: process.env["CONDU_QUIET"] === "true",
    preferredTheme: process.env["CONDU_THEME"] as ReporterTheme | undefined,
  };
}

export function detectColorSupport(): boolean {
  // NO_COLOR env var disables colors
  if ("NO_COLOR" in process.env) return false;

  // FORCE_COLOR forces colors
  if ("FORCE_COLOR" in process.env) return true;

  // Check TTY and color level
  if (!process.stdout.isTTY) return false;

  // Windows 10+ supports colors
  if (process.platform === "win32") return true;

  // Check TERM variable
  const term = process.env["TERM"] ?? "";
  if (term === "dumb") return false;
  if (term.includes("color") || term.includes("256")) return true;

  return true;
}

export function detectMode(): ReporterMode {
  if (process.env["CONDU_QUIET"] === "true") return "quiet";
  if (process.env["CI"] === "true") return "ci";
  if (!process.stdout.isTTY) return "ci";
  return "local";
}
