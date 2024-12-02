import { defineFeature } from "condu/defineFeature.js";
import type { GithubWorkflow } from "@condu/schema-types/schemas/githubWorkflow.gen.js";
import type {
  PartialTaskConfig as MoonTask,
  PartialProjectConfig as MoonProject,
} from "@moonrepo/types";
import { otherSchemas as schemas } from "@condu/schema-types/utils/schemas.js";
import { mapValues } from "remeda";
import type { Conventions } from "@condu/types/configTypes.js";
import type {
  CollectedTask,
  Task,
} from "@condu/cli/commands/apply/CollectedState.js";
import type { GithubAction } from "@condu/schema-types/schemas/githubAction.gen.js";
import { getYamlParseAndStringify } from "@condu/cli/commands/apply/defaultParseAndStringify.js";

declare module "@condu/types/extendable.js" {
  interface FileNameToSerializedTypeMapping {
    ".github/actions/moon-ci-setup/action.yml": GithubAction;
    ".github/workflows/moon-ci.yml": GithubWorkflow;
    "moon.yml": MoonProject;
  }
}

// TODO: maybe moonCi feature should just add a step to .github/actions/ci-setup/action.yml ?
// then the Github Actions CI pulls those commands in
export const moonCi = (opts: {} = {}) =>
  defineFeature("moonCi", {
    defineRecipe(condu, peerContext) {
      const config = condu.project.config;
      const packageManager = config.node.packageManager.name;
      condu.root.generateFile(".github/actions/moon-ci-setup/action.yml", {
        ...getYamlParseAndStringify<GithubAction>(),
        content: {
          name: "Moon CI Setup",
          description: "Setup the environment for Moon CI",
          inputs: {
            "registry-url": {
              description: "The NPM registry URL",
              required: false,
              default:
                config.publish?.registry ?? "https://registry.npmjs.org/",
            },
          },
          runs: {
            using: "composite",
            steps: [
              // {
              //   uses: "actions/checkout@v4",
              //   // 0 indicates all history for all branches and tags:
              //   with: { "fetch-depth": 0 },
              // },
              // TODO: use pnpm action if pnpm is the package manager
              ...(packageManager !== "npm" && packageManager !== "bun"
                ? [{ run: `corepack enable`, shell: "bash" }]
                : []),
              {
                uses: "actions/setup-node@v4",
                with: {
                  "node-version-file": "package.json",
                  // "node-version": config.node.version,
                  cache: packageManager === "bun" ? "" : packageManager,
                  "registry-url": "${{ inputs.registry-url }}",
                },
              },
              { uses: "oven-sh/setup-bun@v2" },
              {
                // for pnpm & bun: install --frozen-lockfile
                // for yarn: install --immutable
                // for npm: npm ci
                run: `${packageManager} ${
                  packageManager === "yarn"
                    ? "install --immutable"
                    : packageManager === "npm"
                      ? "ci"
                      : "install --frozen-lockfile"
                }`,
                shell: "bash",
              },
              {
                run: `./node_modules/.bin/moon ci :build`,
                shell: "bash",
                env: { MOON_TOOLCHAIN_FORCE_GLOBALS: "true" },
              },
            ],
          },
        },
      });

      condu.root.generateFile(".github/workflows/moon-ci.yml", {
        ...getYamlParseAndStringify<GithubWorkflow>(),
        content: {
          name: "Moon CI",
          on: {
            push: { branches: [config.git.defaultBranch] },
            pull_request: {},
          },
          env: {
            GIT_DEFAULT_BRANCH: "${{ github.event.repository.default_branch }}",
          },
          jobs: {
            ci: {
              name: "Moon CI",
              "runs-on": "ubuntu-latest",
              env: { MOON_TOOLCHAIN_FORCE_GLOBALS: "true" },
              steps: [
                {
                  uses: "actions/checkout@v4",
                  // 0 indicates all history for all branches and tags:
                  with: { "fetch-depth": 0 },
                },
                // TODO: always use the version from main, not the checked out one
                {
                  name: "Moon CI Setup",
                  uses: "./.github/actions/moon-ci-setup",
                },
                {
                  name: "Test",
                  run: `./node_modules/.bin/moon ci :test`,
                  shell: "bash",
                },
              ],
            },
          },
        },
      });

      condu.in({ kind: "package" }).generateFile("moon.yml", {
        ...getYamlParseAndStringify<MoonProject>(),
        content: ({ targetPackage, globalRegistry }) => {
          const tasksForPackage = Array.from(
            globalRegistry.getTasksMatchingPackage(targetPackage),
            (task) =>
              [getTaskName(task), task.taskDefinition.definition] as const,
          );
          const tasks = Object.fromEntries(tasksForPackage) as Record<
            string,
            MoonTask
          >;

          return {
            $schema: schemas.project,
            tasks,
          };
        },
      });

      // add in type-tasks:
      condu.root.generateFile("moon.yml", {
        ...getYamlParseAndStringify<MoonProject>(),
        content: ({ targetPackage, globalRegistry }) => {
          // also add in the tasks defined for the workspace package:
          const tasksForPackage = Array.from(
            globalRegistry.getTasksMatchingPackage(targetPackage),
            (task) =>
              [
                task.taskDefinition.name,
                task.taskDefinition.definition,
              ] as const,
          );
          const tasks = Object.fromEntries(tasksForPackage) as Record<
            string,
            MoonTask
          >;

          return {
            $schema: schemas.project,
            tasks: {
              ...tasks,
              ...getWorkspaceTasks({
                tasks: globalRegistry.tasks,
                conventions: config.conventions,
              }),
            },
          };
        },
      });
    },
  });

type TasksByType = Record<Task["type"], CollectedTask[]>;

const builtinTaskNames = new Set<string>([
  "build",
  "test",
  "format",
  "publish",
  "start",
] satisfies Task["type"][]);

const getTaskName = (task: CollectedTask) =>
  builtinTaskNames.has(task.taskDefinition.name)
    ? `${task.targetPackage.scopedName}-${task.taskDefinition.name}`
    : task.taskDefinition.name;

function getWorkspaceTasks({
  tasks,
  conventions,
}: {
  tasks: readonly CollectedTask[];
  conventions: Required<Conventions>;
}): Record<string, MoonTask> {
  const tasksByType: TasksByType = {
    build: [],
    test: [],
    format: [],
    publish: [],
    start: [],
  };

  for (const task of tasks) {
    if (task.targetPackage.kind === "workspace") {
      continue;
    }
    tasksByType[task.taskDefinition.type].push(task);
  }

  const taskDefinitions = mapValues(
    tasksByType,
    (tasks, type): MoonTask =>
      // this groups all the tasks of the same type into a single task
      // so that all the features implementing the same task type (e.g. 'test') can be run in parallel
      ({
        // ~ is self-referencing task: https://moonrepo.dev/docs/concepts/target#self-
        deps: tasks.map(
          (task) => `${task.targetPackage.name}:${getTaskName(task)}`,
        ),
        inputs: [],
        ...(type === "publish" && { options: { runDepsInParallel: false } }),
        ...(type === "format" && { options: { runInCI: false } }),
      }),
  );

  return {
    ...taskDefinitions,
    // "build-tasks": tasks.build,
    clean: {
      command: `rm -rf ${conventions.buildDir} .moon/cache/states`,
      options: { cache: false, runInCI: false },
    },
    // build: {
    //   deps: ["~:clean", "~:build-tasks"],
    //   inputs: [],
    //   options: { runDepsInParallel: false },
    // },
  };
}
