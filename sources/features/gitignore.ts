import { defineFeature } from "../defineFeature.js";

// example implementation

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
            // ignore all generated files:
            ...state.files.map(({ path }) => path),
            ...ignore,
          ].join("\n"),
        },
      ],
    }),
  });