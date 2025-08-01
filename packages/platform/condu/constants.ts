import type { Task } from "./commands/apply/CollectedState.js";

export const CORE_NAME = "condu";
export const CONDU_CONFIG_FILE_NAME = `${CORE_NAME}.ts`;
export const CONDU_CONFIG_DIR_NAME = `.config`;
export const CONDU_WORKSPACE_PACKAGE_NAME = "condu-workspace";
export const DEFAULT_PACKAGE_MANAGER = "pnpm";
export const DEFAULT_NODE_VERSION = "stable";
export const DEFAULT_SOURCE_EXTENSIONS = [
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
];
export const DEFAULT_GENERATED_SOURCE_FILE_NAME_SUFFIXES = [
  ".generated",
  ".gen",
];
export const IS_INTERACTIVE =
  process.stdout.isTTY &&
  process.stdin.isTTY &&
  process.env["npm_lifecycle_event"] !== "postinstall";
export const FILE_STATE_PATH = `${CONDU_CONFIG_DIR_NAME}/.cache/files.json`;
export const CURRENT_CACHE_VERSION = 1;
export const BUILTIN_TASK_NAMES = new Set<string>([
  "build",
  "test",
  "format",
  "publish",
  "start",
] satisfies Task["type"][]);
export const ANONYMOUS_RECIPE_PREFIX = "recipe-";
