import { defineFeature } from "condu/defineFeature.js";
import { pick } from "remeda";

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
                content:
                  () => `import { getConfigs } from "@condu-feature/eslint/config.${
                    RUNNING_SOURCE_VERSION ? "ts" : "js"
                  }";
const configs = getConfigs(${JSON.stringify(pick(config, ["conventions", "projects"]))});
export default configs;`,
              },
            ],
            devDependencies: [
              "eslint",
              "eslint-plugin-import-x",
              "eslint-plugin-unicorn",
              "eslint-import-resolver-typescript",
              "@typescript-eslint/parser",
              "@typescript-eslint/eslint-plugin",
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
