import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { createTempDir, execCommand } from "./test-utils.js";

describe("init command functionality", () => {
  let testDir: string;

  afterEach(async () => {
    // Clean up after each test
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("should initialize a condu project with valid configuration and git repository", async () => {
    // Create a temporary directory for testing
    testDir = await createTempDir();

    // Change to the temporary directory
    const cwd = process.cwd();
    process.chdir(testDir);

    // Create a basic package.json
    const packageJson = {
      name: "condu-init-test",
      version: "0.0.0",
      private: true,
    };

    await fs.writeFile(
      path.join(testDir, "package.json"),
      JSON.stringify(packageJson, undefined, 2),
    );

    try {
      // Run the init command
      const initResult = await execCommand("pnpm exec condu init", {
        cwd: testDir,
      });

      // Check that the command succeeded
      expect(initResult.code).toBe(0);

      // Check that the config directory and file were created
      const configExists = await fs
        .access(path.join(testDir, ".config", "condu.ts"))
        .then(() => true)
        .catch(() => false);

      expect(configExists).toBe(true);

      // Check the content of the config file
      const configContent = await fs.readFile(
        path.join(testDir, ".config", "condu.ts"),
        "utf-8",
      );

      // Check that the config file contains import for monorepo preset
      expect(configContent).toContain(
        /* typescript */ `import { monorepo } from "@condu-preset/monorepo"`,
      );

      // Check that the config uses the monorepo preset correctly
      expect(configContent).toContain("export default configure(monorepo({");

      // Check that the package.json was updated
      const updatedPackageJsonContent = await fs.readFile(
        path.join(testDir, "package.json"),
        "utf-8",
      );
      const updatedPackageJson = JSON.parse(updatedPackageJsonContent);

      // Check that the postinstall script was added
      expect(updatedPackageJson.scripts).toBeDefined();
      expect(updatedPackageJson.scripts.postinstall).toBeDefined();
      expect(updatedPackageJson.scripts.postinstall).toContain("condu apply");

      // Check that dependencies were added
      expect(updatedPackageJson.devDependencies).toBeDefined();
      expect(updatedPackageJson.devDependencies.condu).toBeDefined();
      expect(
        updatedPackageJson.devDependencies["@condu-preset/monorepo"],
      ).toBeDefined();

      // Check that type is set to module
      expect(updatedPackageJson.type).toBe("module");

      // Check that a git repository was initialized
      const gitDirExists = await fs
        .access(path.join(testDir, ".git"))
        .then(() => true)
        .catch(() => false);

      expect(gitDirExists).toBe(true);
    } finally {
      // Change back to the original directory
      process.chdir(cwd);
    }
  }, 30000); // Increase timeout to 30s for this test
});
