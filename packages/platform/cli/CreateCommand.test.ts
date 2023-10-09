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
import {
  describe,
  expect,
  beforeEach,
  afterEach,
  it,
  vi,
  type Mock,
} from "vitest";
import { loadRepoProject, type Project } from "./loadProject.js";
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

    await expect(
      createCommand({ partialPath, context }),
    ).rejects.toThrowErrorMatchingInlineSnapshot('"Unable to load project"');

    expect(mockLoadProject).toHaveBeenCalled();
  });

  it("should log an error if no convention matches found", async () => {
    const partialPath = "package";
    const context = { log: logMock, error: errorMock };
    const project: Project = {
      projectConventions: [] satisfies WorkspaceProjectDefined[],
    } as any;

    override(loadRepoProject, async () => project);

    await expect(createCommand({ partialPath, context })).rejects
      .toThrowErrorMatchingInlineSnapshot(`
        "Full path for the new package could not be inferred from the workspace config and the provided partial path.
        If you're trying to provide the full path relative to the workspace, prefix it with './', e.g. ./package"
      `);
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

    await expect(
      createCommand({ partialPath, context }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(`
        "Multiple possible paths for the package were inferred from the workspace config:
        - ./one/package (as @one/package)
        - ./two/package (as @two/package)

        Please prefix your package name with its parent directory to disambiguate."
      `);
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
