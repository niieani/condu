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
}

export const gitignore = (opts: IgnoreConfig = {}) =>
  defineFeature({
    name: "gitignore",
    initialPeerContext: { ignore: opts.ignore ?? [] },
    defineRecipe(condu, { ignore }) {
      condu.inRoot.generateFile(".gitignore", {
        content({ globalRegistry }) {
          const files = globalRegistry.getFilesWithFlag({
            flag: "gitignore",
            value: true,
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
