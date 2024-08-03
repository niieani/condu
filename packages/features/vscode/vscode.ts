import { defineFeature } from "condu/defineFeature.js";
import { assign } from "comment-json";
import type VscodeSettingsWorkspace from "@condu/schema-types/schemas/vscodeSettingsWorkspace.gen.js";
import * as path from "node:path";

const RUNNING_SOURCE_VERSION = import.meta.url.endsWith(".ts");

const defaultSuggestedConfig: VscodeSettingsWorkspace = {
  // TODO: only add these eslint settings if the eslint feature is enabled
  "eslint.lintTask.enable": true,
  "eslint.useESLintClass": true,
  // forces vscode to run eslint with the node version installed in the system,
  // instead of the one bundled with vscode
  "eslint.runtime": "node",
  // "eslint.runtime": process.argv0,
  ...(RUNNING_SOURCE_VERSION
    ? {
        "eslint.execArgv": [
          "--import",
          import.meta.resolve("tsx/esm").slice("file://".length),
          "--preserve-symlinks",
        ],
      }
    : {}),
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "node_modules/typescript/lib",
};

export const vscode = ({
  suggestedConfig = {},
  enforcedConfig = {},
  hideGeneratedFiles = false,
}: {
  hideGeneratedFiles?: boolean;
  /** these settings will be added by default, but can be manually overwritten */
  suggestedConfig?: VscodeSettingsWorkspace;
  /** these settings will always override the user's preferences; avoid using in most cases */
  enforcedConfig?: VscodeSettingsWorkspace;
} = {}) =>
  defineFeature({
    name: "vscode",
    order: { priority: "end" },
    actionFn: async (config, state) => {
      // TODO: also, auto-add 'tasks.json' based on the defined tasks
      return {
        effects: [
          {
            files: [
              {
                path: ".vscode/settings.json",
                content: async ({
                  getExistingContentAndMarkAsUserEditable: getExistingContent,
                }) =>
                  // TODO: enable other plugins to contribute to this one, e.g. eslint:
                  // "eslint.ignoreUntitled": true,
                  // "eslint.useESLintClass": true,
                  // and TypeScript:
                  // "typescript.tsserver.experimental.enableProjectDiagnostics": true,
                  // "typescript.preferences.preferTypeOnlyAutoImports": true,
                  {
                    const existingContent =
                      ((await getExistingContent()) as VscodeSettingsWorkspace) ??
                      {};
                    const excludedFiles = hideGeneratedFiles
                      ? Object.fromEntries(
                          state.files
                            .filter(
                              ({ type, skipIgnore, featureName }) =>
                                type !== "committed" &&
                                !skipIgnore &&
                                featureName !== "vscode",
                            )
                            .map(({ path: p, targetDir }) => [
                              // remove leading './' from path
                              path.normalize(path.join(targetDir, p)),
                              true,
                            ]),
                        )
                      : {};
                    const withEnforcedConfig = assign(existingContent, {
                      ...enforcedConfig,
                      "files.exclude": {
                        // ...existingContent?.["files.exclude"],
                        // these are defaults that we want to keep:
                        // "**/.git": true,
                        // "**/.svn": true,
                        // "**/.hg": true,
                        // "**/CVS": true,
                        // "**/.DS_Store": true,
                        // "**/Thumbs.db": true,
                        // "**/.ruby-lsp": true,
                        ...excludedFiles,
                        ...enforcedConfig?.["files.exclude"],
                      },
                      "search.exclude": {
                        [config.conventions.buildDir]: true,
                      },
                    } satisfies VscodeSettingsWorkspace);
                    const suggestedConfigWithDefaults = {
                      ...defaultSuggestedConfig,
                      ...suggestedConfig,
                    };
                    return assign(
                      suggestedConfigWithDefaults,
                      withEnforcedConfig,
                    );
                  },
              },
            ],
          },
        ],
      };
    },
  });
