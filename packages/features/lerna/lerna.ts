import { defineFeature } from "condu/defineFeature.js";
import type { Lerna } from "@condu/schema-types/schemas/lerna.gen.js";
import { getJsonParseAndStringify } from "@condu/cli/commands/apply/defaultParseAndStringify.js";

declare module "@condu/types/extendable.js" {
  interface FileNameToSerializedTypeMapping {
    "lerna.json": Lerna;
  }
}

export const lerna = (opts: {} = {}) =>
  defineFeature("lerna", {
    defineRecipe(condu) {
      condu.root.ensureDependency("lerna");
      condu.root.ignoreFile("lerna-debug.log");
      condu.root.generateFile("lerna.json", {
        ...getJsonParseAndStringify<Lerna>(),
        content: {
          $schema: "node_modules/lerna/schemas/lerna-schema.json",
          version: "independent",
          npmClient:
            condu.project.config.node.packageManager.name === "bun"
              ? "npm"
              : condu.project.config.node.packageManager.name,
          command: {
            version: {
              conventionalCommits: true,
              message: "chore(release): publish %s",
              // also update the "build" folder versions:
              syncDistVersion: true,
              // we will manually tag & push the version
              // gitTagVersion: false,
              // push: false,
            },
            publish: {
              // instead of publishing the source directory,
              // publish the copies along with the compiled output in the dist directory.
              // allows us to be fully flexible with the source directory structure
              directory: "{workspaceRoot}/build/{projectRoot}",
            },
          },
        },
      });
    },
  });
