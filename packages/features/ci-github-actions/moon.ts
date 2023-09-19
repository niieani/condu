import { defineFeature } from "../../platform/core/defineFeature.js";
import GithubWorkflow from "../../platform/schema-types/schemas/githubWorkflow.js";
import yaml from "yaml";
import type { PartialInheritedTasksConfig as Tasks } from "@moonrepo/types";
import { otherSchemas as schemas } from "../../platform/schema-types/utils/schemas.js";

export const moonCi = ({}: {} = {}) =>
  defineFeature({
    name: "moonCi",
    order: { priority: "end" },
    actionFn: async (config, state) => {
      const ciWorkflow: GithubWorkflow = {
        name: "CI",
        on: {
          push: { branches: [config.git.defaultBranch] },
          pull_request: {},
        },
        jobs: {
          ci: {
            name: "CI",
            "runs-on": "ubuntu-latest",
            steps: [
              {
                uses: "actions/checkout@v4",
                with: { "fetch-depth": 0 },
              },
              {
                uses: "actions/setup-node@v3",
                with: {
                  "node-version": config.node.version,
                  cache: config.node.packageManager.name,
                },
              },
              { run: `${config.node.packageManager.name} install --immutable` },
              { run: `./node_modules/@moonrepo/cli/moon ci` },
            ],
          },
        },
      };
      return {
        files: [
          {
            path: ".github/workflows/ci.yml",
            type: "committed",
            publish: false,
            content: yaml.stringify(ciWorkflow),
          },
          {
            path: ".moon/tasks.yml",
            content: yaml.stringify({
              $schema: schemas.tasks,
              fileGroups: {
                sources: [`${config.conventions.sourceDir}/**/*`],
                tests: [`${config.conventions.sourceDir}/**/*.test.*`],
              },
            } satisfies Tasks),
          },
        ],
      };
    },
  });
