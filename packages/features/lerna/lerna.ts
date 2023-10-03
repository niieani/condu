import { defineFeature } from "@repo/core/defineFeature.js";

export const gitignore = ({}: {} = {}) =>
  defineFeature({
    name: "lerna",
    actionFn: (config, state) => ({
      files: [
        {
          // path: "auto.config.ts",
          // content: `export {default} from '@repo-feature/auto/auto.config.js';`,
        },
      ],
    }),
  });
