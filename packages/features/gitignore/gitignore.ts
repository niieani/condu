import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import { groupBy } from "remeda";

export interface IgnoreConfig {
  ignore?: string[];
}

declare module "@condu/types/extendable.js" {
  interface PeerContext {
    gitignore: Required<IgnoreConfig>;
  }
  interface FileNameToSerializedTypeMapping {
    ".gitignore": Array<string>;
  }
  interface GlobalFileAttributes {
    gitignore: boolean;
  }
}

export const gitignore = (opts: IgnoreConfig = {}) =>
  defineFeature("gitignore", {
    initialPeerContext: { ignore: opts.ignore ?? [] },

    defineRecipe(condu, { ignore }) {
      condu.root.generateFile(".gitignore", {
        content({ globalRegistry }) {
          const files = globalRegistry.getFilesWithAttribute("gitignore", {
            includeUnflagged: true,
          });
          const filesByFeature = groupBy(
            [...files],
            ([_path, file]) =>
              file.managedByFeatures[0]?.featureName ?? "unmanaged",
          );
          const entriesFromFeatures = Object.entries(filesByFeature).flatMap(
            ([featureName, files]) => {
              if (featureName === "gitignore") return [];
              return [`# ${featureName}:`, ...files.map(([p]) => `/${p}`)];
            },
          );
          // TODO: option to group all inAllPackages files by adding a single non / prefixed entry for a cleaner output
          return [
            ".DS_Store",
            "node_modules",
            `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
            `/${condu.project.config.conventions.buildDir}/`,
            // ignore all generated files:
            ...entriesFromFeatures,
            ...(ignore.length > 0 ? ["# custom ignore patterns:"] : []),
            ...ignore,
          ];
        },

        stringify(content) {
          return content.join("\n") + "\n";
        },
      });
    },
  });
