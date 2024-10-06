import {
  SymlinkTarget,
  type AutoLinkConfig,
} from "@condu/types/configTypes.js";
import {
  CONDU_CONFIG_FILE_NAME,
  CONDU_CONFIG_DIR_NAME,
} from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { match, P } from "ts-pattern";

export const autolink = ({ mapping, ignore = [] }: AutoLinkConfig = {}) =>
  defineFeature({
    name: "autolink",
    order: { priority: "beginning" },
    actionFn: async (config, state) => {
      const entries = await fs.readdir(config.configDir, {
        withFileTypes: true,
      });
      const configFiles = entries
        .filter(
          (entry) =>
            entry.isFile() &&
            entry.name !== CONDU_CONFIG_FILE_NAME &&
            !ignore.some((i) =>
              typeof i === "object" ? i.test(entry.name) : i === entry.name,
            ),
        )
        .map((entry) => entry.name);

      return {
        effects: [
          {
            files: configFiles.map((filename) => {
              const targetName = mapping?.[filename] ?? filename;
              const extension = path.extname(filename);
              return {
                path: targetName,
                content: match(extension)
                  .returnType<string | SymlinkTarget>()
                  .with(
                    P.union(".ts", ".js"),
                    () =>
                      `export * from "./${CONDU_CONFIG_DIR_NAME}/${filename}";`,
                  )
                  .otherwise(
                    () =>
                      new SymlinkTarget(
                        `./${CONDU_CONFIG_DIR_NAME}/${filename}`,
                      ),
                  ),
              };
            }),
          },
        ],
      };
    },
  });
