import {
  defineFeature,
  getYamlParseAndStringify,
  getMoonWorkspaceProjectsFromConventionConfig,
  CONDU_CONFIG_DIR_NAME,
  CONDU_CONFIG_FILE_NAME,
  type CollectedTask,
  type Task,
  type Conventions,
  BUILTIN_TASK_NAMES,
} from "condu";
import type {
  PartialVcsConfig,
  PartialTaskConfig as MoonTask,
  PartialToolchainConfig as Toolchain,
  PartialWorkspaceConfig as Workspace,
  PartialInheritedTasksConfig as Tasks,
  PartialProjectConfig as MoonProject,
} from "@moonrepo/types";
import { mapValues } from "remeda";
import { otherSchemas as schemas } from "@condu/schema-types/utils/schemas.js";
import { defaultToolchain } from "./defaultToolchain.js";

declare module "@moonrepo/types" {
  interface PartialProjectToolchainConfig {
    // typescript is on by default, but it's a plugin
    typescript?: false;
  }
}

declare module "condu" {
  interface PeerContext {
    moon: MoonPeerContext;
  }
  interface FileNameToSerializedTypeMapping {
    ".moon/toolchain.yml": Toolchain;
    ".moon/workspace.yml": Workspace;
    ".moon/tasks.yml": Tasks;
    "moon.yml": MoonProject;
  }
}

interface MoonPeerContext {
  toolchain: Toolchain;
  workspace: Omit<Workspace, "projects" | "vcs"> & {
    /** projects should be defined in the top-level config */
    projects?: never;
    vcs?: Omit<PartialVcsConfig, "defaultBranch">;
  };
}

type MoonConfig = Partial<MoonPeerContext>;

export const moon = (config: MoonConfig = {}) =>
  defineFeature("moon", {
    initialPeerContext: {
      toolchain: {
        ...defaultToolchain,
        ...config.toolchain,
      },
      workspace: {
        ...config.workspace,
      },
    },
    defineRecipe(condu, { toolchain, workspace }) {
      const config = condu.project.config;
      const moonWorkspaceProjects =
        getMoonWorkspaceProjectsFromConventionConfig(config.projects);

      const sourceExtensionsConcatenated =
        config.conventions.sourceExtensions.join(",");

      condu.root.ensureDependency("@moonrepo/cli", { built: true });
      condu.root.ignoreFile(".moon/");
      condu.root.ignoreFile(".moon/cache");
      condu.root.ignoreFile(".moon/docker");

      condu.root.generateFile(".moon/toolchain.yml", {
        ...getYamlParseAndStringify<Toolchain>(),
        content: {
          $schema: schemas.toolchain,
          ...toolchain,
          node: {
            packageManager: config.node.packageManager.name,
            ...toolchain.node,
          },
        },
      });

      condu.root.generateFile(".moon/workspace.yml", {
        ...getYamlParseAndStringify<Workspace>(),
        content: {
          $schema: schemas.workspace,
          experiments: {
            fasterGlobWalk: true,
            gitV2: true,
          },
          pipeline: {
            // disable pre-task automations:
            installDependencies: false,
            syncProjects: false,
            syncProjectDependencies: false,
            syncWorkspace: false,
          },
          ...workspace,
          projects: {
            ...moonWorkspaceProjects,
            sources: {
              ...moonWorkspaceProjects.sources,
              [condu.project.name]: ".",
            },
          },
          vcs: {
            defaultBranch: config.git.defaultBranch,
            ...workspace?.vcs,
          },
          // hasher: {
          //   ignorePatterns: [
          //     `${config.conventions.buildDir}/**`,
          //     ...(workspace?.hasher?.ignorePatterns ?? []),
          //   ],
          // },
        },
      });

      condu.root.generateFile(".moon/tasks.yml", {
        ...getYamlParseAndStringify<Tasks>(),
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
          implicitInputs: [
            // workspace relative config changes should invalidate all caches
            `/${CONDU_CONFIG_DIR_NAME}/${CONDU_CONFIG_FILE_NAME}`,
          ],
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

          if (!tasksForPackage.length) {
            return undefined;
          }

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
            toolchain: {
              typescript: false,
            },
          };
        },
      });
    },
  });

type TasksByType = Record<Task["type"], CollectedTask[]>;

const getTaskName = (task: CollectedTask) =>
  BUILTIN_TASK_NAMES.has(task.taskDefinition.name)
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
