import { defineFeature } from "condu/defineFeature.js";
import type { Lerna } from "@condu/schema-types/schemas/lerna.gen.js";

export const lerna = (opts: {} = {}) =>
  defineFeature({
    name: "lerna",
    actionFn: (config, state) => ({
      effects: [
        {
          devDependencies: ["lerna"],
          files: [
            {
              path: "lerna.json",
              content: {
                $schema: "node_modules/lerna/schemas/lerna-schema.json",
                version: "independent",
                npmClient:
                  config.node.packageManager.name === "bun"
                    ? "npm"
                    : config.node.packageManager.name,
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
              } satisfies Lerna,
            },
            { path: "lerna-debug.log" },
          ],
        },
      ],
    }),
  });
