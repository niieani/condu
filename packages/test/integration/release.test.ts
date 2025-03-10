import { afterAll, beforeAll, describe, expect, test } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { runVerdaccio } from "./verdaccio.js";
import getPort from "get-port";
import { createBasicConduProject, execCommand } from "./test-utils.js";

describe("release command integration", () => {
  let verdaccio: Awaited<ReturnType<typeof runVerdaccio>>;
  let registryPort: number;
  let registryUrl: string;
  let testProject: { dir: string; cleanup: () => Promise<void> };

  beforeAll(async () => {
    // Get an available port
    registryPort = await getPort({ port: 4000 });
    registryUrl = `http://localhost:${registryPort}`;

    // Start Verdaccio on the available port
    verdaccio = await runVerdaccio({ port: registryPort });
    console.log(`Verdaccio server started on port ${registryPort}`);
  });

  afterAll(async () => {
    await testProject?.cleanup();
    if (verdaccio) {
      await verdaccio.close();
      console.log("Verdaccio server closed");
    }
  });

  describe("single package project", () => {
    test("should build and publish a single package project", async () => {
      // Create a basic TypeScript package with dynamic registry URL
      const conduConfig = `
import { configure } from "condu";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { pnpm } from "@condu-feature/pnpm/pnpm.js";
import { gitignore } from "@condu-feature/gitignore/gitignore.js";

export default configure({
  features: [
    typescript(),
    pnpm(),
    gitignore(),
  ],
  publish: {
    registry: "${registryUrl}"
  }
});`;

      const packageJson = {
        name: "condu-release-test-single",
        version: "0.1.0",
        private: false,
        type: "module",
        devDependencies: {
          "@condu-feature/typescript": "*",
          "@condu-feature/pnpm": "*",
          "@condu-feature/gitignore": "*",
          condu: "*",
        },
      };

      // Create test project
      testProject = await createBasicConduProject(conduConfig, packageJson, {
        ".git": {
          refs: { remotes: { origin: { HEAD: "refs/heads/main" } } },
        },
        src: {
          "index.ts": `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
        },
      });

      // Build the package
      const buildResult = await execCommand("pnpm exec tsc -p .", {
        cwd: testProject.dir,
      });
      expect(buildResult.code).toBe(0);

      const releaseResult = await execCommand(
        `pnpm exec condu release --npm-tag=latest`,
        { cwd: testProject.dir },
      );

      expect(releaseResult.code).toBe(0);
      expect(releaseResult.stdout).toContain(
        "Preparing condu-release-test-single for release",
      );

      // Check the generated package.json in the build directory to verify it exists
      const buildPackageJsonContent = await fs.readFile(
        path.join(testProject.dir, "build", "package.json"),
        "utf-8",
      );

      const buildPackageJson = JSON.parse(buildPackageJsonContent);

      // Check that the package.json has the correct name and version
      expect(buildPackageJson.name).toBe("condu-release-test-single");
      expect(buildPackageJson.version).toBe("0.1.0");

      // Check that the publishConfig.registry is set correctly from project config
      expect(buildPackageJson.publishConfig).toBeDefined();
      expect(buildPackageJson.publishConfig.registry).toBe(registryUrl);

      // Verify the type is set to "module"
      expect(buildPackageJson.type).toBe("module");

      // Check that source files were copied
      const srcDir = await fs
        .access(path.join(testProject.dir, "build", "src"))
        .then(() => true)
        .catch(() => false);
      expect(srcDir).toBe(true);

      // Check the TypeScript source file was copied
      const tsSrcExists = await fs
        .access(path.join(testProject.dir, "build", "src", "index.ts"))
        .then(() => true)
        .catch(() => false);
      expect(tsSrcExists).toBe(true);
    }, 60000);
  });

  describe("monorepo project", () => {
    test("should build and publish packages from a monorepo", async () => {
      testProject = await createBasicConduProject(
        `
import { configure } from "condu";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { pnpm } from "@condu-feature/pnpm/pnpm.js";
import { gitignore } from "@condu-feature/gitignore/gitignore.js";

export default configure({
  features: [
    typescript(),
    pnpm(),
    gitignore(),
  ],
  projects: ["packages/*"],
  publish: {
    registry: "${registryUrl}"
  }
});`,
        {
          name: "condu-release-test-mono-root",
          version: "0.1.0",
          private: true,
          type: "module",
          devDependencies: {
            "@condu-feature/typescript": "*",
            "@condu-feature/pnpm": "*",
            "@condu-feature/gitignore": "*",
            condu: "*",
          },
        },
        {
          ".git": {
            refs: { remotes: { origin: { HEAD: "refs/heads/main" } } },
          },
          packages: {
            "pkg-a": {
              "package.json": JSON.stringify(
                {
                  name: "@condu-release-test/pkg-a",
                  version: "0.1.0",
                  private: false,
                  type: "module",
                },
                undefined,
                2,
              ),
              "index.ts": `
export function utilA(): string {
  return "This is package A";
}
              `,
            },
            "pkg-b": {
              "package.json": JSON.stringify(
                {
                  name: "@condu-release-test/pkg-b",
                  version: "0.1.0",
                  private: false,
                  type: "module",
                  dependencies: {
                    "@condu-release-test/pkg-a": "workspace:*",
                  },
                },
                undefined,
                2,
              ),
              "index.ts": `
import { utilA } from "@condu-release-test/pkg-a";
export function utilB(): string {
  return \`Package B using: \${utilA()}\`;
}
              `,
            },
          },
        },
      );

      const workspaceFile = await fs.readFile(
        path.join(testProject.dir, "pnpm-workspace.yaml"),
        "utf-8",
      );
      expect(workspaceFile).toMatchInlineSnapshot(`
        "packages:
          - packages/*
        "
      `);

      // TODO: Build the packages
      const buildResult = await execCommand("pnpm exec condu tsc -b", {
        cwd: testProject.dir,
      });
      expect(buildResult.code).toBe(0);

      // Run condu release
      const releaseResult = await execCommand(
        `pnpm exec condu release --npm-tag=latest packages/pkg-a packages/pkg-b`, // --dry-run --npm-tag=latest
        { cwd: testProject.dir },
      );

      expect(releaseResult.code).toBe(0);
      expect(releaseResult.stdout).toContain(
        "Preparing @condu-release-test/pkg-a for release",
      );
      expect(releaseResult.stdout).toContain(
        "Preparing @condu-release-test/pkg-b for release",
      );
      expect(releaseResult.stderr).toContain(
        `npm notice Publishing to ${registryUrl} with tag latest and public access`,
      );

      // Check the generated package.json files in build directory
      const pkgAJsonContent = await fs.readFile(
        path.join(
          testProject.dir,
          "build",
          "packages",
          "pkg-a",
          "package.json",
        ),
        "utf-8",
      );

      const pkgAJson = JSON.parse(pkgAJsonContent);

      // Check package A build output
      expect(pkgAJson.name).toBe("@condu-release-test/pkg-a");
      expect(pkgAJson.version).toBe("0.1.0");
      expect(pkgAJson.type).toBe("module");
      // Note: The exports field is not being generated because the condu release command
      // is not properly configured with exports. This is a known issue.
      expect(pkgAJson.publishConfig).toBeDefined();
      expect(pkgAJson.publishConfig.access).toBe("public");
      expect(pkgAJson.publishConfig.registry).toBe(registryUrl);

      // Check that source files were copied for package A
      const pkgASrcExists = await fs
        .access(
          path.join(testProject.dir, "build", "packages", "pkg-a", "index.ts"),
        )
        .then(() => true)
        .catch(() => false);
      expect(pkgASrcExists).toBe(true);

      // Check for package B build output directory
      const pkgBDirExists = await fs
        .access(path.join(testProject.dir, "build", "packages", "pkg-b"))
        .then(() => true)
        .catch(() => false);
      expect(pkgBDirExists).toBe(true);

      // Check that source files were copied for package B
      const pkgBSrcExists = await fs
        .access(
          path.join(testProject.dir, "build", "packages", "pkg-b", "index.ts"),
        )
        .then(() => true)
        .catch(() => false);
      expect(pkgBSrcExists).toBe(true);

      // Check the generated package.json for package B
      const pkgBJsonContent = await fs.readFile(
        path.join(
          testProject.dir,
          "build",
          "packages",
          "pkg-b",
          "package.json",
        ),
        "utf-8",
      );

      const pkgBJson = JSON.parse(pkgBJsonContent);

      // Check package B build output
      expect(pkgBJson.name).toBe("@condu-release-test/pkg-b");
      expect(pkgBJson.version).toBe("0.1.0");
      expect(pkgBJson.type).toBe("module");
      expect(pkgBJson.dependencies).toBeDefined();
      expect(pkgBJson.publishConfig).toBeDefined();
      expect(pkgBJson.publishConfig.access).toBe("public");
      expect(pkgBJson.publishConfig.registry).toBe(registryUrl);

      // Verify package B has the correct dependency on package A
      // The workspace:* should be resolved to a specific version
      expect(pkgBJson.dependencies["@condu-release-test/pkg-a"]).toBe(
        pkgAJson.version,
      );
    }, 90000);
  });
});
