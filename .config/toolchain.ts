import { gitignore } from "../sources/features/gitignore/gitignore.js";

export default {
  engine: "bun@latest",
  features: [gitignore()],
} satisfies import("../sources/configTypes").RepoConfig;
