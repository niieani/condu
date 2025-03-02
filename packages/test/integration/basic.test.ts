import { afterEach, describe, expect, it } from "vitest";
import {
  createBasicConduProject,
  runPnpmInstall,
  runConduApply,
  checkFile,
} from "./test-utils.js";

describe("basic condu functionality", () => {
  let testProject: Awaited<ReturnType<typeof createBasicConduProject>>;

  afterEach(async () => {
    // Clean up after each test
    await testProject.cleanup();
  });

  it("should generate basic configuration files", async () => {
    // Create a test condu config that uses local condu code
    const conduConfig = `
import { configure } from "condu";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { eslint } from "@condu-feature/eslint/eslint.js";
import { prettier } from "@condu-feature/prettier/prettier.js";
import { gitignore } from "@condu-feature/gitignore/gitignore.js";

export default configure({
  features: [
    typescript(),
    eslint(),
    prettier(),
    gitignore({ ignore: [".env", "coverage/", "node_modules/"] })
  ]
});`;

    // Create package.json with dependencies
    const packageJson = {
      name: "condu-basic-test",
      version: "0.0.0",
      private: true,
      type: "module",
      devDependencies: {
        "@condu-feature/typescript": "*",
        "@condu-feature/eslint": "*",
        "@condu-feature/prettier": "*",
        "@condu-feature/gitignore": "*",
        condu: "*",
      },
    };

    // Create the test project
    testProject = await createBasicConduProject(conduConfig, packageJson);

    // Install dependencies
    await runPnpmInstall(testProject.dir);

    // Run condu apply
    await runConduApply(testProject.dir);

    // Check that the expected files were generated
    const tsConfigExists = await checkFile(
      testProject.dir,
      "tsconfig.json",
      (content) => content.includes('"strict": true'),
    );

    const eslintConfigExists = await checkFile(
      testProject.dir,
      "eslint.config.js",
    );

    const prettierConfigExists = await checkFile(
      testProject.dir,
      ".prettierignore",
      (content) => content.includes("tsconfig.json"),
    );

    const gitignoreExists = await checkFile(
      testProject.dir,
      ".gitignore",
      (content) => content.includes(".env") && content.includes("coverage/"),
    );

    // Assert that all files exist and have correct content
    expect(tsConfigExists).toBe(true);
    expect(eslintConfigExists).toBe(true);
    expect(prettierConfigExists).toBe(true);
    expect(gitignoreExists).toBe(true);
  }, 15000); // Increase timeout to 15s for this test
});
