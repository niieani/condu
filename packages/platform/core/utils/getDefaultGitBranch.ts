import { promises as fs } from "node:fs";
import * as path from "node:path";

import memoize from "async-memoize-one";

export const getDefaultGitBranch_ = async (
  rootDir: string,
): Promise<string> => {
  try {
    const remotes = await fs.readdir(
      path.join(rootDir, ".git", "refs", "remotes"),
    );
    const [remote] = remotes;
    if (!remote) {
      throw new Error("No git remotes found");
    }
    const result = await fs.readFile(
      path.join(rootDir, ".git", "refs", "remotes", remote, "HEAD"),
      "utf-8",
    );
    const defaultBranch = result.split(`/${remote}/`).pop()?.trim();
    if (!defaultBranch) {
      throw new Error("No default branch found");
    }
    return defaultBranch;
  } catch (e) {
    console.warn(
      `Unable to determine the default git branch: ${e}. Falling back to "main".`,
    );
    return "main";
  }
};

export const getDefaultGitBranch = memoize(getDefaultGitBranch_);
