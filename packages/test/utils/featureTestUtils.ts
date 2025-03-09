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
import path from "node:path";
import type { ConduProject } from "condu/commands/apply/ConduProject.js";

interface DirectoryItems {
  [name: string]: string | DirectoryItems;
}

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
        // Get a snapshot of the full mock filesystem
        const walkDir = async (
          dirPath: string,
          directoryItems: DirectoryItems = {},
          ignore: string[] = [],
        ): Promise<DirectoryItems> => {
          const result = directoryItems;
          const files = await fs.promises.readdir(dirPath, {
            withFileTypes: true,
          });

          for (const file of files) {
            if (ignore.includes(file.name)) {
              continue;
            }
            const fullPath = path.join(dirPath, file.name);

            if (file.isDirectory()) {
              result[file.name] ??= await walkDir(fullPath, {}, ignore);
            } else if (file.isFile()) {
              try {
                result[file.name] = await fs.promises.readFile(
                  fullPath,
                  "utf-8",
                );
              } catch (e) {
                result[file.name] = String(e);
              }
            } else if (file.isSymbolicLink()) {
              result[file.name] =
                `symlink to: ${await fs.promises.readlink(fullPath)}`;
            } else {
              result[file.name] = `unknown file type`;
            }
          }

          return result;
        };

        return await walkDir("/mock-project", {}, [".git", ".cache"]);
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
