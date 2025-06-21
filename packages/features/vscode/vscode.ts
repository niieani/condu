import { defineFeature, getJsonParseAndStringify } from "condu";
import { assign } from "comment-json";
import type { VscodeSettingsWorkspace } from "@condu/schema-types/schemas/vscodeSettingsWorkspace.gen.js";
import type { Extensions } from "@condu/schema-types/schemas/vscodeExtensions.gen.js";

const RUNNING_SOURCE_VERSION = import.meta.url.endsWith(".ts");

// TODO: move these to TypeScript feature:
const defaultSuggestedSettings: VscodeSettingsWorkspace = {
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "node_modules/typescript/lib",
};

declare module "condu" {
  interface PeerContext {
    vscode: VSCodePeerContext;
  }
  interface GlobalFileAttributes {
    vscode: boolean;
  }
}

interface VSCodePeerContext {
  /** these settings will be added by default, but can be manually overwritten */
  suggestedSettings: VscodeSettingsWorkspace;
  /** these settings will always override the user's preferences; avoid using in most cases */
  enforcedSettings: VscodeSettingsWorkspace;
  /** extensions configuration for .vscode/extensions.json */
  extensions: Extensions;
}

interface VSCodeConfig extends Partial<VSCodePeerContext> {
  hideGeneratedFiles?: boolean;
}

export const vscode = ({
  hideGeneratedFiles = false,
  ...config
}: VSCodeConfig = {}) =>
  defineFeature("vscode", {
    initialPeerContext: {
      suggestedSettings: config.suggestedSettings ?? {},
      enforcedSettings: config.enforcedSettings ?? {},
      extensions: config.extensions ?? {},
    },

    modifyPeerContexts: () => ({
      global: (current) => ({
        ...current,
        execWithTsSupport: current.execWithTsSupport || RUNNING_SOURCE_VERSION,
      }),
    }),

    defineRecipe(condu, { suggestedSettings, enforcedSettings, extensions }) {
      condu.root.modifyUserEditableFile(".vscode/settings.json", {
        ...getJsonParseAndStringify<VscodeSettingsWorkspace>(),
        ifNotExists: "create",
        content({ content = {}, globalRegistry }) {
          const excludedFiles = [
            // TODO: potentially add a global 'alwaysVisibleInEditor' flag to indicate a file might not be hidden
            ...globalRegistry.getFilesMatchingAttribute("gitignore", {
              includeUnflagged: true,
            }),
          ].filter(
            ([_relPath, file]) =>
              !file.managedByFeatures.some(
                (context) => context.featureName === "vscode",
              ),
          );
          const withEnforcedConfig = assign(content, {
            ...enforcedSettings,
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
              ...(hideGeneratedFiles
                ? Object.fromEntries(
                    excludedFiles.map(([relPath]) => [relPath, true]),
                  )
                : {}),
              ...enforcedSettings?.["files.exclude"],
            },
            "search.exclude": {
              [condu.project.config.conventions.buildDir]: true,
              ...enforcedSettings?.["search.exclude"],
            },
          });
          const suggestedConfigWithDefaults = {
            ...defaultSuggestedSettings,
            ...suggestedSettings,
          };
          const finalConfig = assign(
            suggestedConfigWithDefaults,
            withEnforcedConfig,
          );
          if (Object.keys(finalConfig).length === 0) {
            return undefined;
          }
          return finalConfig;
        },
      });

      // Generate extensions.json if there are extensions configured
      if (
        extensions.recommendations?.length ||
        extensions.unwantedRecommendations?.length
      ) {
        condu.root.modifyUserEditableFile(".vscode/extensions.json", {
          ...getJsonParseAndStringify<Extensions>(),
          ifNotExists: "create",
          content({ content = {} }) {
            // Merge recommendations arrays
            const allRecommendations = [
              ...(content.recommendations ?? []),
              ...(extensions.recommendations ?? []),
            ];
            const mergedRecommendations =
              allRecommendations.length > 0
                ? Array.from(new Set(allRecommendations))
                : undefined;

            // Merge unwantedRecommendations arrays
            const allUnwantedRecommendations = [
              ...(content.unwantedRecommendations ?? []),
              ...(extensions.unwantedRecommendations ?? []),
            ];
            const mergedUnwantedRecommendations =
              allUnwantedRecommendations.length > 0
                ? Array.from(new Set(allUnwantedRecommendations))
                : undefined;

            // Return undefined if no extensions are configured
            if (
              !mergedRecommendations?.length &&
              !mergedUnwantedRecommendations?.length
            ) {
              return undefined;
            }

            // Use assign to preserve comments and other JSON nodes
            const mergedExtensions = assign(content, {
              ...(mergedRecommendations && {
                recommendations: mergedRecommendations,
              }),
              ...(mergedUnwantedRecommendations && {
                unwantedRecommendations: mergedUnwantedRecommendations,
              }),
            });

            return mergedExtensions;
          },
        });
      }

      // TODO: also, auto-add 'tasks.json' based on the defined tasks
    },
  });
