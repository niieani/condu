import { promises as fs } from "node:fs";
import * as path from "node:path";

import memoize from "async-memoize-one";
import { findUp } from "./findUp.js";

export const getDefaultGitBranch_ = async (
  rootDir: string,
): Promise<string> => {
  const { GIT_DEFAULT_BRANCH } = process.env;
  if (GIT_DEFAULT_BRANCH) {
    return GIT_DEFAULT_BRANCH;
  }
  try {
    const gitDir = await findUp(".git", { cwd: rootDir, type: "directory" });
    if (!gitDir) {
      throw new Error("No git directory found");
    }
    const remotes = await fs.readdir(path.join(gitDir, "refs", "remotes"));
    const remote = remotes.find((remote) => remote === "origin") || remotes[0];
    if (!remote) {
      throw new Error("No git remotes found");
    }
    const result = await fs.readFile(
      path.join(gitDir, "refs", "remotes", remote, "HEAD"),
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
