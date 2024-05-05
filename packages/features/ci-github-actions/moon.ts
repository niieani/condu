import { defineFeature } from "@condu/core/defineFeature.js";
import type GithubWorkflow from "@condu/schema-types/schemas/githubWorkflow.gen.js";
import type {
  PartialTaskConfig,
  PartialInheritedTasksConfig as Tasks,
  PartialProjectConfig as Project,
} from "@moonrepo/types";
import { otherSchemas as schemas } from "@condu/schema-types/utils/schemas.js";
import { mapValues, groupBy, uniq, partition } from "remeda";
import type {
  FileDef,
  Effects,
  Task,
  Conventions,
} from "@condu/core/configTypes.js";
import { nonEmpty } from "@condu/core/utils/filter.js";
// import { match } from "ts-pattern";

type TasksByType = Record<
  Task["type"],
  [projectName: string, taskName: string][]
>;

// TODO: the way this should actually work is it should be a moonCi feature that contributes "ci" commands to state
// then the Github Actions CI pulls those commands in
export const moonCi = ({}: {} = {}) =>
  defineFeature({
    name: "moonCi",
    order: { priority: "end" },
    actionFn: async (config, state) => {
      const ciWorkflow: GithubWorkflow = {
        name: "Moon CI",
        on: {
          push: { branches: [config.git.defaultBranch] },
          pull_request: {},
        },
        jobs: {
          ci: {
            name: "Moon CI",
            "runs-on": "ubuntu-latest",
            env: {
              MOON_TOOLCHAIN_FORCE_GLOBALS: "true",
            },
            steps: [
              {
                uses: "actions/checkout@v4",
                with: { "fetch-depth": 0 },
              },
              {
                uses: "actions/setup-node@v4",
                with: {
                  "node-version-file": "package.json",
                  // "node-version": config.node.version,
                  cache: config.node.packageManager.name,
                },
              },
              { run: `${config.node.packageManager.name} install --immutable` },
              { run: `./node_modules/@moonrepo/cli/moon ci :build` },
            ],
          },
        },
      };

      const projects = [
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

      const projectStates = projects.flatMap<Effects>((project) => {
        const tasksForProject = taskList.flatMap((task) => {
          if (task.name in tasksByType) {
            throw new Error(
              `In ${project.manifest.name}: Task name '${task.name}' is reserved for the global task type`,
            );
          }
          if (task.target.name === project.manifest.name) {
            tasksByType[task.type].push([project.manifest.name, task.name]);
            return [[task.name, task.definition]] as const;
          }
          return [];
        });
        if (
          tasksForProject.length === 0 &&
          project.manifest.kind === "package"
        ) {
          return [];
        }
        return {
          matchPackage: {
            name: project.manifest.name,
            kind: project.manifest.kind,
          },
          files: [
            {
              path: "moon.yml",
              content: {
                $schema: schemas.project,
                tasks:
                  project.manifest.kind === "package"
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

      const sourceExtensionsConcatenated =
        config.conventions.sourceExtensions.join(",");

      return {
        effects: [
          ...projectStates,
          {
            files: [
              {
                path: ".github/workflows/moon-ci.yml",
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
                } satisfies Tasks,
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
