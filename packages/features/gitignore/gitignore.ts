import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import * as path from "node:path";
import { groupBy } from "remeda";

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    order: { priority: "end" },
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            {
              path: ".gitignore",
              content: () => {
                const filesByFeature = groupBy(
                  state.files.filter(
                    ({ type, skipIgnore }) =>
                      type !== "committed" && !skipIgnore,
                  ),
                  ({ featureName }) => featureName,
                );
                const entriesFromFeatures = Object.entries(
                  filesByFeature,
                ).flatMap(([featureName, files]) => {
                  if (featureName === "gitignore") return [];
                  return [
                    `# ${featureName}:`,
                    ...files.map(({ path: p, targetDir, type }) =>
                      type === "ignore-only"
                        ? p
                        : `/${path.join(targetDir, p)}`,
                    ),
                  ];
                });
                return [
                  ".DS_Store",
                  "node_modules",
                  `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
                  `/${config.conventions.buildDir}/`,
                  // ignore all generated files:
                  ...entriesFromFeatures,
                  ...(ignore.length > 0 ? ["# custom ignore patterns:"] : []),
                  ...ignore,
                ].join("\n");
              },
            },
          ],
        },
      ],
    }),
  });
