import type { DependencyDef, FileDef } from "@repo/core/configTypes.js";
import { defineFeature } from "@repo/core/defineFeature.js";
import type Yarnrc from "@repo/schema-types/schemas/yarnrc.gen.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export const yarn = ({ yarnrc }: { yarnrc?: Yarnrc } = {}) =>
  defineFeature({
    name: "yarn",
    actionFn: async (config, state) => {
      // TODO: auto-run `yarn constraints` at some point, maybe during apply?
      const files: FileDef[] = [
        {
          // this is to mark cache as gitignored
          path: ".yarn/cache/",
        },
        {
          path: ".yarnrc.yml",
          // if we moved fully to 'bun' for package management,
          // we could get rid of one more file ¯\_(ツ)_/¯
          type: "committed",
          content: {
            ...yarnrc,
            nodeLinker: yarnrc?.nodeLinker ?? "node-modules",
          } satisfies Yarnrc,
        },
      ];
      const devDependencies: DependencyDef[] = [];
      if (await fs.exists(path.join(config.configDir, "yarn.config.cjs"))) {
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
        files,
        devDependencies,
      };
    },
  });
