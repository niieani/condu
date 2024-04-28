import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { configure } from "@condu/core/configTypes.js";

export default configure({
  engine: "bun",
  node: {
    packageManager: {
      name: "pnpm",
    },
  },
  projects: [{ parentPath: "packages", nameConvention: "@test/*" }],
  conventions: {
    sourceDir: ".",
  },
  features: [
    typescript({
      tsconfig: {
        compilerOptions: {
          preserveSymlinks: false,
        },
      },
    }),
    gitignore({ ignore: [".env", ".env.*"] }),
  ],
});
