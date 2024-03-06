import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { moon } from "@condu-feature/moon/moon.js";
import { auto } from "@condu-feature/auto/auto.js";
import { moonCi } from "@condu-feature/ci-github-actions/moon.js";
import { eslint } from "@condu-feature/eslint/eslint.js";
import { lerna } from "@condu-feature/lerna/lerna.js";
import { yarn } from "@condu-feature/yarn/yarn.js";
import { vscode } from "@condu-feature/vscode/vscode.js";
import { libraryBundle } from "@condu-feature/library-bundle/libraryBundle.js";
import { gptSummarizer } from "@condu-feature/gpt-summarizer/gptSummarizer.js";
import { configure } from "@condu/core/configTypes.js";

export default configure({
  engine: "bun",
  projects: [
    { parentPath: "packages/features", nameConvention: "@condu-feature/*" },
    { parentPath: "packages/platform", nameConvention: "@condu/*" },
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
      package: "@condu/cli",
      entry: "main.ts",
      moduleTarget: "esm",
      binName: "condu",
    }),
    eslint(),
    moon(),
    moonCi(),
    lerna(),
    auto(),
    vscode({
      hideGeneratedFiles: false,
      suggestedConfig: {
        "eslint.experimental.useFlatConfig": true,
        "eslint.ignoreUntitled": true,
        "eslint.useESLintClass": true,
        "eslint.runtime": "./node_modules/.bin/tsx",
        // "eslint.execArgv": ["--loader", "./node_modules/tsx/dist/loader.mjs"],

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
    gitignore({ ignore: [".swc/", ".idea/", ".env", ".env.*", "/brand/"] }),
  ],
});
