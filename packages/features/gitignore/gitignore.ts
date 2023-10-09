import { defineFeature } from "@repo/core/defineFeature.js";
import { nonEmpty } from "@repo/core/utils/filter.js";
import path from "node:path";

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
            ...state.files
              .filter(nonEmpty)
              // TODO: intelligently group in-package files by workspaces globs
              // and only add exceptions if file isn't generated AND exists
              .flatMap(({ path: p, type, target: { workspacePath } }) =>
                type === "committed" ? [] : [path.join(workspacePath, p)],
              ),
            ...ignore,
          ].join("\n"),
        },
      ],
    }),
  });
