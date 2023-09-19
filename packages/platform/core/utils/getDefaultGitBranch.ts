import { promises as fs } from "node:fs";
import path from "node:path";

import memoize from "async-memoize-one";

export const getDefaultGitBranch_ = async (rootDir: string) => {
  try {
    const remotes = await fs.readdir(
      path.join(rootDir, ".git", "refs", "remotes"),
    );
    if (remotes.length === 0) {
      throw new Error("No git remotes found");
    }
    const [remote] = remotes;
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
      `Unable to determine the default git branch. ${e}. Using "main" as the default.`,
    );
    return "main";
  }
};

export const getDefaultGitBranch = memoize(getDefaultGitBranch_);
