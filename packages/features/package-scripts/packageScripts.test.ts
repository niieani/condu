import { packageScripts } from "./packageScripts.js";
import { defineFeature } from "condu";
import { expect, test } from "vitest";
import { testApplyFeatures } from "@condu-test/utils";

test("packageScripts feature should generate scripts for tasks", async () => {
  // Create a feature that defines some tasks
  const tasksFeature = defineFeature("tasksFeature", {
    defineRecipe(condu) {
      // Define a build task
      condu.root.defineTask("compile", {
        type: "build",
        definition: {
          command: "tsc",
        },
      });

      // Define a test task
      condu.root.defineTask("vitest", {
        type: "test",
        definition: {
          command: "vitest",
          args: ["--watch=false"],
        },
      });
    },
  });

  using testUtils = await testApplyFeatures({
    // Create config with the tasks feature and packageScripts feature
    config: { features: [tasksFeature, packageScripts()] },
  });

  // Get the root package.json content
  const packageJson = testUtils.project.manifest;

  // Verify the scripts were generated
  expect(packageJson.scripts).toBeDefined();

  testUtils.bypassMockFs(() => {
    expect(packageJson.scripts).toMatchInlineSnapshot(`
      {
        "build": "pnpm run build:compile",
        "build:compile": "tsc",
        "test": "pnpm run test:vitest",
        "test:vitest": "vitest --watch=false",
      }
    `);
  });
});

test("packageScripts feature should use custom prefix mapping", async () => {
  // Create a feature that defines some tasks
  const tasksFeature = defineFeature("tasksFeature", {
    defineRecipe(condu) {
      condu.root.defineTask("eslint", {
        type: "format",
        definition: {
          command: "eslint",
        },
      });
    },
  });

  // Use custom prefix mapping
  const customPackageScripts = packageScripts({
    prefixMapping: {
      format: "lint", // Map format task type to "lint" prefix
    },
  });

  using testUtils = await testApplyFeatures({
    config: { features: [tasksFeature, customPackageScripts] },
  });

  const packageJson = testUtils.project.manifest;

  testUtils.bypassMockFs(() => {
    expect(packageJson.scripts).toMatchInlineSnapshot(`
      {
        "format": "pnpm run lint:eslint",
        "lint:eslint": "eslint",
      }
    `);
  });
});

test("packageScripts feature should handle monorepo structure", async () => {
  // Create a simulated monorepo structure
  const monorepoSetup = defineFeature("monorepoSetup", {
    defineRecipe(condu) {
      // Root task
      condu.root.defineTask("eslint", {
        type: "test",
        definition: {
          command: "eslint .",
        },
      });

      // Package tasks
      condu.in({ name: "package-a" }).defineTask("typescript", {
        type: "build",
        definition: {
          command: "tsc",
        },
      });

      condu.in({ name: "package-b" }).defineTask("vitest", {
        type: "test",
        definition: {
          command: "vitest",
        },
      });
    },
  });

  using testUtils = await testApplyFeatures({
    config: {
      projects: ["packages/a", "packages/b"],
      features: [monorepoSetup, packageScripts()],
    },
    initialFs: {
      packages: {
        a: {
          "package.json": JSON.stringify({
            name: "package-a",
            version: "1.0.0",
          }),
        },
        b: {
          "package.json": JSON.stringify({
            name: "package-b",
            version: "1.0.0",
          }),
        },
      },
    },
  });

  const rootPackageJson = testUtils.project.manifest;

  testUtils.bypassMockFs(() => {
    expect(rootPackageJson.scripts).toMatchInlineSnapshot(`
      {
        "build": "pnpm run build:recursive",
        "build:recursive": "pnpm -r run build",
        "test": "pnpm run test:root && pnpm run test:recursive",
        "test:eslint": "eslint .",
        "test:recursive": "pnpm -r run test",
        "test:root": "pnpm run test:eslint",
      }
    `);
  });

  // Check the package-specific scripts in packages
  const pkgAContent = testUtils.project.workspacePackages.find(
    ({ relPath }) => relPath === "packages/a",
  );
  expect(pkgAContent).toBeDefined();
  testUtils.bypassMockFs(() => {
    expect(pkgAContent?.manifest.scripts).toMatchInlineSnapshot(`
      {
        "build": "pnpm run build:typescript",
        "build:typescript": "tsc",
      }
    `);
  });

  const pkgBContent = testUtils.project.workspacePackages.find(
    ({ relPath }) => relPath === "packages/b",
  );
  expect(pkgBContent).toBeDefined();
  testUtils.bypassMockFs(() => {
    expect(pkgBContent?.manifest.scripts).toMatchInlineSnapshot(`
      {
        "test": "pnpm run test:vitest",
        "test:vitest": "vitest",
      }
    `);
  });
});

test("packageScripts feature should filter tasks with custom filter", async () => {
  const tasksFeature = defineFeature("tasksFeature", {
    defineRecipe(condu) {
      // Define tasks with different properties
      condu.root.defineTask("typescript", {
        type: "build",
        definition: {
          command: "tsc",
        },
      });

      condu.root.defineTask("typescript-dev", {
        type: "build",
        definition: {
          command: "tsc --watch",
        },
      });

      condu.root.defineTask("test", {
        type: "test",
        definition: {
          command: "vitest",
        },
      });
    },
  });

  // Create packageScripts with filter to exclude certain tasks
  const filteredPackageScripts = packageScripts({
    filterTasks: (task) => !task.taskDefinition.name.endsWith("-dev"),
  });

  using testUtils = await testApplyFeatures({
    config: { features: [tasksFeature, filteredPackageScripts] },
  });

  const packageJson = testUtils.project.manifest;

  testUtils.bypassMockFs(() => {
    expect(packageJson.scripts).toMatchInlineSnapshot(`
      {
        "build": "pnpm run build:typescript",
        "build:typescript": "tsc",
        "test": "pnpm run test:test",
        "test:test": "vitest",
      }
    `);
  });

  // Verify excluded script
  expect(packageJson.scripts?.["build:typescript-dev"]).toBeUndefined();
});
