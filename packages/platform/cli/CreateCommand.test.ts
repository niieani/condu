/// <reference types="bun-types" />
// import { describe, expect, beforeEach, afterEach, it, mock } from "bun:test";
// import type { Mock } from "bun:test";
import { describe, expect, beforeEach, afterEach, it, vi } from "vitest";
import type { Mock } from "vitest";
import { register } from "../di/di.js";
import type { Project } from "./loadProject.js";
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
  });

  it.only("should log an error if project cannot be loaded", async () => {
    const partialPath = "./path/to/package";
    const context = { log: logMock, error: errorMock };
    const mockLoadProject = vi.fn();

    register({ loadProject: mockLoadProject });
    const { createCommand } = await import("./CreateCommand.js");

    await createCommand({ partialPath, context });

    expect(mockLoadProject).toHaveBeenCalled();
    // expect(errorMock).toHaveBeenCalled();
    // expect(errorMock.mock.lastCall).toMatch("Unable to load project");
    expect(errorMock).toHaveBeenCalledWith("Unable to load project");
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should log an error if no convention matches found", async () => {
    const partialPath = "./path/to/package";
    const context = { log: logMock, error: errorMock };
    const project: Project = { projectConventions: [] };

    register({ loadProject: async () => project });

    await createCommand({ partialPath, context });

    expect(errorMock).toHaveBeenCalledWith(
      "Full path for the new package could not be inferred from the workspace config and the provided partial path.",
    );
    expect(errorMock).toHaveBeenCalledWith(
      "If you want to provide the full path relative to the workspace, prefix it with './', e.g. ./" +
        partialPath,
    );
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should log an error if multiple convention matches found", async () => {
    const partialPath = "./path/to/package";
    const context = { log: logMock, error: errorMock };
    const project = {
      projectConventions: [
        { path: "./path", name: "package" },
        { path: "./path/to", name: "package" },
      ],
    };
    register({ loadProject: async () => project });

    await createCommand({ partialPath, context });

    expect(errorMock).toHaveBeenCalledWith(
      "Multiple possible paths for the new package were inferred from the workspace config:",
    );
    expect(errorMock).toHaveBeenCalledWith(
      "- ./path (as package)\n- ./path/to (as package)\n",
    );
    expect(errorMock).toHaveBeenCalledWith(
      "Please prefix your package name with its parent directory to disambiguate.",
    );
    expect(logMock).not.toHaveBeenCalled();
  });

  it("should log the package name and path if a single convention match found", async () => {
    const partialPath = "./path/to/package";
    const context = { log: logMock, error: errorMock };
    const project = {
      projectConventions: [{ path: "./path/to", name: "package" }],
    };
    register({ loadProject: async () => project });

    await createCommand({ partialPath, context });

    expect(logMock).toHaveBeenCalledWith(
      "Will create package package at ./path/to",
    );
    expect(errorMock).not.toHaveBeenCalled();
  });
});
