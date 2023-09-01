import { gitignore } from "../packages/features/gitignore/gitignore.js";
import { moon } from "../packages/features/moon/moon.js";
import { configure } from "../packages/platform/core/configTypes.js";

export default configure({
  engine: "bun",
  projects: ["packages/features/*", "packages/platform/*"],
  features: [
    moon({
      workspace: {},
    }),
    gitignore(),
  ],
});
