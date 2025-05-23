import { autoPackageExports } from "./autoPackageExports.js";
import { defineFeature } from "condu";
import { expect, test } from "vitest";
// Import test utils directly from the relative path
import { testApplyFeatures } from "@condu-test/utils";

test("autoPackageExports feature should generate basic exports", async () => {
  using testUtils = await testApplyFeatures({
    config: { features: [autoPackageExports()] },
    initialFs: {
      "index.ts": "export const hello = 'world';",
      utils: {
        "index.ts": "export const util = () => 'utility';",
      },
      button: {
        "button.ts": "export const Button = () => 'button';",
      },
    },
  });

  await testUtils.testRelease();

  const packageJson = JSON.parse(
    await testUtils.getFileContents("build/package.json"),
  );

  // Check that the package.json has exports field
  expect(packageJson.exports).toBeDefined();

  // Check root export
  expect(packageJson.exports["."]).toMatchObject({
    source: "./index.ts",
    bun: "./index.ts",
    import: "./index.js",
    require: "./index.cjs",
    default: "./index.js",
  });

  // Check utils directory export
  expect(packageJson.exports["./utils"]).toMatchObject({
    source: "./utils/index.ts",
    bun: "./utils/index.ts",
    import: "./utils/index.js",
    require: "./utils/index.cjs",
    default: "./utils/index.js",
  });

  // Check button directory export
  expect(packageJson.exports["./button"]).toMatchObject({
    source: "./button/button.ts",
    bun: "./button/button.ts",
    import: "./button/button.js",
    require: "./button/button.cjs",
    default: "./button/button.js",
  });
});

test("autoPackageExports feature should add custom exports condition", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [autoPackageExports({ customExportsCondition: true })],
    },
    initialFs: {
      "package.json": JSON.stringify({
        name: "test-package",
        version: "1.0.0",
      }),
      "index.ts": "export const hello = 'world';",
    },
  });

  await testUtils.testRelease();

  const packageJson = JSON.parse(
    await testUtils.getFileContents("build/package.json"),
  );

  // Check that the custom condition is added
  expect(packageJson.exports["."]).toHaveProperty("test-package", "./index.ts");
});

test("autoPackageExports feature should work with monorepo structure", async () => {
  // Create a simulated monorepo structure
  const monorepoSetup = defineFeature("monorepoSetup", {
    defineRecipe(condu) {
      // Just a placeholder to set up the structure
    },
  });

  using testUtils = await testApplyFeatures({
    config: {
      projects: ["packages/a", "packages/b"],
      features: [monorepoSetup, autoPackageExports()],
    },
    initialFs: {
      packages: {
        a: {
          "package.json": JSON.stringify({
            name: "package-a",
            version: "1.0.0",
          }),
          "index.ts": "export const packageA = 'A';",
        },
        b: {
          "package.json": JSON.stringify({
            name: "package-b",
            version: "1.0.0",
          }),
          "index.ts": "export const packageB = 'B';",
          "utils/index.ts": "export const utils = 'utils';",
        },
      },
    },
  });

  await testUtils.testRelease();

  const pkgAContent = JSON.parse(
    await testUtils.getFileContents("build/packages/a/package.json"),
  );

  expect(pkgAContent).toBeDefined();

  // Check that package A has exports
  expect(pkgAContent?.exports?.["."]).toMatchObject({
    source: "./index.ts",
    import: "./index.js",
  });

  // Check package B
  const pkgBContent = JSON.parse(
    await testUtils.getFileContents("build/packages/b/package.json"),
  );
  expect(pkgBContent).toBeDefined();

  // Check that package B has exports
  expect(pkgBContent?.exports?.["."]).toMatchObject({
    source: "./index.ts",
    import: "./index.js",
  });

  // Check that package B has utils exports
  expect(pkgBContent?.exports?.["./utils"]).toMatchObject({
    source: "./utils/index.ts",
    import: "./utils/index.js",
  });
});
