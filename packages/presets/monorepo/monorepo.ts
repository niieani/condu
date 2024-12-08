import { gitignore } from "@condu-feature/gitignore/gitignore.js";
import { typescript } from "@condu-feature/typescript/typescript.js";
import { conduPackages } from "@condu-feature/condu-packages/conduPackages.js";
import { moon } from "@condu-feature/moon/moon.js";
import { moonCi } from "@condu-feature/ci-github-actions/moon.js";
import { eslint } from "@condu-feature/eslint/eslint.js";
import { pnpm } from "@condu-feature/pnpm/pnpm.js";
import { vscode } from "@condu-feature/vscode/vscode.js";
import { releasePlease } from "@condu-feature/release-please/release-please.js";
import type { ConduConfig, IPackageEntry } from "condu";

type Argument<T extends (arg: any) => any> = T extends (arg: infer P) => any
  ? P
  : never;

export const monorepo = (configs: {
  gitignore?: Argument<typeof gitignore>;
  typescript?: Argument<typeof typescript>;
  conduPackages?: Argument<typeof conduPackages>;
  moon?: Argument<typeof moon>;
  moonCi?: Argument<typeof moonCi>;
  eslint?: Argument<typeof eslint>;
  pnpm?: Argument<typeof pnpm>;
  vscode?: Argument<typeof vscode>;
  releasePlease?: Argument<typeof releasePlease>;
  pkg: IPackageEntry;
}) =>
  ({
    projects: [
      {
        parentPath: "packages",
        nameConvention: `${configs.pkg.manifest.condu?.defaultScope ?? configs.pkg.scope ?? `@${configs.pkg.name}`}/*`,
      },
    ],
    features: [
      pnpm(configs.pnpm),
      typescript(configs.typescript),
      conduPackages(configs.conduPackages),
      eslint(configs.eslint),
      moon(configs.moon),
      moonCi(configs.moonCi),
      releasePlease(configs.releasePlease),
      vscode(configs.vscode),
      gitignore({
        ...configs.gitignore,
        ignore: [".env", ".env.*", ...(configs.gitignore?.ignore ?? [])],
      }),
    ],
  }) satisfies ConduConfig;
