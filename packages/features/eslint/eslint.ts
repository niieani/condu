import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";

export const eslint = ({}: {} = {}) =>
  defineFeature({
    name: "eslint",
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            {
              path: "eslint.config.js",
              content: `import config from '@condu-feature/eslint/config.${
                config.project.manifest.name === CORE_NAME ? "ts" : "js"
              }';
export default config;`,
            },
          ],
          devDependencies: [
            "eslint",
            "eslint-plugin-import@npm:eslint-plugin-i@latest",
            "eslint-plugin-unicorn",
            "eslint-import-resolver-typescript",
            "@typescript-eslint/parser",
            "@typescript-eslint/eslint-plugin",
          ],
        },
      ],
    }),
  });
