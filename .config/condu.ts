import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { conduPackages } from "@condu-feature/condu-packages/conduPackages.js";
import { moon } from "@condu-feature/moon/moon.js";
import { moonCi } from "@condu-feature/ci-github-actions/moon.js";
import { eslint } from "@condu-feature/eslint/eslint.js";
import { pnpm } from "@condu-feature/pnpm/pnpm.js";
import { vscode } from "@condu-feature/vscode/vscode.js";
import { vitest } from "@condu-feature/vitest/vitest.js";
import { libraryBundle } from "@condu-feature/library-bundle/libraryBundle.js";
import { editorconfig } from "@condu-feature/editorconfig/editorconfig.js";
import { prettier } from "@condu-feature/prettier/prettier.js";
import { gptSummarizer } from "@condu-feature/gpt-summarizer/gptSummarizer.js";
import { biome } from "@condu-feature/biome/biome.js";
import { releasePlease } from "@condu-feature/release-please/release-please.js";
import { autoPackageExports } from "@condu-feature/auto-package-exports/autoPackageExports.js";
import { configure, defineFeature } from "condu";
import { packageScripts } from "@condu-feature/package-scripts/packageScripts.js";

export default configure((pkg) => ({
  engine: "bun",
  projects: [
    {
      parentPath: "packages/features",
      nameConvention: "@condu-feature/*",
      templatePath: "../gitignore",
    },
    { parentPath: "packages/presets", nameConvention: "@condu-preset/*" },
    { parentPath: "packages/platform", nameConvention: "@condu/*" },
    {
      parentPath: "packages/test",
      nameConvention: "@condu-test/*",
      private: true,
    },
    { parentPath: "packages/generic", nameConvention: "*" },
  ],
  publish: {
    // registry: "http://localhost:4000/",
  },
  // conventions: {
  //   sourceDir: ".",
  // },
  autolink: {
    mapping: {
      "vitest.ts": "vitest.config.ts",
    },
  },
  features: [
    pnpm({
      npmrc: {
        "shared-workspace-lockfile": true,
      },
    }),
    editorconfig(),
    typescript({
      tsconfig: {
        compilerOptions: {
          skipLibCheck: true,
          composite: false,
        },
        exclude: ["integration-tests", "manual-testing"],
        // include: [".config/condu.ts"],
      },
    }),
    conduPackages(),
    libraryBundle({
      id: "cli",
      package: "condu",
      entry: "index.ts",
      moduleTarget: "esm",
    }),
    defineFeature("bin", {
      defineRecipe(condu) {
        condu.in({ name: "condu" }).modifyPublishedPackageJson((pkg) => ({
          ...pkg,
          bin: { condu: "bin.js" },
          exports: {
            ".": {
              source: "./index.ts",
              types: "./index.d.ts",
              bun: "./index.bundle.js",
              import: "./index.bundle.js",
              default: "./index.bundle.js",
            },
          },
        }));
      },
    }),
    eslint({
      importAdditionalConfigFrom: "./eslint.ts",
      defaultRules: {
        // TODO: opinionated rules (these should not be defaults)
        "unicorn/no-null": "error",
        "unicorn/no-typeof-undefined": "error",
        "unicorn/filename-case": [
          "error",
          {
            cases: {
              camelCase: true,
              pascalCase: true,
              kebabCase: true,
            },
            ignore: [`\\.d\\.ts$`],
          },
        ],
        "unicorn/no-abusive-eslint-disable": "error",
        "unicorn/no-array-for-each": "error",
        "unicorn/no-array-method-this-argument": "error",
        "unicorn/no-document-cookie": "error",
        "unicorn/no-for-loop": "error",
        "unicorn/no-hex-escape": "error",
        "unicorn/no-instanceof-array": "error",
        "unicorn/no-invalid-remove-event-listener": "error",
        // TODO: review the rest https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main?tab=readme-ov-file
      },
    }),
    // prettier({
    //   ignore: [
    //     "**/.*.json",
    //     "integration-tests",
    //     ".github/copilot-instructions.md",
    //   ],
    // }),
    vitest(),
    moon(),
    moonCi(),
    releasePlease({
      initialVersion: "1.0.0",
      configOverrides: {
        "bootstrap-sha": "487dfcb00e029d0c8f483f41d0de82a992885f3d",
      },
    }),
    (condu) => {
      condu.root.ignoreFile("manual-testing");
    },
    vscode({
      hideGeneratedFiles: false,
      suggestedSettings: {
        "explorer.fileNesting.enabled": true,
        "explorer.fileNesting.expand": false,
        "explorer.fileNesting.patterns": {
          "*.cts":
            "${basename}.d.cts,${basename}.d.cts.map,${basename}.cjs,${basename}.cjs.map",
          "*.ts":
            "${basename}.d.ts,${basename}.d.ts.map,${basename}.js,${basename}.js.map",
          "*.mts":
            "${basename}.d.mts,${basename}.d.mts.map,${basename}.mjs,${basename}.mjs.map",
          "*.js": "${basename}.d.ts,${basename}.d.ts.map,${basename}.js.map",
        },
        "explorer.sortOrder": "foldersNestsFiles",
      },
    }),
    // gptSummarizer({
    //   ignore: ["TODO.md", "CHANGELOG.md"],
    //   removeComments: true,
    // }),
    biome({
      config: {
        linter: { enabled: false },
        formatter: { enabled: true, useEditorconfig: true },
        assist: { enabled: false },
        // files: { includes: ["packages"] },
      },
    }),
    autoPackageExports({
      customExportsCondition: true,
    }),
    packageScripts(),
    gitignore({ ignore: [".swc/", ".idea/", ".env", ".env.*", "/brand/"] }),
  ],
}));
