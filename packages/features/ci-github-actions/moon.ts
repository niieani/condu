import { defineFeature } from "condu/defineFeature.js";
import type { GithubWorkflow } from "@condu/schema-types/schemas/githubWorkflow.gen.js";
import type {
  PartialTaskConfig,
  PartialProjectConfig as Project,
} from "@moonrepo/types";
import { otherSchemas as schemas } from "@condu/schema-types/utils/schemas.js";
import { mapValues } from "remeda";
import type { Effects, Task, Conventions } from "@condu/types/configTypes.js";
import type { GithubAction } from "@condu/schema-types/schemas/githubAction.gen.js";

type TasksByType = Record<
  Task["type"],
  [projectName: string, taskName: string][]
>;

// TODO: the way this should actually work is it should be a moonCi feature that contributes "ci" commands to state
// then the Github Actions CI pulls those commands in
export const moonCi = (opts: {} = {}) =>
  defineFeature({
    name: "moonCi",
    order: { priority: "end" },
    actionFn: async (config, state) => {
      const packageManager = config.node.packageManager.name;
      const ciSetupAction: GithubAction = {
        name: "Moon CI Setup",
        description: "Setup the environment for Moon CI",
        inputs: {
          "registry-url": {
            description: "The NPM registry URL",
            required: false,
            default: "https://registry.npmjs.org/",
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
            ...(config.node.packageManager.name !== "npm"
              ? [{ run: `corepack enable`, shell: "bash" }]
              : []),
            {
              uses: "actions/setup-node@v4",
              with: {
                "node-version-file": "package.json",
                // "node-version": config.node.version,
                cache: config.node.packageManager.name,
                "registry-url": "${{ inputs.registry-url }}",
              },
            },
            { uses: "oven-sh/setup-bun@v1" },
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
              env: {
                MOON_TOOLCHAIN_FORCE_GLOBALS: "true",
              },
            },
          ],
        },
      };
      const ciWorkflow: GithubWorkflow = {
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
            steps: [
              {
                uses: "actions/checkout@v4",
                // 0 indicates all history for all branches and tags:
                with: { "fetch-depth": 0 },
              },
              // TODO: always use the version from main, not the checked out one
              {
                name: "Moon CI",
                uses: "./.github/actions/moon-ci-setup",
              },
            ],
          },
        },
      };

      const packages = [
        ...(await config.project.getWorkspacePackages()),
        config.project,
      ];
      const taskList = state.tasks;
      const tasksByType: TasksByType = {
        build: [],
        test: [],
        format: [],
        publish: [],
        start: [],
      };

      const projectStates = packages.flatMap<Effects>((pkg) => {
        const tasksForProject = taskList.flatMap((task) => {
          if (task.name in tasksByType) {
            throw new Error(
              `In ${pkg.manifest.name}: Task name '${task.name}' is reserved for the global task type`,
            );
          }
          if (task.target.name === pkg.manifest.name) {
            tasksByType[task.type].push([pkg.manifest.name, task.name]);
            return [[task.name, task.definition]] as const;
          }
          return [];
        });
        if (tasksForProject.length === 0 && pkg.kind === "package") {
          return [];
        }
        return {
          matchPackage: {
            name: pkg.manifest.name,
            kind: pkg.kind,
          },
          files: [
            {
              path: "moon.yml",
              content: {
                $schema: schemas.project,
                tasks:
                  pkg.kind === "package"
                    ? Object.fromEntries(tasksForProject)
                    : {
                        ...Object.fromEntries(tasksForProject),
                        // add in type-tasks:
                        // this currently depends on the order of the execution,
                        // we know that the workspace package will be last, so we'll have all the 'tasksByType' populated
                        ...getWorkspaceTasks({
                          tasksByType,
                          conventions: config.conventions,
                        }),
                      },
              } satisfies Project,
            },
          ],
        } as const;
      });

      return {
        effects: [
          ...projectStates,
          {
            files: [
              {
                path: ".github/actions/moon-ci-setup/action.yml",
                type: "committed",
                content: ciSetupAction,
              },
              {
                path: ".github/workflows/moon-ci.yml",
                type: "committed",
                content: ciWorkflow,
              },
            ],
          },
        ],

        flags: ["preventAdditionalTasks"],
      };
    },
  });

function getWorkspaceTasks({
  tasksByType,
  conventions,
}: {
  tasksByType: TasksByType;
  conventions: Required<Conventions>;
}): Record<string, PartialTaskConfig> {
  const tasks = mapValues(
    tasksByType,
    (tasks, type): PartialTaskConfig =>
      // this groups all the tasks of the same type into a single task
      // so that all the features implementing the same task type (e.g. 'test') can be run in parallel
      ({
        // ~ is self-referencing task: https://moonrepo.dev/docs/concepts/target#self-
        deps: tasks.map(
          ([projectName, taskName]) => `${projectName}:${taskName}`,
        ),
        inputs: [],
        ...(type === "publish" && { options: { runDepsInParallel: false } }),
      }),
  );

  return {
    ...tasks,
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
