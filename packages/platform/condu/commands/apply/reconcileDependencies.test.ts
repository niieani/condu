import { expect, test, vi } from "vitest";
import type { ConduPackageJson } from "@condu/workspace-utils/packageJsonTypes.js";
import { reconcileDependencies } from "./reconcileDependencies.js";

const owned = (): ConduPackageJson => ({
  name: "fixture",
  devDependencies: { tool: "~1.2.3", manual: "^2.0.0" },
  condu: { managedDependencies: { tool: "presence" } },
});

test("removes the final owned dependency and retains unmanaged dependencies", async () => {
  const manifest = owned();
  const result = await reconcileDependencies({ manifest, dependencies: [] });
  expect(result.manifest.devDependencies).toEqual({ manual: "^2.0.0" });
  expect(result.manifest.condu?.managedDependencies).toEqual({});
  expect(result.stats).toEqual({ changed: 0, removed: 1 });
  expect(manifest).toEqual(owned());
});

test("moves an owned dependency to a new list preserving its presence range", async () => {
  const result = await reconcileDependencies({
    manifest: owned(),
    dependencies: [{ name: "tool", list: "dependencies" }],
    resolve: vi.fn(() => {
      throw new Error("must preserve range");
    }),
  });
  expect(result.manifest.dependencies).toEqual({ tool: "~1.2.3" });
  expect(result.manifest.devDependencies).toEqual({ manual: "^2.0.0" });
  expect(result.stats).toEqual({ changed: 1, removed: 0 });
});

test("alias replacement removes the old installed identity", async () => {
  const result = await reconcileDependencies({
    manifest: owned(),
    dependencies: [
      { name: "tool", installAsAlias: "new-tool", version: "2.0.0" },
    ],
  });
  expect(result.manifest.devDependencies).toEqual({
    manual: "^2.0.0",
    "new-tool": "npm:tool@^2.0.0",
  });
  expect(result.manifest.condu?.managedDependencies).toEqual({
    "new-tool": "presence",
  });
  expect(result.stats).toEqual({ changed: 1, removed: 1 });
});

test("relinquishing ownership retains all existing placements", async () => {
  const manifest = owned();
  manifest.dependencies = { tool: "~1.2.3" };
  const result = await reconcileDependencies({
    manifest,
    dependencies: [{ name: "tool", managed: false }],
  });
  expect(result.manifest.dependencies).toEqual(manifest.dependencies);
  expect(result.manifest.devDependencies).toEqual(manifest.devDependencies);
  expect(result.manifest.condu?.managedDependencies).toEqual({});
});

test("allows desired peer and development placements, deduplicating identical declarations", async () => {
  const dependency = { name: "tool", version: "1.0.0" };
  const result = await reconcileDependencies<ConduPackageJson>({
    manifest: { name: "fixture" },
    dependencies: [
      dependency,
      dependency,
      { ...dependency, list: "peerDependencies" },
    ],
  });
  expect(result.manifest.devDependencies).toEqual({ tool: "^1.0.0" });
  expect(result.manifest.peerDependencies).toEqual({ tool: "^1.0.0" });
  expect(result.stats.changed).toBe(1);
});

test("conflicting desired declarations fail before registry resolution", async () => {
  const resolve = vi.fn();
  await expect(
    reconcileDependencies({
      manifest: owned(),
      resolve,
      dependencies: [
        { name: "tool", tag: "latest" },
        { name: "tool", tag: "next" },
      ],
    }),
  ).rejects.toThrow("Conflicting dependency declarations");
  expect(resolve).not.toHaveBeenCalled();
});

test("resolution failure cannot leave partially reconciled manifest state", async () => {
  const manifest = owned();
  await expect(
    reconcileDependencies({
      manifest,
      dependencies: [{ name: "first", version: "1.0.0" }, { name: "missing" }],
      resolve: async () => {
        throw new Error("registry unavailable");
      },
    }),
  ).rejects.toThrow("registry unavailable");
  expect(manifest).toEqual(owned());
});

test("ambiguous acquisition across lists fails without taking user ownership", async () => {
  const manifest: ConduPackageJson = {
    name: "fixture",
    dependencies: { tool: "~1.2.3" },
  };
  await expect(
    reconcileDependencies({
      manifest,
      dependencies: [{ name: "tool", version: "2.0.0" }],
    }),
  ).rejects.toThrow("skipIfExists: false");
  expect(manifest).toEqual({
    name: "fixture",
    dependencies: { tool: "~1.2.3" },
  });
});

test("explicit adoption can acquire an alias already present in another list", async () => {
  const manifest: ConduPackageJson = {
    name: "fixture",
    dependencies: { tool: "~1.2.3" },
  };
  const result = await reconcileDependencies({
    manifest,
    dependencies: [{ name: "tool", version: "2.0.0", skipIfExists: false }],
  });
  expect(result.manifest.condu?.managedDependencies).toEqual({
    tool: "presence",
  });
  expect(result.manifest.dependencies).toEqual({});
  expect(result.manifest.devDependencies).toEqual({ tool: "^2.0.0" });
  const repeated = await reconcileDependencies({
    manifest: result.manifest,
    dependencies: [{ name: "tool", version: "2.0.0", skipIfExists: false }],
  });
  expect(repeated.manifest).toEqual(result.manifest);
  expect(repeated.stats).toEqual({ changed: 0, removed: 0 });
  const removed = await reconcileDependencies({
    manifest: result.manifest,
    dependencies: [],
  });
  expect(removed.manifest.dependencies).toEqual({});
  expect(removed.manifest.devDependencies).toEqual({});
});
