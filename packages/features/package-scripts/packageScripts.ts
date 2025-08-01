import {
  defineFeature,
  getRunCommand,
  getSequentialRunCommands,
  type PackageManager,
} from "condu";
import type {
  CollectedTask,
  Task,
} from "condu/commands/apply/CollectedState.js";

/**
 * Escapes a value for safe use in shell environment variable assignment
 */
const escapeShellValue = (value: string): string => {
  // If the value contains no special characters, return as-is
  if (/^[\w./:-]*$/.test(value)) {
    return value;
  }

  // Use double quotes and escape any double quotes and backslashes
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
};

// Helper function to format environment variables for shell execution
const formatEnvVars = (
  env: Record<string, string> | null | undefined,
): string => {
  if (!env || Object.keys(env).length === 0) {
    return "";
  }

  return (
    Object.entries(env)
      .map(([key, value]) => `${key}=${escapeShellValue(value)}`)
      .join(" ") + " "
  );
};

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
    defineGarnish(condu) {
      const { project, globalRegistry } = condu;
      const isMonorepo = Boolean(
        project.config.projects && project.config.projects.length > 0,
      );

      // Default prefix mapping for different task types
      const prefixMapping = {
        build: "build",
        test: "test",
        format: "format",
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

      // Get all tasks from the collected state
      const allTasks = globalRegistry.tasks;
      const filteredTasks = config.filterTasks
        ? allTasks.filter(config.filterTasks)
        : allTasks;

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
        const pkgEntry = project.allPackages.find((p) => p.absPath === pkgPath);
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
          const envVars = formatEnvVars(definition.env);
          const scriptContent = definition.command || definition.script || "";
          const scriptArgs =
            definition.args && Array.isArray(definition.args)
              ? " " + definition.args.join(" ")
              : "";
          packageScripts[scriptName] =
            `${envVars}${scriptContent}${scriptArgs}`;
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
            // Track previously managed scripts that need to be removed
            const previousManagedScripts = manifest.condu?.managedScripts || [];
            const newManagedScripts = Object.keys(packageScripts);

            // Remove scripts that were previously managed but are no longer needed
            if (manifest.scripts) {
              for (const scriptName of previousManagedScripts) {
                if (
                  !newManagedScripts.includes(scriptName) &&
                  manifest.scripts[scriptName]
                ) {
                  delete manifest.scripts[scriptName];
                }
              }
            }

            // Add new scripts
            manifest.scripts = {
              ...manifest.scripts,
              ...packageScripts,
            };

            // Update the list of managed scripts
            manifest.condu ??= {};
            manifest.condu.managedScripts = newManagedScripts;

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
        rootTasksByType[taskType].push(task);

        const scriptName = getScriptName(task);
        const definition = task.taskDefinition.definition;

        // Skip if no command is defined
        if (!definition.command && !definition.script) continue;

        // Create the script content
        const envVars = formatEnvVars(definition.env);
        const scriptContent = definition.command || definition.script || "";
        const scriptArgs =
          definition.args && Array.isArray(definition.args)
            ? " " + definition.args.join(" ")
            : "";
        rootPackageScripts[scriptName] =
          `${envVars}${scriptContent}${scriptArgs}`;
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
            // Track previously managed scripts that need to be removed
            const previousManagedScripts = manifest.condu?.managedScripts || [];
            const newManagedScripts = Object.keys(rootPackageScripts);

            // Remove scripts that were previously managed but are no longer needed
            if (manifest.scripts) {
              for (const scriptName of previousManagedScripts) {
                if (
                  !newManagedScripts.includes(scriptName) &&
                  manifest.scripts[scriptName]
                ) {
                  delete manifest.scripts[scriptName];
                }
              }
            }

            // Add new scripts
            manifest.scripts = {
              ...manifest.scripts,
              ...rootPackageScripts,
            };

            // Update the list of managed scripts
            manifest.condu ??= {};
            manifest.condu.managedScripts = newManagedScripts;

            return manifest;
          });
        }
      }
    },
  });
