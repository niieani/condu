import { defineFeature, getJsonParseAndStringify } from "condu";
import { assign } from "comment-json";
import type { VscodeSettingsWorkspace } from "@condu/schema-types/schemas/vscodeSettingsWorkspace.gen.js";

const RUNNING_SOURCE_VERSION = import.meta.url.endsWith(".ts");

// TODO: move these to TypeScript feature:
const defaultSuggestedSettings: VscodeSettingsWorkspace = {
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "node_modules/typescript/lib",
};

declare module "@condu/types/extendable.js" {
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
    },

    modifyPeerContexts: () => ({
      global: (current) => ({
        ...current,
        execWithTsSupport: current.execWithTsSupport || RUNNING_SOURCE_VERSION,
      }),
    }),

    defineRecipe(condu, { suggestedSettings, enforcedSettings }) {
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

      // TODO: also, auto-add 'tasks.json' based on the defined tasks
    },
  });
