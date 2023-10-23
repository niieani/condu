import { defineFeature } from "@repo/core/defineFeature.js";
import { assign } from "comment-json";
import type VscodeSettingsWorkspace from "@repo/schema-types/schemas/vscodeSettingsWorkspace.gen.js";
import { inspect } from "node:util";

export const vscode = ({
  hideGeneratedFiles = true,
}: { hideGeneratedFiles?: boolean } = {}) =>
  defineFeature({
    name: "vscode",
    order: { priority: "end" },
    actionFn: async (config, state) => {
      // TODO: also, auto-add 'tasks.json' based on the defined tasks
      return {
        files: [
          {
            path: ".vscode/settings.json",
            content: async ({ getExistingContent }) =>
              // TODO: enable other plugins to contribute to this one, e.g. eslint:
              // "eslint.experimental.useFlatConfig": true,
              // "eslint.ignoreUntitled": true,
              // "eslint.useESLintClass": true,
              {
                const existingContent = (await getExistingContent()) as
                  | VscodeSettingsWorkspace
                  | undefined;
                console.log(inspect(existingContent, true));
                return assign(existingContent, {
                  "files.exclude": {
                    ...existingContent?.["files.exclude"],
                    "**/.git": true,
                    "**/.svn": true,
                    "**/.hg": true,
                    "**/CVS": true,
                    "**/.DS_Store": true,
                    "**/Thumbs.db": true,
                    "**/.ruby-lsp": true,
                    ...Object.fromEntries(
                      state.files
                        .filter(
                          ({ type, skipIgnore }) =>
                            type !== "committed" && !skipIgnore,
                        )
                        .map(({ path: p, targetDir }) => [
                          `${targetDir}/${p}`,
                          true,
                        ]),
                    ),
                  },
                } satisfies VscodeSettingsWorkspace);
              },
          },
        ],
      };
    },
  });
