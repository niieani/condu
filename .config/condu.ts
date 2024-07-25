import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { conduPackages } from "@condu-feature/condu-packages/conduPackages.js";
import { moon } from "@condu-feature/moon/moon.js";
import { moonCi } from "@condu-feature/ci-github-actions/moon.js";
import { eslint } from "@condu-feature/eslint/eslint.js";
import { yarn } from "@condu-feature/yarn/yarn.js";
import { vscode } from "@condu-feature/vscode/vscode.js";
import { libraryBundle } from "@condu-feature/library-bundle/libraryBundle.js";
import { gptSummarizer } from "@condu-feature/gpt-summarizer/gptSummarizer.js";
import { releasePlease } from "@condu-feature/release-please/release-please.js";
import { configure } from "condu/configure.js";

export default configure({
  engine: "bun",
  projects: [
    { parentPath: "packages/features", nameConvention: "@condu-feature/*" },
    { parentPath: "packages/platform", nameConvention: "@condu/*" },
    {
      parentPath: "packages/test",
      nameConvention: "@condu-test/*",
      private: true,
    },
  ],
  publish: {
    // registry: "http://localhost:4000/",
  },
  conventions: {
    sourceDir: ".",
  },
  features: [
    yarn({
      yarnrc: {
        plugins: ["./packages/platform/yarn-plugin/index.cjs"],
      },
    }),
    typescript({
      tsconfig: {
        compilerOptions: {
          skipLibCheck: true,
          composite: false,
        },
      },
    }),
    conduPackages(),
    libraryBundle({
      id: "cli",
      package: "condu",
      entry: "main.ts",
      moduleTarget: "esm",
      binName: "condu",
    }),
    eslint(),
    moon(),
    moonCi(),
    releasePlease({
      initialVersion: "0.0.1",
    }),
    vscode({
      hideGeneratedFiles: false,
      suggestedConfig: {
        "eslint.ignoreUntitled": true,
        "eslint.useESLintClass": true,
        "eslint.execArgv": [
          "--import",
          // @ts-expect-error weird error
          import.meta.resolve("tsx/esm").slice("file://".length),
        ],

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
    gptSummarizer({
      ignore: ["TODO.md", "CHANGELOG.md"],
      removeComments: true,
    }),
    gitignore({ ignore: [".swc/", ".idea/", ".env", ".env.*", "/brand/"] }),
  ],
});
