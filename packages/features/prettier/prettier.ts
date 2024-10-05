import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import type { Config as PrettierConfig } from "prettier";

export const prettier = ({
  config,
  ignore = [],
}: {
  config?: PrettierConfig;
  ignore?: string[];
} = {}) =>
  defineFeature({
    name: "prettier",
    order: { priority: "end" },
    actionFn: (conduConfig, state) => ({
      effects: [
        {
          // TODO: this should change behavior depending on what other features we have enabled,
          // e.g. typescript and eslint
          files: [
            config && {
              path: ".prettierrc.json",
              content: config,
            },
            {
              path: ".prettierignore",
              // ignore all generated files:
              content: () =>
                [
                  ...state.files.map(({ path, targetDir }) =>
                    targetDir === "."
                      ? `/${path}`
                      : `/${targetDir}/${path.startsWith("./") ? path.slice(2) : path}`,
                  ),
                  `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
                  `/${conduConfig.conventions.buildDir}/`,
                  ...conduConfig.conventions.generatedSourceFileNameSuffixes.map(
                    (suffix) => `**/*${suffix}.*`,
                  ),
                  ...(ignore.length > 0 ? ["# custom ignore patterns:"] : []),
                  ...ignore,
                ].join("\n"),
            },
          ],
          devDependencies: ["prettier"],
          tasks: [
            {
              name: "prettier",
              type: "test",
              definition: {
                command: "prettier",
                inputs: ["**/*"],
                args: [".", "--check"],
              },
            },
            {
              name: "prettier",
              type: "format",
              definition: {
                command: "prettier",
                options: { cache: false },
                args: [".", "--write"],
              },
            },
          ],
        },
      ],
    }),
  });
