import { gitignore } from "@repo-feature/gitignore/gitignore.js";
import { typescript } from "@repo-feature/typescript/typescript.js";
import { moon } from "@repo-feature/moon/moon.js";
import { moonCi } from "@repo-feature/ci-github-actions/moon.js";
import { eslint } from "@repo-feature/eslint/eslint.js";
import { lerna } from "@repo-feature/lerna/lerna.js";
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
    typescript({
      tsconfig: {
        compilerOptions: {
          outDir: "dist",
          skipLibCheck: true,
        },
      },
    }),
    eslint(),
    moon(),
    moonCi(),
    lerna(),
    gitignore({ ignore: [".swc/"] }),
  ],
});
