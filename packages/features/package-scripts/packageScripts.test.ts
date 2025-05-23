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

  expect(packageJson.scripts).toMatchInlineSnapshot(`
    {
      "build": "pnpm run build:compile",
      "build:compile": "tsc",
      "test": "pnpm run test:vitest",
      "test:vitest": "vitest --watch=false",
    }
  `);
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

  expect(packageJson.scripts).toMatchInlineSnapshot(`
    {
      "format": "pnpm run lint:eslint",
      "lint:eslint": "eslint",
    }
  `);
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

  // Check the package-specific scripts in packages
  const pkgAContent = testUtils.project.workspacePackages.find(
    ({ relPath }) => relPath === "packages/a",
  );
  expect(pkgAContent).toBeDefined();
  expect(pkgAContent?.manifest.scripts).toMatchInlineSnapshot(`
    {
      "build": "pnpm run build:typescript",
      "build:typescript": "tsc",
    }
  `);

  const pkgBContent = testUtils.project.workspacePackages.find(
    ({ relPath }) => relPath === "packages/b",
  );
  expect(pkgBContent).toBeDefined();
  expect(pkgBContent?.manifest.scripts).toMatchInlineSnapshot(`
    {
      "test": "pnpm run test:vitest",
      "test:vitest": "vitest",
    }
  `);
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

  expect(packageJson.scripts).toMatchInlineSnapshot(`
    {
      "build": "pnpm run build:typescript",
      "build:typescript": "tsc",
      "test": "pnpm run test:test",
      "test:test": "vitest",
    }
  `);

  // Verify excluded script
  expect(packageJson.scripts?.["build:typescript-dev"]).toBeUndefined();
});

test("packageScripts feature should track and clean up managed scripts", async () => {
  // First apply with tasks that add scripts
  const initialTasksFeature = defineFeature("tasksFeature", {
    defineRecipe(condu) {
      condu.root.defineTask("typescript", {
        type: "build",
        definition: {
          command: "tsc",
        },
      });

      condu.root.defineTask("vitest", {
        type: "test",
        definition: {
          command: "vitest",
        },
      });
    },
  });

  using initialUtils = await testApplyFeatures({
    config: { features: [initialTasksFeature, packageScripts()] },
    initialFs: {
      "package.json": JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        scripts: {
          "user-script": "echo user script that should not be touched",
        },
      }),
    },
  });

  // Verify scripts were added and tracked
  const firstPackageJson = initialUtils.project.manifest;
  expect(firstPackageJson.scripts).toMatchObject({
    "user-script": "echo user script that should not be touched",
    "build:typescript": "tsc",
    "test:vitest": "vitest",
    build: expect.any(String),
    test: expect.any(String),
  });

  // Check that the scripts are tracked in condu section
  expect(firstPackageJson.condu?.managedScripts).toEqual([
    "build:typescript",
    "test:vitest",
    "build",
    "test",
  ]);

  // Now simulate removing the vitest task
  const updatedTasksFeature = defineFeature("tasksFeature", {
    defineRecipe(condu) {
      // Only typescript task remains
      condu.root.defineTask("typescript", {
        type: "build",
        definition: {
          command: "tsc",
        },
      });
      // vitest task removed
    },
  });

  // Re-apply with the updated feature
  using updatedUtils = await testApplyFeatures({
    config: { features: [updatedTasksFeature, packageScripts()] },
    // Start from the state after the first apply
    projectDir: initialUtils.projectDir,
  });

  const updatedPackageJson = updatedUtils.project.manifest;
  // Verify that build scripts remain
  expect(updatedPackageJson.scripts?.["build:typescript"]).toBe("tsc");
  expect(updatedPackageJson.scripts?.["build"]).toBeDefined();

  // These scripts should be removed
  expect(updatedPackageJson.scripts?.["test:vitest"]).toBeUndefined();
  expect(updatedPackageJson.scripts?.["test"]).toBeUndefined();

  // The managedScripts list should be updated
  expect(updatedPackageJson.condu?.managedScripts).toContain(
    "build:typescript",
  );
  expect(updatedPackageJson.condu?.managedScripts).toContain("build");
  expect(updatedPackageJson.condu?.managedScripts).not.toContain("test:vitest");
  expect(updatedPackageJson.condu?.managedScripts).not.toContain("test");
});
