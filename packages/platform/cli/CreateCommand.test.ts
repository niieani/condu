/// <reference types="bun-types" />
// import {
//   describe,
//   expect,
//   beforeEach,
//   afterEach,
//   it,
//   jest as vi,
// } from "bun:test";
// import type { Mock } from "bun:test";
import { describe, expect, beforeEach, afterEach, it, vi } from "vitest";
import type { Mock } from "vitest";
import { type Project } from "./loadProject.js";
import { loadRepoProject } from "./loadProject.js";
import { override, restore } from "swc-mockify/src/mockify.js";
import { createCommand, createPackage } from "./CreateCommand.js";
import {
  type WorkspaceProjectDefined,
  getProjectDefinitionsFromConventionConfig,
} from "./getProjectGlobsFromMoonConfig.js";
// import { createCommand } from "./CreateCommand.js";

describe("createCommand", () => {
  // let logMock: Mock<(text: string) => void>;
  // let errorMock: Mock<(text: string) => void>;
  let logMock: Mock<[string, void]>;
  let errorMock: Mock<[string, void]>;

  beforeEach(() => {
    // logMock = mock(() => {});
    // errorMock = mock(() => {});
    logMock = vi.fn();
    errorMock = vi.fn();
  });

  afterEach(() => {
    logMock.mockClear();
    errorMock.mockClear();
    restore(loadRepoProject);
  });

  it("should log an error if project cannot be loaded", async () => {
    const context = { log: logMock, error: errorMock };
    const partialPath = "./path/to/package";
    const mockLoadProject = vi.fn();

    override(loadRepoProject, mockLoadProject);

    await createCommand({ partialPath, context });

    // expect(errorMock).toHaveBeenCalled();
    expect(errorMock).toHaveBeenCalledWith("Unable to load project");
    expect(mockLoadProject).toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should log an error if no convention matches found", async () => {
    const partialPath = "package";
    const context = { log: logMock, error: errorMock };
    const project: Project = {
      projectConventions: [] satisfies WorkspaceProjectDefined[],
    } as any;

    override(loadRepoProject, async () => project);

    await createCommand({ partialPath, context });

    expect(errorMock).toHaveBeenCalledWith(
      "Full path for the new package could not be inferred from the workspace config and the provided partial path.",
    );
    expect(errorMock).toHaveBeenCalledWith(
      "If you're trying to provide the full path relative to the workspace, prefix it with './', e.g. ./" +
        partialPath,
    );
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should log an error if multiple convention matches found", async () => {
    const partialPath = "package";
    const context = { log: logMock, error: errorMock };
    const project: Project = {
      projectConventions: getProjectDefinitionsFromConventionConfig([
        { parentPath: "./one", nameConvention: "@one/*" },
        { parentPath: "./two", nameConvention: "@two/*" },
      ]),
    } as any;
    override(loadRepoProject, async () => project);

    await createCommand({ partialPath, context });

    expect(errorMock).toHaveBeenNthCalledWith(
      1,
      "Multiple possible paths for the new package were inferred from the workspace config:",
    );
    expect(errorMock).toHaveBeenNthCalledWith(
      2,
      "- ./one/package (as @one/package)\n- ./two/package (as @two/package)\n",
    );
    expect(errorMock).toHaveBeenNthCalledWith(
      3,
      "Please prefix your package name with its parent directory to disambiguate.",
    );
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should log the package name and path if a single convention match found", async () => {
    const partialPath = "group/amazing";
    const context = { log: logMock, error: errorMock };
    const project: Project = {
      projectConventions: getProjectDefinitionsFromConventionConfig([
        { parentPath: "./path/group", nameConvention: "package-*" },
      ]),
    } as any;

    override(loadRepoProject, async () => project);
    // skip actually creating anything:
    override(createPackage, async () => {
      // throw new Error("should not be called");
    });

    await createCommand({ partialPath, context });

    expect(errorMock).not.toHaveBeenCalled();
    expect(logMock).toHaveBeenCalledWith(
      "Will create package package-amazing at ./path/group/amazing",
    );
  });
});
