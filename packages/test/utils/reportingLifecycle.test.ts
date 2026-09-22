import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, expect, test, vi } from "vitest";
import { configure, defineFeature } from "condu";
import { loadConduProject } from "condu/loadProject.js";
import {
  apply,
  collectState,
  applyAndCommitCollectedState,
} from "condu/commands/apply/apply.js";
import { ConduReporter } from "condu/reporter/ConduReporter.js";

const directories: string[] = [];
afterEach(async () => {
  process.exitCode = 0;
  vi.restoreAllMocks();
  vi.useRealTimers();
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});
function capture() {
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  return { output, text: () => text };
}
async function fixture(name: string) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "condu-reporting-"),
  );
  directories.push(directory);
  await fs.mkdir(path.join(directory, ".git"));
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({ name, version: "1.0.0", private: true }),
  );
  const captured = capture();
  const run = async (content?: string) => {
    using reporter = new ConduReporter({
      output: captured.output,
      mode: "local",
      supportsColor: false,
    });
    const feature = defineFeature(`${name}-feature`, {
      defineRecipe(condu) {
        if (content !== undefined)
          condu.root.generateFile(`${name}.txt`, { content });
      },
    });
    const project = await loadConduProject({
      workspaceDir: directory,
      getConfig: configure({
        git: { defaultBranch: "main" },
        features: [feature],
      }),
    });
    if (!project) throw new Error("Expected test project to load");
    const collected = await collectState({ project, reporter });
    await applyAndCommitCollectedState(collected);
    return collected.collectedState.fileManager;
  };
  return { directory, run, captured };
}

test("concurrent projects keep feature and file output in their own run", async () => {
  const [first, second] = await Promise.all([
    fixture("first-project"),
    fixture("second-project"),
  ]);
  await Promise.all([
    first.run("first contents"),
    second.run("second contents"),
  ]);
  expect(first.captured.text()).toContain("first-project-feature");
  expect(first.captured.text()).toContain("first-project.txt");
  expect(first.captured.text()).not.toContain("second-project");
  expect(second.captured.text()).toContain("second-project-feature");
  expect(second.captured.text()).toContain("second-project.txt");
  expect(second.captured.text()).not.toContain("first-project");
});

test("file conflict diffs use the injected output and count as review, not deletion", async () => {
  const fixtureData = await fixture("conflict-project");
  await fixtureData.run("original-generated-content");
  const outputPath = path.join(fixtureData.directory, "conflict-project.txt");
  await fs.writeFile(outputPath, "unique-local-conflicting-content");
  const stdout = vi.spyOn(process.stdout, "write");
  const manager = await fixtureData.run();
  expect(fixtureData.captured.text()).toContain(
    "unique-local-conflicting-content",
  );
  expect(
    stdout.mock.calls.map(([data]) => String(data)).join(""),
  ).not.toContain("unique-local-conflicting-content");
  expect(manager.getSummary()).toMatchObject({
    filesDeleted: 0,
    filesNeedingReview: 1,
    filesSkipped: 1,
  });
  expect(await fs.readFile(outputPath, "utf8")).toBe(
    "unique-local-conflicting-content",
  );
  await fs.writeFile(outputPath, "original-generated-content");
  const completed = await fixtureData.run();
  expect(completed.getSummary()).toMatchObject({
    filesDeleted: 1,
    filesNeedingReview: 0,
  });
  await expect(fs.lstat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
});

test("summary distinguishes creation, update, no-op and actual deletion", async () => {
  const project = await fixture("summary-project");
  const created = await project.run("one");
  expect(created.getSummary()).toMatchObject({
    filesCreated: 1,
    filesUpdated: 0,
    filesDeleted: 0,
  });
  const unchanged = await project.run("one");
  expect(unchanged.getSummary()).toMatchObject({
    filesCreated: 0,
    filesUpdated: 0,
    filesDeleted: 0,
  });
  const updated = await project.run("two");
  expect(updated.getSummary()).toMatchObject({
    filesCreated: 0,
    filesUpdated: 1,
    filesDeleted: 0,
  });
  const removed = await project.run();
  expect(removed.getSummary()).toMatchObject({
    filesCreated: 0,
    filesUpdated: 0,
    filesDeleted: 1,
  });
});

test("generator failures preserve the original cause in their run output", async () => {
  const { directory, captured } = await fixture("failing-generator");
  using reporter = new ConduReporter({
    output: captured.output,
    mode: "local",
    supportsColor: false,
  });
  const project = await loadConduProject({
    workspaceDir: directory,
    getConfig: configure({
      git: { defaultBranch: "main" },
      features: [
        defineFeature("failing-recipe", {
          defineRecipe(condu) {
            condu.root.generateFile("failure.txt", {
              content() {
                throw new Error("unique-generator-failure");
              },
            });
          },
        }),
      ],
    }),
  });
  if (!project) throw new Error("Expected test project to load");
  const collected = await collectState({ project, reporter });
  const failed = applyAndCommitCollectedState(collected).catch(
    (error: unknown) => {
      if (!(error instanceof Error)) throw error;
      reporter.error("Apply failed", error);
      throw error;
    },
  );
  await expect(failed).rejects.toThrow("Failed to apply managed files");
  expect(captured.text()).toContain("unique-generator-failure");
});

test("top-level apply disposes its active spinner after config failure", async () => {
  const { directory, captured } = await fixture("failing-config");
  await fs.mkdir(path.join(directory, ".config"));
  await fs.writeFile(
    path.join(directory, ".config", "condu.ts"),
    'export default () => { throw new Error("unique-config-failure"); };',
  );
  vi.useFakeTimers();
  const reporter = new ConduReporter({
    output: captured.output,
    mode: "quiet",
    supportsColor: false,
    isInteractiveTTY: true,
  });
  await expect(apply({ startDir: directory, reporter })).rejects.toThrow(
    "unique-config-failure",
  );
  expect(captured.text()).toContain("unique-config-failure");
  const atFailure = captured.text();
  vi.advanceTimersByTime(500);
  expect(captured.text()).toBe(atFailure);
  expect(vi.getTimerCount()).toBe(0);
});
