import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vitest";
import { FileManager } from "./FileManager.js";
import { ConduPackageEntry } from "./ConduPackageEntry.js";
import { ConduReadonlyCollectedStateView } from "./CollectedState.js";
import { ConduReporter } from "../../reporter/ConduReporter.js";

const directories: string[] = [];
afterEach(async () => {
  process.exitCode = 0;
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});
async function fixture() {
  ConduReporter.initialize({ mode: "quiet" });
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "condu-lifecycle-"));
  directories.push(dir);
  const root = new ConduPackageEntry({
    kind: "workspace",
    name: "test",
    scopedName: "test",
    scope: undefined,
    manifest: { name: "test" },
    manifestRelPath: "package.json",
    manifestAbsPath: path.join(dir, "package.json"),
    relPath: ".",
    absPath: dir,
    writeProjectManifest: async () => {},
  });
  const run = async (
    content?: string | { symlinkTarget: string },
    configure?: (manager: FileManager) => void,
  ) => {
    const manager = new FileManager(root, []);
    await manager.readCache();
    if (content !== undefined)
      manager
        .manageFile({ relPath: "output", targetPackage: root })
        .defineInitialContent(
          typeof content === "string" ? { content } : content,
          { featureName: "test" },
        );
    configure?.(manager);
    const view = new ConduReadonlyCollectedStateView({
      fileManager: manager,
      tasks: [],
      dependencies: [],
      resolutions: {},
      packageJsonModifications: [],
      releasePackageJsonModifications: [],
      get peerContext(): never {
        throw new Error("This fixture has no peer context");
      },
      stage: "fresh",
    });
    await manager.applyAllFiles(view);
    return manager;
  };
  return { dir, output: path.join(dir, "output"), run };
}
test("ownership survives a no-op apply and permits later update and removal", async () => {
  const { output, run } = await fixture();
  await run("one");
  await run("one");
  await run("two");
  expect(await fs.readFile(output, "utf8")).toBe("two");
  await run();
  await expect(fs.lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
});
test("removed edited files retain their baseline through skipped deletion", async () => {
  const { output, run } = await fixture();
  await run("original");
  await fs.writeFile(output, "local");
  await run();
  expect(await fs.readFile(output, "utf8")).toBe("local");
  await fs.writeFile(output, "original");
  await run();
  await expect(fs.lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
});
test("conflicting writes preserve ownership without adopting local edits", async () => {
  const { output, run } = await fixture();
  await run("one");
  await fs.writeFile(output, "local");
  await run("two");
  await run("three");
  expect(await fs.readFile(output, "utf8")).toBe("local");
  await fs.writeFile(output, "one");
  await run("three");
  expect(await fs.readFile(output, "utf8")).toBe("three");
});
test("symlink transitions protect local links and never write their target", async () => {
  const { dir, output, run } = await fixture();
  await fs.writeFile(path.join(dir, "target"), "untouched");
  await run({ symlinkTarget: "target" });
  await run({ symlinkTarget: "target" });
  await run("regular");
  expect((await fs.lstat(output)).isFile()).toBe(true);
  expect(await fs.readFile(path.join(dir, "target"), "utf8")).toBe("untouched");
  await run({ symlinkTarget: "target" });
  await fs.unlink(output);
  await fs.symlink("local-target", output);
  await run("replacement");
  expect(await fs.readlink(output)).toBe("local-target");
});
test("empty content and whitespace are exact managed contents", async () => {
  const { output, run } = await fixture();
  await run("");
  expect(await fs.readFile(output, "utf8")).toBe("");
  await run(" ");
  expect(await fs.readFile(output, "utf8")).toBe(" ");
});

test("a symlink declaration cannot replace an unmanaged regular file", async () => {
  const { output, run } = await fixture();
  await fs.writeFile(output, "symlink:target");
  await run({ symlinkTarget: "target" });
  expect((await fs.lstat(output)).isFile()).toBe(true);
  expect(await fs.readFile(output, "utf8")).toBe("symlink:target");
});

test("failed filesystem inspection propagates and retains the ownership cache", async () => {
  const { dir, output, run } = await fixture();
  await run("generated");
  await fs.unlink(output);
  await fs.mkdir(output);
  await expect(run()).rejects.toThrow("Failed to apply managed files");
  await fs.rmdir(output);
  await fs.writeFile(output, "generated");
  await run();
  await expect(fs.lstat(output)).rejects.toMatchObject({ code: "ENOENT" });
  expect((await fs.stat(dir)).isDirectory()).toBe(true);
});

test("successful siblings persist ownership when another generator fails", async () => {
  const { output, run } = await fixture();
  await run("one");
  await expect(
    run("two", (manager) => {
      manager
        .manageFile({ relPath: "failure", targetPackage: manager.rootPackage })
        .defineInitialContent(
          {
            content() {
              throw new Error("generator failed");
            },
          },
          { featureName: "failure" },
        );
    }),
  ).rejects.toThrow("Failed to apply managed files");
  await run("three");
  expect(await fs.readFile(output, "utf8")).toBe("three");
});

test("empty existing text is present for editable transformations", async () => {
  const { output, run } = await fixture();
  await fs.writeFile(output, "");
  await run(undefined, (manager) => {
    manager
      .manageFile({ relPath: "output", targetPackage: manager.rootPackage })
      .addUserEditableModification(
        {
          ifNotExists: "error",
          parse: (text) => text,
          stringify: (text) => text,
          content: ({ content }) => `${content}edited`,
        },
        { featureName: "editor" },
      );
  });
  expect(await fs.readFile(output, "utf8")).toBe("edited");
});

test("throwing manual conflict policy still caches successful siblings", async () => {
  const { dir, output, run } = await fixture();
  await run("one");
  await fs.writeFile(path.join(dir, "conflict"), "local");
  await expect(
    run("two", (manager) => {
      manager.throwOnManualChanges = true;
      manager
        .manageFile({ relPath: "conflict", targetPackage: manager.rootPackage })
        .defineInitialContent(
          { content: "generated" },
          { featureName: "test" },
        );
    }),
  ).rejects.toThrow("Failed to apply managed files");
  await run("three");
  expect(await fs.readFile(output, "utf8")).toBe("three");
});

test("empty generated text is present for editable transformations", async () => {
  const { output, run } = await fixture();
  await run("", (manager) => {
    manager
      .manageFile({ relPath: "output", targetPackage: manager.rootPackage })
      .addUserEditableModification(
        {
          ifNotExists: "error",
          parse: (text) => text,
          stringify: (text) => text,
          content: ({ content }) => `${content}edited`,
        },
        { featureName: "editor" },
      );
  });
  expect(await fs.readFile(output, "utf8")).toBe("edited");
});
