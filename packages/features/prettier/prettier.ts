import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import type { Config as PrettierConfig } from "prettier";

interface PrettierFeatureConfig {
  config?: PrettierConfig;
  ignore?: string[];
}

export const prettier = ({ config, ignore = [] }: PrettierFeatureConfig = {}) =>
  defineFeature("prettier", {
    defineRecipe(condu) {
      // Generate prettier config if provided
      if (config) {
        condu.root.generateFile(".prettierrc.json", {
          content: config,
        });
      }

      // Generate prettierignore file
      condu.root.generateFile(".prettierignore", {
        content({ globalRegistry }) {
          return [
            // ignore all generated files:
            ...globalRegistry.files.map(([path]) => `/${path}`),
            `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
            `/${condu.project.config.conventions.buildDir}/`,
            ...condu.project.config.conventions.generatedSourceFileNameSuffixes.map(
              (suffix) => `**/*${suffix}.*`,
            ),
            "**/pnpm-lock.yaml",
            "**/yarn.lock",
            "**/package-lock.json",
            "**/bun.lockb",
            "**/bun.lock",
            "**/CHANGELOG.md",
            ...(ignore.length > 0 ? ["# custom ignore patterns:"] : []),
            ...ignore,
          ].join("\n");
        },
      });

      // Add prettier dependency
      condu.root.ensureDependency("prettier");

      // Define prettier tasks
      condu.root.defineTask("test-prettier", {
        type: "test",
        definition: {
          command: "prettier",
          inputs: ["**/*"],
          args: [".", "--check"],
        },
      });

      condu.root.defineTask("format-prettier", {
        type: "format",
        definition: {
          command: "prettier",
          options: { cache: false, runInCI: false },
          args: [".", "--write"],
        },
      });
    },
  });
