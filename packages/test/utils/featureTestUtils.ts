/* eslint-disable import-x/no-named-as-default-member */
import { configure } from "condu";
import type { ConduConfigInput } from "condu/api/configTypes.js";
import type { CollectedState } from "condu/commands/apply/CollectedState.js";
import {
  applyAndCommitCollectedState,
  collectState,
} from "condu/commands/apply/apply.js";

import mockFs from "mock-fs";
import type FileSystem from "mock-fs/lib/filesystem.js";
import fs from "node:fs";
import { loadConduProject } from "condu/loadProject.js";
import type { ConduProject } from "condu/commands/apply/ConduProject.js";
import {
  getDirectoryStructureAndContentsRecursively,
  type DirectoryItems,
} from "./getDirectoryStructureAndContentsRecursively.js";

interface FeatureTestOptions {
  /** Features and other configuration options */
  config: ConduConfigInput;
  /** Initial file system contents */
  initialFs?: FileSystem.DirectoryItems;
  /** Mock package.json contents */
  packageJson?: Record<string, unknown>;
}

export async function testApplyFeatures({
  config,
  initialFs = {},
  packageJson = {},
}: FeatureTestOptions): Promise<{
  getFileContents: (path: string) => Promise<string>;
  collectedState: CollectedState;
  getMockState: () => Promise<Record<string, string | Buffer | DirectoryItems>>;
  [Symbol.dispose]: () => void;
  bypassMockFs: (typeof mockFs)["bypass"];
  project: ConduProject;
}> {
  const defaultPackageJson = {
    name: "mock-project",
    version: "1.0.0",
    ...packageJson,
  };

  const mockProjectFs = {
    ".git": { refs: { remotes: { origin: { HEAD: "refs/heads/main" } } } },
    "package.json": JSON.stringify(defaultPackageJson, undefined, 2),
    ...initialFs,
  } as const;

  // Set up mock file system with .config directory
  mockFs({
    "/mock-project": mockProjectFs,
  });

  let project = await loadConduProject({
    workspaceDir: "/mock-project",
    getConfig: configure(config),
  });

  if (!project) {
    throw new Error("Failed to load project");
  }

  // Collect state from features
  const collected = await collectState({ project });

  await applyAndCommitCollectedState(collected);
  const { collectedState } = collected;

  // reload the project so it can be used to make assertions
  project =
    (await loadConduProject({
      workspaceDir: "/mock-project",
      getConfig: configure(config),
    })) ?? project;

  return {
    project,
    collectedState,
    getFileContents: async (path: string): Promise<string> => {
      try {
        // Try to get the file directly from the fileManager first
        // const fileEntry =
        //   collectedState.fileManager.files.get(path) ||
        //   collectedState.fileManager.files.get(`/${path}`);

        // if (
        //   fileEntry?.lastApply &&
        //   typeof fileEntry.lastApply.content === "string"
        // ) {
        //   return fileEntry.lastApply.content;
        // }

        // Fallback to reading from the mock filesystem
        const filePath = `/mock-project/${path}`;
        if ((await fs.promises.stat(filePath)).isFile()) {
          return await fs.promises.readFile(filePath, "utf8");
        }

        throw new Error(`File not found: ${path}`);
      } catch (error) {
        const err = error as Error;
        throw new Error(`Failed to read file at ${path}: ${err.message}`);
      }
    },
    getMockState: async () => {
      try {
        return await getDirectoryStructureAndContentsRecursively(
          "/mock-project",
          {},
          [".git", ".cache"],
        );
      } catch (error) {
        const err = error as Error;
        err.message = `Failed to get mock filesystem state: ${err.message}`;
        throw err;
      }
    },
    bypassMockFs: mockFs.bypass,
    [Symbol.dispose]: () => {
      mockFs.restore();
    },
  };
}
