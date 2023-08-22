import { gitignore } from "../packages/features/gitignore/gitignore.js";
import { moon } from "../packages/features/moon/moon.js";

export default {
  engine: "bun@latest",
  features: [
    moon({
      workspace: { projects: ["packages/features/*", "packages/platform/*"] },
    }),
    gitignore(),
  ],
} satisfies import("../packages/platform/core/configTypes.js").RepoConfig;
