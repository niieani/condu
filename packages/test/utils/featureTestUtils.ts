import { configure } from "condu";
import type { ConduConfigInput } from "condu/api/configTypes.js";
import type { CollectedState } from "condu/commands/apply/CollectedState.js";
import {
  applyAndCommitCollectedState,
  collectState,
} from "condu/commands/apply/apply.js";

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConduProject } from "condu/loadProject.js";
import type { ConduProject } from "condu/commands/apply/ConduProject.js";
import {
  getDirectoryStructureAndContentsRecursively,
  type DirectoryItems,
} from "./getDirectoryStructureAndContentsRecursively.js";
import { prepareAndReleaseDirectoryPackages } from "condu/commands/release/release.js";

type FeatureTestOptions =
  | {
      /** Features and other configuration options */
      config: ConduConfigInput;
      /** Initial file system contents */
      initialFs?: DirectoryItems;
      /** Mock package.json contents */
      packageJson?: Record<string, unknown>;
    }
  | {
      /** Features and other configuration options */
      config: ConduConfigInput;
      /** Directory to use as the project root - if unset will create a temp dir and delete it afterwards */
      projectDir: string;
    };

// Helper to create the file system structure in a temp directory
async function setupMockFileSystem(
  baseDir: string,
  structure: DirectoryItems,
): Promise<void> {
  const fileOperations: Array<{ filePath: string; content: string }> = [];
  const dirCreatePaths: Array<string> = []; // Will collect all directory paths that need to exist

  function discoverPathsAndCollectOperations(
    currentBasePathForItems: string, // The path where keys of 'items' should be resolved against
    items: DirectoryItems,
  ) {
    for (const [name, content] of Object.entries(items)) {
      const pathSegmentsFromKey = name.split("/");
      const fileNameOrFinalDirSegment = pathSegmentsFromKey.pop()!;

      let pathForCurrentKeyResolution = currentBasePathForItems;
      // Create intermediate directories from the key itself if pathSegmentsFromKey has any
      for (const segment of pathSegmentsFromKey) {
        pathForCurrentKeyResolution = path.join(
          pathForCurrentKeyResolution,
          segment,
        );
        dirCreatePaths.push(pathForCurrentKeyResolution);
      }

      const finalItemPath = path.join(
        pathForCurrentKeyResolution,
        fileNameOrFinalDirSegment,
      );

      if (typeof content === "string") {
        fileOperations.push({ filePath: finalItemPath, content });
      } else if (typeof content === "object" && content !== null) {
        dirCreatePaths.push(finalItemPath); // This is a directory defined by the key
        // Recurse into it, using finalItemPath as the base for items within this directory
        discoverPathsAndCollectOperations(
          finalItemPath,
          content as DirectoryItems,
        );
      }
    }
  }
  discoverPathsAndCollectOperations(baseDir, structure);

  // 3. Create all discovered directories in parallel.
  //    Using a Set to avoid redundant mkdir calls for the same path, though fs.mkdir recursive is idempotent.
  const uniqueDirPaths = [...new Set(dirCreatePaths)];
  if (uniqueDirPaths.length > 0) {
    await Promise.all(
      uniqueDirPaths.map((dirPath) => fs.mkdir(dirPath, { recursive: true })),
    );
  } else {
    // Ensure the base directory itself exists before discovering paths within it
    // This initial mkdir is important if baseDir itself is part of the structure to be created.
    await fs.mkdir(baseDir, { recursive: true });
  }

  // After all directories are ensured to exist, execute all file write operations in parallel.
  if (fileOperations.length > 0) {
    await Promise.all(
      fileOperations.map(({ filePath, content }) =>
        fs.writeFile(filePath, content),
      ),
    );
  }
}

export async function testApplyFeatures({
  config,
  ...options
}: FeatureTestOptions): Promise<{
  getFileContents: (filePath: string) => Promise<string>;
  collectedState: CollectedState;
  testRelease: () => Promise<void>;
  getMockState: () => Promise<Record<string, string | Buffer | DirectoryItems>>;
  project: ConduProject;
  projectDir: string;
  [Symbol.dispose]: () => Promise<void>;
}> {
  const targetProjectDir =
    "projectDir" in options
      ? options.projectDir
      : await fs.mkdtemp(path.join(os.tmpdir(), "condu-test-"));

  const cleanup = async () => {
    if ("projectDir" in options) {
      // If a projectDir is provided, we don't want to delete it
      return;
    }
    // Cleanup the temp directory if it was created
    try {
      await fs.rm(targetProjectDir, { recursive: true, force: true });
    } catch (error) {
      console.error(
        `Failed to clean up temp directory: ${targetProjectDir}`,
        error,
      );
    }
  };

  try {
    if (!("projectDir" in options)) {
      const { initialFs, packageJson } = options;
      const defaultPackageJson = {
        name: "mock-project",
        version: "1.0.0",
        ...packageJson,
      };

      const mockProjectFs: DirectoryItems = {
        ".git": { refs: { remotes: { origin: { HEAD: "refs/heads/main" } } } },
        "package.json": JSON.stringify(defaultPackageJson, undefined, 2),
        ...initialFs, // Spread user-provided initial file system items
      };

      await setupMockFileSystem(targetProjectDir, mockProjectFs);
    }

    const project = await loadConduProject({
      workspaceDir: targetProjectDir,
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
    // project =
    //   (await loadConduProject({
    //     workspaceDir: tempDir,
    //     getConfig: configure(config),
    //   })) ?? project;

    return {
      project,
      collectedState,
      projectDir: targetProjectDir,
      testRelease: async () => {
        await prepareAndReleaseDirectoryPackages({
          workspaceDirAbs: project.absPath,
          packagesToPrepare:
            project.workspacePackages.length > 0
              ? project.workspacePackages
              : project.allPackages,
          absBuildDir: path.join(
            project.absPath,
            project.config.conventions.buildDir,
          ),
          srcDirName: project.config.conventions.sourceDir,
          buildDirName: project.config.conventions.buildDir,
          project,
          collectedState,
          dryRun: true,
        });
      },
      getFileContents: async (filePath: string): Promise<string> => {
        try {
          const fullPath = path.join(targetProjectDir, filePath);
          if ((await fs.stat(fullPath)).isFile()) {
            return await fs.readFile(fullPath, "utf8");
          }
          throw new Error(`File not found: ${filePath}`);
        } catch (error) {
          const err = error as Error;
          throw new Error(`Failed to read file at ${filePath}: ${err.message}`);
        }
      },
      getMockState: async () => {
        return await getDirectoryStructureAndContentsRecursively(
          targetProjectDir,
          {},
          [".git", ".cache"], // Exclude .git and .cache from the output
        );
      },
      [Symbol.dispose]: async () => {
        await cleanup();
      },
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
