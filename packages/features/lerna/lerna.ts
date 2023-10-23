import { defineFeature } from "@repo/core/defineFeature.js";
import type Lerna from "@repo/schema-types/schemas/lerna.gen.js";

export const lerna = ({}: {} = {}) =>
  defineFeature({
    name: "lerna",
    actionFn: (config, state) => ({
      devDependencies: ["lerna"],
      files: [
        {
          path: "lerna.json",
          content: {
            $schema: "node_modules/lerna/schemas/lerna-schema.json",
            version: "independent",
            npmClient: "yarn",
            command: {
              version: {
                conventionalCommits: true,
              },
              publish: {
                // instead of publishing the source directory,
                // publish the copies along with the compiled output in the dist directory.
                // allows us to be fully flexible with the source directory structure
                directory: "{workspaceRoot}/dist/{projectRoot}",
              },
            },
          } satisfies Lerna,
        },
      ],
    }),
  });
