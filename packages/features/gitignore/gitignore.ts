import { defineFeature } from "../../platform/core/defineFeature.js";

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    order: { priority: "end" },
    actionFn: (config, state) => ({
      files: [
        {
          path: ".gitignore",
          content: [
            ".DS_Store",
            "node_modules",
            // TODO: extract to yarn() feature
            ".yarn/cache",
            // ignore all generated files:
            ...state.files.flatMap(({ path, type }) =>
              type === "committed" ? [] : [path],
            ),
            ...ignore,
          ].join("\n"),
        },
      ],
    }),
  });
