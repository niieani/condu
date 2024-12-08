import { defineFeature, getYamlParseAndStringify } from "condu";
import type { Yarnrc } from "@condu/schema-types/schemas/yarnrc.gen.js";

// declare module "@condu/types/extendable.js" {}

export const yarn = ({ yarnrc }: { yarnrc?: Yarnrc } = {}) =>
  defineFeature("yarn", {
    defineRecipe(condu) {
      // TODO: auto-run `yarn constraints` at some point, maybe during apply?

      // gitignores:
      condu.root.ignoreFile(".pnp.*");
      condu.root.ignoreFile(".yarn/*");
      condu.root.ignoreFile("!.yarn/patches");
      condu.root.ignoreFile("!.yarn/plugins");
      condu.root.ignoreFile("!.yarn/releases");
      condu.root.ignoreFile("!.yarn/sdks");
      condu.root.ignoreFile("!.yarn/versions");

      // if we moved fully to 'bun' for package management,
      // we could get rid of one more file ¯\_(ツ)_/¯
      condu.root.modifyUserEditableFile(".yarnrc.yml", {
        ...getYamlParseAndStringify<Yarnrc>(),
        content: ({ content }) => ({
          enableConstraintsChecks: true,
          ...yarnrc,
          nodeLinker: yarnrc?.nodeLinker ?? "node-modules",
          ...content,
        }),
      });

      condu.root.ensureDependency("@yarnpkg/types");
    },
  });
