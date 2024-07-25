import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { linkOtherMonorepo } from "@condu-feature/link-other-monorepo/linkOtherMonorepo.js";
import { configure } from "condu/configure.js";

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
    linkOtherMonorepo({
      links: [{ linkedProjectDir: "/Volumes/Projects/Software/toolchain" }],
    }),
    gitignore({ ignore: [".env", ".env.*"] }),
  ],
});
