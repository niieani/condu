import * as os from "node:os";
import * as path from "node:path";

// https://github.com/pnpm/pnpm/blob/96e165c7ff89ba47f0ff03c7eca459f58ce3ff2a/config/config/src/dirs.ts
export function getCacheDir(opts: {
  env: NodeJS.ProcessEnv;
  platform: string;
}) {
  if (opts.env["XDG_CACHE_HOME"]) {
    return path.join(opts.env["XDG_CACHE_HOME"], "pnpm");
  }
  if (opts.platform === "darwin") {
    return path.join(os.homedir(), "Library/Caches/pnpm");
  }
  if (opts.platform !== "win32") {
    return path.join(os.homedir(), ".cache/pnpm");
  }
  if (opts.env["LOCALAPPDATA"]) {
    return path.join(opts.env["LOCALAPPDATA"], "pnpm-cache");
  }
  return path.join(os.homedir(), ".pnpm-cache");
}
