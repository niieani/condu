import { defineFeature } from "condu/defineFeature.js";

const RUNNING_SOURCE_VERSION = import.meta.url.endsWith(".ts");

export const eslint = ({}: {} = {}) =>
  defineFeature({
    name: "eslint",
    actionFn: (config, state) => {
      return {
        effects: [
          {
            files: [
              {
                path: "eslint.config.js",
                content: `import config from '@condu-feature/eslint/config.${
                  RUNNING_SOURCE_VERSION ? "ts" : "js"
                }';
export default config;`,
              },
            ],
            devDependencies: [
              "eslint",
              "eslint-plugin-import-x",
              "eslint-plugin-unicorn",
              "eslint-import-resolver-typescript",
              "@typescript-eslint/parser@rc-v8",
              "@typescript-eslint/eslint-plugin@rc-v8",
              ...(RUNNING_SOURCE_VERSION ? ["tsx"] : []),
            ],
            tasks: [
              {
                name: "eslint",
                type: "test",
                definition: {
                  command: "eslint",
                  ...(RUNNING_SOURCE_VERSION
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
