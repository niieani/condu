import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { conduPackages } from "@condu-feature/condu-packages/conduPackages.js";
import { linkOtherMonorepo } from "@condu-feature/link-other-monorepo/linkOtherMonorepo.js";
import { configure } from "condu";
import { pnpm } from "@condu-feature/pnpm/pnpm.js";
import { moonCi } from "@condu-feature/ci-github-actions/moon.js";
import { moon } from "@condu-feature/moon/moon.js";
import { eslint } from "@condu-feature/eslint/eslint.js";
import { vscode } from "@condu-feature/vscode/vscode.js";
import path from "node:path";

export default configure({
  engine: "bun",
  projects: [{ parentPath: "packages", nameConvention: "@test/*" }],
  conventions: {
    sourceDir: "src",
  },
  features: [
    typescript({
      tsconfig: {
        compilerOptions: {
          preserveSymlinks: false,
          composite: false,
        },
      },
    }),
    linkOtherMonorepo({
      links: [{ linkedProjectDir: path.resolve("../..") }],
    }),
    conduPackages(),
    pnpm(),
    // libraryBundle({
    //   id: "cli",
    //   package: "condu",
    //   entry: "main.ts",
    //   moduleTarget: "esm",
    //   binName: "condu",
    // }),
    eslint(),
    moon(),
    moonCi(),
    vscode(),
    gitignore({ ignore: [".env", ".env.*"] }),
  ],
});
