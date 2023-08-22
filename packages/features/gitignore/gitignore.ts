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
            "node_modules",
            // TODO: extract to yarn() feature
            ".yarn/cache",
            // ignore all generated files:
            ...state.files.map(({ path }) => path),
            ...ignore,
          ].join("\n"),
        },
      ],
    }),
  });
