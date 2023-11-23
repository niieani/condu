import { gitignore } from "@repo-feature/gitignore/gitignore.js";
import { typescript } from "@repo-feature/typescript/typescript.js";
import { moon } from "@repo-feature/moon/moon.js";
import { moonCi } from "@repo-feature/ci-github-actions/moon.js";
import { eslint } from "@repo-feature/eslint/eslint.js";
import { lerna } from "@repo-feature/lerna/lerna.js";
import { yarn } from "@repo-feature/yarn/yarn.js";
import { vscode } from "@repo-feature/vscode/vscode.js";
import { libraryBundle } from "@repo-feature/library-bundle/libraryBundle.js";
import { gptSummarizer } from "@repo-feature/gpt-summarizer/gptSummarizer.js";
import { configure } from "@repo/core/configTypes.js";

export default configure({
  engine: "bun",
  projects: [
    { parentPath: "packages/features", nameConvention: "@repo-feature/*" },
    { parentPath: "packages/platform", nameConvention: "@repo/*" },
  ],
  conventions: {
    sourceDir: ".",
  },
  features: [
    yarn(),
    typescript({
      tsconfig: {
        compilerOptions: {
          skipLibCheck: true,
          composite: false,
        },
      },
    }),
    libraryBundle({
      id: "cli",
      package: "@repo/cli",
      entry: "main.ts",
      moduleTarget: "esm",
    }),
    eslint(),
    moon(),
    moonCi(),
    lerna(),
    vscode({
      hideGeneratedFiles: false,
      suggestedConfig: {
        "eslint.experimental.useFlatConfig": true,
        "eslint.ignoreUntitled": true,
        "eslint.useESLintClass": true,
        "eslint.execArgv": ["--loader", "./node_modules/tsx/dist/loader.mjs"],

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
    gptSummarizer(),
    gitignore({ ignore: [".swc/"] }),
  ],
});
