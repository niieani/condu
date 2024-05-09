import type { DependencyDef, FileDef } from "@condu/core/configTypes.js";
import { defineFeature } from "@condu/core/defineFeature.js";
import type Yarnrc from "@condu/schema-types/schemas/yarnrc.gen.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const yarn = ({ yarnrc }: { yarnrc?: Yarnrc } = {}) =>
  defineFeature({
    name: "yarn",
    actionFn: async (config, state) => {
      // TODO: auto-run `yarn constraints` at some point, maybe during apply?
      const files: FileDef[] = [
        // gitignores:
        { path: ".pnp.*", type: "ignore-only" },
        { path: ".yarn/*", type: "ignore-only" },
        { path: "!.yarn/patches", type: "ignore-only" },
        { path: "!.yarn/plugins", type: "ignore-only" },
        { path: "!.yarn/releases", type: "ignore-only" },
        { path: "!.yarn/sdks", type: "ignore-only" },
        { path: "!.yarn/versions", type: "ignore-only" },
        {
          path: ".yarnrc.yml",
          // if we moved fully to 'bun' for package management,
          // we could get rid of one more file ¯\_(ツ)_/¯
          type: "committed",
          content: async (f) => {
            const existingContent =
              await f.getExistingContentAndMarkAsUserEditable<object>();
            return {
              enableConstraintsChecks: true,
              ...yarnrc,
              nodeLinker: yarnrc?.nodeLinker ?? "node-modules",
              ...existingContent,
            } satisfies Yarnrc;
          },
        },
      ];
      const devDependencies: DependencyDef[] = [];
      if (
        await fs
          .access(
            path.join(config.configDir, "yarn.config.cjs"),
            fs.constants.F_OK,
          )
          .then(
            () => true,
            () => false,
          )
      ) {
        files.push({
          path: "yarn.config.cjs",
          content: `module.exports = require('./${path.basename(
            config.configDir,
          )}/yarn.config.cjs');`,
        });
        devDependencies.push({
          packageAlias: "@yarnpkg/types",
        });
      }
      return {
        effects: [
          {
            files,
            devDependencies,
          },
        ],
      };
    },
  });
