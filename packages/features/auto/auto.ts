import { defineFeature } from "@repo/core/defineFeature.js";

export const auto = ({}: {} = {}) =>
  defineFeature({
    name: "auto",
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            config.project.manifest.name === "toolchain"
              ? {
                  path: "auto.config.js",
                  content: `module.exports = require('./build/packages/features/auto/auto.config.cjs');`,
                }
              : {
                  path: "auto.config.ts",
                  // TODO: just use the built version if in the 'toolchain' project
                  // content: `export {default} from '@repo-feature/auto/auto.config.cjs';`,
                  content: `module.exports = require('@repo-feature/auto/auto.config.cjs');`,
                },
          ],
          devDependencies: ["auto"],
        },
      ],
    }),
  });
