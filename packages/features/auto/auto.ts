import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";

export const auto = ({}: {} = {}) =>
  defineFeature({
    name: "auto",
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            config.project.manifest.name === CORE_NAME
              ? {
                  path: "auto.config.cjs",
                  content: `module.exports = require('./build/packages/features/auto/auto.config.cjs');`,
                }
              : {
                  path: "auto.config.ts",
                  // TODO: just use the built version if in the 'condu' project
                  // content: `export {default} from '@condu-feature/auto/auto.config.cjs';`,
                  content: `module.exports = require('@condu-feature/auto/auto.config.cjs');`,
                },
          ],
          devDependencies: ["auto"],
        },
      ],
    }),
  });
