import {
  defineFeature,
  type ConduApi,
  getRunCommand,
  getSequentialRunCommands,
  type PackageManager,
} from "condu";
import type {
  CollectedTask,
  ConduReadonlyCollectedStateView,
  Task,
} from "condu/commands/apply/CollectedState.js";
import type { PackageJsonModifier } from "condu/commands/apply/ConduPackageEntry.js";
import type { PackageJson } from "@condu/schema-types/schemas/packageJson.gen.js";

/**
 * A feature that generates package.json scripts for tasks defined in features
 */
export const packageScripts = (
  config: {
    /** Custom mapping of task types to script prefixes */
    prefixMapping?: Record<string, string>;
    /** Filter tasks that should not be included */
    filterTasks?: (task: CollectedTask) => boolean;
  } = {},
) =>
  defineFeature("packageScripts", {
    defineRecipe(condu: ConduApi) {
      const { project } = condu;
      const isMonorepo = Boolean(
        project.config.projects && project.config.projects.length > 0,
      );

      // Default prefix mapping for different task types
      const prefixMapping = {
        build: "build",
        test: "test",
        format: "fmt",
        publish: "publish",
        start: "start",
        ...config.prefixMapping,
      };

      // Helper function to generate script name from task
      const getScriptName = (task: CollectedTask): string => {
        const prefix =
          prefixMapping[task.taskDefinition.type] || task.taskDefinition.type;
        return `${prefix}:${task.taskDefinition.name}`;
      };

      // Process tasks from the collected state when apply runs
      // Define a package modifier that will have access to the public API
      const packageModifier: PackageJsonModifier = (
        manifest,
        { globalRegistry },
      ) => {
        // Get all tasks from the collected state
        const allTasks = globalRegistry.tasks;
        const filteredTasks = config.filterTasks
          ? allTasks.filter(config.filterTasks)
          : allTasks;

        // Process the tasks
        processTasksIntoScripts(filteredTasks);

        return manifest;
      };

      // Apply the modifier
      condu.root.modifyPackageJson(packageModifier);

      // Function to process tasks and generate scripts
      function processTasksIntoScripts(
        filteredTasks: readonly CollectedTask[],
      ) {
        // Group tasks by target package
        const tasksByPackage = new Map<string, CollectedTask[]>();
        for (const task of filteredTasks) {
          const pkgPath = task.targetPackage.absPath;
          if (!tasksByPackage.has(pkgPath)) {
            tasksByPackage.set(pkgPath, []);
          }
          tasksByPackage.get(pkgPath)?.push(task);
        }

        // Group tasks by type for aggregated scripts
        const tasksByType: Record<Task["type"], CollectedTask[]> = {
          build: [],
          test: [],
          format: [],
          publish: [],
          start: [],
        };

        // Fill tasksByType from all tasks
        for (const task of filteredTasks) {
          const taskType = task.taskDefinition.type;
          // Check if it's a valid task type we support
          if (taskType in tasksByType) {
            tasksByType[taskType as Task["type"]].push(task);
          }
        }

        // Create scripts for each package
        for (const [pkgPath, tasks] of tasksByPackage.entries()) {
          const pkgEntry = project.allPackages.find(
            (p) => p.absPath === pkgPath,
          );
          if (!pkgEntry) continue;

          // Create scripts for this package
          const packageScripts: Record<string, string> = {};

          // Group tasks by task type for this package
          const tasksByTypeForPackage: Record<Task["type"], CollectedTask[]> = {
            build: [],
            test: [],
            format: [],
            publish: [],
            start: [],
          };

          // First create individual task scripts and group by type
          for (const task of tasks) {
            const taskType = task.taskDefinition.type;

            // Group by task type for aggregation
            if (taskType in tasksByTypeForPackage) {
              tasksByTypeForPackage[taskType as Task["type"]].push(task);
            }

            const scriptName = getScriptName(task);
            const definition = task.taskDefinition.definition;

            // Skip if no command is defined
            if (!definition.command && !definition.script) continue;

            // Create the script content
            const scriptContent = definition.command || definition.script || "";
            const scriptArgs =
              definition.args && Array.isArray(definition.args)
                ? " " + definition.args.join(" ")
                : "";
            packageScripts[scriptName] = `${scriptContent}${scriptArgs}`;
          }

          // Now create aggregated scripts for each task type in this package
          for (const [taskType, tasksOfType] of Object.entries(
            tasksByTypeForPackage,
          )) {
            if (tasksOfType.length > 0) {
              // Get all valid scripts for this type
              const typeScripts = tasksOfType
                .filter(
                  (task) =>
                    task.taskDefinition.definition.command ||
                    task.taskDefinition.definition.script,
                )
                .map((task) => {
                  const scriptName = getScriptName(task);
                  return getRunCommand(
                    project.config.node.packageManager.name as PackageManager,
                    scriptName,
                  );
                });

              if (typeScripts.length > 0) {
                // Create an aggregated script that runs all tasks of this type with &&
                packageScripts[taskType] = getSequentialRunCommands(
                  project.config.node.packageManager.name as PackageManager,
                  tasksOfType
                    .filter(
                      (task) =>
                        task.taskDefinition.definition.command ||
                        task.taskDefinition.definition.script,
                    )
                    .map((task) => getScriptName(task)),
                );
              }
            }
          }

          // Update the package.json for this package
          if (Object.keys(packageScripts).length > 0) {
            condu.in({ absPath: pkgPath }).modifyPackageJson((manifest) => {
              manifest.scripts = {
                ...manifest.scripts,
                ...packageScripts,
              };
              return manifest;
            });
          }
        }

        // Create scripts for workspace root
        // For monorepo root, we need:
        // 1. Scripts to run tasks defined in the root package
        // 2. Scripts to run all tasks of each type recursively across all packages
        const rootPackagePath = project.workspace.absPath;
        const rootPackageScripts: Record<string, string> = {};

        // Group tasks by type for the root package
        const rootTasksByType: Record<Task["type"], CollectedTask[]> = {
          build: [],
          test: [],
          format: [],
          publish: [],
          start: [],
        };

        // Get tasks defined in the root package
        const rootTasks = tasksByPackage.get(rootPackagePath) || [];

        // Create individual scripts and group by type for the root package
        for (const task of rootTasks) {
          const taskType = task.taskDefinition.type;

          // Group by task type for aggregation
          if (taskType in rootTasksByType) {
            rootTasksByType[taskType as Task["type"]].push(task);
          }

          const scriptName = getScriptName(task);
          const definition = task.taskDefinition.definition;

          // Skip if no command is defined
          if (!definition.command && !definition.script) continue;

          // Create the script content
          const scriptContent = definition.command || definition.script || "";
          const scriptArgs =
            definition.args && Array.isArray(definition.args)
              ? " " + definition.args.join(" ")
              : "";
          rootPackageScripts[scriptName] = `${scriptContent}${scriptArgs}`;
        }

        // Create aggregated scripts for the root package
        for (const [taskType, tasksOfType] of Object.entries(rootTasksByType)) {
          if (tasksOfType.length > 0) {
            // Get all valid scripts for this type
            const typeScripts = tasksOfType
              .filter(
                (task) =>
                  task.taskDefinition.definition.command ||
                  task.taskDefinition.definition.script,
              )
              .map((task) => {
                const scriptName = getScriptName(task);
                return getRunCommand(
                  project.config.node.packageManager.name as PackageManager,
                  scriptName,
                );
              });

            if (typeScripts.length > 0) {
              // Create an aggregated script that runs all tasks of this type with &&
              rootPackageScripts[`${taskType}:root`] = getSequentialRunCommands(
                project.config.node.packageManager.name as PackageManager,
                tasksOfType
                  .filter(
                    (task) =>
                      task.taskDefinition.definition.command ||
                      task.taskDefinition.definition.script,
                  )
                  .map((task) => getScriptName(task)),
              );
            }
          }
        }

        // Add aggregated scripts to workspace root in monorepo case
        if (isMonorepo) {
          // Create recursive scripts for each task type
          for (const [taskType, tasks] of Object.entries(tasksByType)) {
            if (tasks.length > 0) {
              const prefix = taskType;

              // Create aggregated script that runs all scripts of this type recursively
              rootPackageScripts[`${prefix}:recursive`] = getRunCommand(
                project.config.node.packageManager.name as PackageManager,
                prefix,
                { recursive: true },
              );

              // Create a master script that runs both root and recursive scripts if needed
              if (rootPackageScripts[`${taskType}:root`]) {
                rootPackageScripts[taskType] = getSequentialRunCommands(
                  project.config.node.packageManager.name as PackageManager,
                  [`${taskType}:root`, `${taskType}:recursive`],
                );
              } else {
                rootPackageScripts[taskType] = getRunCommand(
                  project.config.node.packageManager.name as PackageManager,
                  `${taskType}:recursive`,
                );
              }
            }
          }

          // Add all root package scripts
          if (Object.keys(rootPackageScripts).length > 0) {
            condu.root.modifyPackageJson((manifest) => {
              manifest.scripts = {
                ...manifest.scripts,
                ...rootPackageScripts,
              };
              return manifest;
            });
          }
        }
      }
    },
  });
