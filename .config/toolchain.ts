import { gitignore } from "../packages/features/gitignore/gitignore.js";
import { moon } from "../packages/features/moon/moon.js";

export default {
  engine: "bun@latest",
  features: [
    gitignore(),
    moon({
      workspace: { projects: ["packages/features/*", "packages/platform/*"] },
    }),
  ],
} satisfies import("../packages/platform/core/configTypes.js").RepoConfig;
