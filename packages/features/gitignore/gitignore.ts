import {
  defineFeature,
  CONDU_CONFIG_DIR_NAME,
  ANONYMOUS_RECIPE_PREFIX,
} from "condu";
import { groupBy, unique } from "remeda";
import { GitIgnore } from "gitignore-matcher/gitignore-matcher.js";

export interface IgnoreConfig {
  ignore?: string[];
}

declare module "condu" {
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
          const files = globalRegistry.getFilesMatchingAttribute("gitignore", {
            includeUnflagged: true,
          });
          // TODO: use Object.groupBy in April 2026 when Node 20 is no longer supported
          const filesByFeature = groupBy(
            [...files],
            ([_path, file]) =>
              file.managedByFeatures[0]?.featureName ?? "unmanaged",
          );
          const userIgnored = new GitIgnore(ignore.join("\n"));
          const entriesFromFeatures = Object.entries(filesByFeature).flatMap(
            ([featureName, files]) => {
              if (featureName === "gitignore") return [];
              return [
                featureName.startsWith(ANONYMOUS_RECIPE_PREFIX)
                  ? "# (anonymous recipe)"
                  : `# ${featureName}:`,
                ...files.flatMap(([p, f]) => {
                  const result = f.attributes.inAllPackages
                    ? f.relPath
                    : `/${p}`;
                  if (userIgnored.isIgnored(result)) {
                    // already ignored by user, do not add again
                    return [];
                  }
                  return [result];
                }),
              ];
            },
          );
          // TODO: option to group all inAllPackages files by adding a single non / prefixed entry for a cleaner output
          return unique([
            ".DS_Store",
            "node_modules",
            `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
            `/${condu.project.config.conventions.buildDir}/`,
            // ignore all generated files:
            ...entriesFromFeatures,
            ...(ignore.length > 0 ? ["# custom ignore patterns:"] : []),
            ...ignore,
          ]);
        },

        stringify(content) {
          return content.join("\n") + "\n";
        },
      });
    },
  });
