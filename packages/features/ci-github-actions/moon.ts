import { defineFeature } from "../../platform/core/defineFeature.js";
import GithubWorkflow from "../../platform/schema-types/schemas/githubWorkflow.js";
import type {
  PartialTaskConfig,
  PartialInheritedTasksConfig as Tasks,
} from "@moonrepo/types";
import { otherSchemas as schemas } from "../../platform/schema-types/utils/schemas.js";
import { groupBy, mapValues } from "remeda";
import { Task } from "../../platform/core/configTypes.js";
import { nonEmpty } from "../../platform/core/utils/filter.js";

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

      const taskList = state.tasks.filter(nonEmpty);
      const tasksByType: Record<Task["type"], [Task, ...Task[]]> = groupBy(
        taskList,
        (t) => t.type,
      );
      const typeTasks = mapValues(
        tasksByType,
        (tasks): PartialTaskConfig =>
          // this groups all the tasks of the same type into a single task
          // so that all the features implementing the same task type (e.g. 'test') can be run in parallel
          ({
            // self-referencing task: https://moonrepo.dev/docs/concepts/target#self-
            deps: tasks.flatMap((t) => `~:${t.name}`),
          }),
      );
      const tasks = taskList.map(({ name, definition }) => {
        if (name in typeTasks) {
          throw new Error(
            `Task name '${name}' is reserved for the task type '${definition.type}'`,
          );
        }
        return [name, definition] as const;
      });

      const sourceExtensionsConcatenated =
        config.conventions.sourceExtensions.join(",");
      return {
        files: [
          {
            path: ".github/workflows/ci.yml",
            type: "committed",
            publish: false,
            content: ciWorkflow,
          },
          {
            path: ".moon/tasks.yml",
            content: {
              $schema: schemas.tasks,
              fileGroups: {
                sources: [
                  `${config.conventions.sourceDir}/**/*.{${sourceExtensionsConcatenated}}`,
                ],
                tests: [
                  `${config.conventions.sourceDir}/**/*.test.{${sourceExtensionsConcatenated}}`,
                ],
              },
              tasks: { ...typeTasks, ...Object.fromEntries(tasks) },
            } satisfies Tasks,
          },
        ],
        flags: ["preventAdditionalTasks"],
      };
    },
  });