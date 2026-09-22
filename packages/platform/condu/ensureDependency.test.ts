import { expect, test, vi } from "vitest";
import type { MinimalManifest } from "@condu/workspace-utils/packageJsonTypes.js";
import { ensureDependencyIn } from "./ensureDependency.js";

test("skipping an existing unmanaged dependency preserves user ownership", async () => {
  const manifest: MinimalManifest = { devDependencies: { tool: "~1.2.3" } };
  expect(await ensureDependencyIn(manifest, { name: "tool" })).toBe(false);
  expect(manifest.devDependencies?.["tool"]).toBe("~1.2.3");
  expect(manifest.condu?.managedDependencies).toBeUndefined();
  expect(await ensureDependencyIn(manifest, { name: "tool" })).toBe(false);
});

test("skipIfExists false explicitly adopts an existing dependency", async () => {
  const manifest: MinimalManifest = { devDependencies: { tool: "~1.2.3" } };
  expect(
    await ensureDependencyIn(manifest, {
      name: "tool",
      skipIfExists: false,
    }),
  ).toBe(true);
  expect(manifest.devDependencies?.["tool"]).toBe("~1.2.3");
  expect(manifest.condu?.managedDependencies).toEqual({ tool: "presence" });
});

test("presence management preserves an existing descriptor without adding another prefix", async () => {
  const manifest: MinimalManifest = {
    devDependencies: { tool: "npm:actual-tool@~1.2.3" },
  };
  await ensureDependencyIn(manifest, {
    name: "actual-tool",
    installAsAlias: "tool",
    skipIfExists: false,
  });
  expect(manifest.devDependencies?.["tool"]).toBe("npm:actual-tool@~1.2.3");
});

test("managed false relinquishes ownership while retaining the dependency", async () => {
  const manifest: MinimalManifest = {
    devDependencies: { tool: "^1.0.0" },
    condu: { managedDependencies: { tool: "presence" } },
  };
  expect(
    await ensureDependencyIn(manifest, { name: "tool", managed: false }),
  ).toBe(true);
  expect(manifest.devDependencies?.["tool"]).toBe("^1.0.0");
  expect(manifest.condu?.managedDependencies).toEqual({});
});

test("owned dependency management can change without resolving a skipped version", async () => {
  const manifest: MinimalManifest = {
    devDependencies: { tool: "~1.2.3" },
    condu: { managedDependencies: { tool: "presence" } },
  };
  const resolve = vi.fn();
  expect(
    await ensureDependencyIn(
      manifest,
      {
        name: "tool",
        managed: "version",
      },
      resolve,
    ),
  ).toBe(true);
  expect(manifest.condu?.managedDependencies).toEqual({ tool: "version" });
  expect(manifest.devDependencies?.["tool"]).toBe("~1.2.3");
  expect(resolve).not.toHaveBeenCalled();
});

test("version management resolves requested tag through the resolver seam", async () => {
  const manifest: MinimalManifest = {
    devDependencies: { alias: "npm:tool@^1.0.0" },
  };
  const resolve = vi.fn(async () => ({ name: "tool", version: "2.0.0" }));
  await ensureDependencyIn(
    manifest,
    {
      name: "tool",
      installAsAlias: "alias",
      managed: "version",
      skipIfExists: false,
      tag: "next",
      rangePrefix: "~",
    },
    resolve,
  );
  expect(resolve).toHaveBeenCalledWith({ name: "tool", tag: "next" });
  expect(manifest.devDependencies?.["alias"]).toBe("npm:tool@~2.0.0");
  expect(manifest.condu?.managedDependencies).toEqual({ alias: "version" });
});
