import { defineFeature } from "@condu/core/defineFeature.js";
import { CONDU_WORKSPACE_PACKAGE_NAME } from "@condu/core/constants.js";

export const eslint = ({}: {} = {}) =>
  defineFeature({
    name: "eslint",
    actionFn: (config, state) => {
      const isInternalCondu =
        config.project.manifest.name === CONDU_WORKSPACE_PACKAGE_NAME;
      return {
        effects: [
          {
            files: [
              {
                path: "eslint.config.js",
                content: `import config from '@condu-feature/eslint/config.${
                  isInternalCondu ? "ts" : "js"
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
            tasks: [
              {
                name: "eslint",
                type: "test",
                definition: {
                  command: "eslint",
                  ...(isInternalCondu
                    ? {
                        env: {
                          NODE_OPTIONS: "--import tsx/esm",
                        },
                      }
                    : {}),
                },
              },
            ],
          },
        ],
      };
    },
  });
