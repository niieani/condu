import { expect, test, vi } from "vitest";
import type { WriteManifestFn } from "@condu/workspace-utils/packageJsonTypes.js";
import { ConduPackageEntry } from "./ConduPackageEntry.js";
import { ConduReadonlyCollectedStateView } from "./CollectedState.js";

function createEntry(writeProjectManifest: WriteManifestFn) {
  return new ConduPackageEntry({
    name: "fixture",
    kind: "workspace",
    scopedName: "fixture",
    manifestRelPath: "package.json",
    manifestAbsPath: "/fixture/package.json",
    relPath: ".",
    absPath: "/fixture",
    manifest: { name: "fixture", devDependencies: { tool: "1.0.0" } },
    writeProjectManifest,
  });
}

test("manifest write failure preserves committed state and supports retry", async () => {
  const write = vi.fn<WriteManifestFn>();
  write.mockRejectedValueOnce(new Error("disk full"));
  write.mockResolvedValue(undefined);
  const entry = createEntry(write);
  entry.addInternalModification((manifest) => {
    manifest.devDependencies = { tool: "2.0.0" };
    return manifest;
  });
  await expect(entry.applyAndCommit()).rejects.toThrow("disk full");
  expect(entry.manifest.devDependencies).toEqual({ tool: "1.0.0" });
  await expect(entry.applyAndCommit()).resolves.toBe(true);
  expect(entry.manifest.devDependencies).toEqual({ tool: "2.0.0" });
});

test("unchanged manifests do not invoke persistence", async () => {
  const write = vi.fn<WriteManifestFn>().mockResolvedValue(undefined);
  const entry = createEntry(write);
  entry.addInternalModification((manifest) => structuredClone(manifest));
  await expect(entry.applyAndCommit()).resolves.toBe(false);
  expect(write).not.toHaveBeenCalled();
});

test("modifier failure cannot expose partial changes", async () => {
  const write = vi.fn<WriteManifestFn>().mockResolvedValue(undefined);
  const entry = createEntry(write);
  entry.addInternalModification((manifest) => {
    manifest.devDependencies = {};
    throw new Error("resolution failed");
  });
  await expect(entry.applyAndCommit()).rejects.toThrow("resolution failed");
  expect(entry.manifest.devDependencies).toEqual({ tool: "1.0.0" });
  expect(write).not.toHaveBeenCalled();
});

test("pending feature modifiers survive a failed write and commit exactly once", async () => {
  const write = vi.fn<WriteManifestFn>();
  write.mockRejectedValueOnce(new Error("disk full"));
  write.mockResolvedValue(undefined);
  const entry = createEntry(write);
  const view = new ConduReadonlyCollectedStateView({
    get fileManager(): never {
      throw new Error("No files in this fixture");
    },
    get peerContext(): never {
      throw new Error("No peer context in this fixture");
    },
    dependencies: [],
    tasks: [],
    resolutions: {},
    packageJsonModifications: [],
    releasePackageJsonModifications: [],
    stage: "fresh",
  });
  entry.addModification(
    (manifest) => {
      manifest.description = `${manifest.description ?? ""}applied`;
      return manifest;
    },
    { featureName: "fixture" },
    view,
  );
  await expect(entry.applyAndCommit()).rejects.toThrow("disk full");
  expect(entry.manifest.description).toBeUndefined();
  await expect(entry.applyAndCommit()).resolves.toBe(true);
  expect(entry.manifest.description).toBe("applied");
  await expect(entry.applyAndCommit()).resolves.toBe(false);
  expect(write).toHaveBeenCalledTimes(2);
});
