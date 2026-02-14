import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import type { OxfmtFeatureInput, OxfmtFeaturePeerContext } from "./types.js";

export interface OxfmtFeatureConfig extends OxfmtFeatureInput {}

export const oxfmt = ({ config = {}, ignore = [] }: OxfmtFeatureConfig = {}) =>
  defineFeature("oxfmt", {
    initialPeerContext: {
      config,
      ignore,
    },

    defineRecipe(condu, peerContext: OxfmtFeaturePeerContext) {
      // Generate .oxfmtrc.jsonc configuration file
      condu.root.generateFile(".oxfmtrc.jsonc", {
        content({ globalRegistry }) {
          const ignorePatterns = [
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
            ...(peerContext.config.ignorePatterns ?? []),
            ...peerContext.ignore,
          ].filter((pattern) => typeof pattern === "string");

          return {
            $schema: "./node_modules/oxfmt/configuration_schema.json",
            ...peerContext.config,
            ignorePatterns,
          };
        },
      });

      // Add oxfmt dependency
      condu.root.ensureDependency("oxfmt");

      // Define oxfmt tasks
      condu.root.defineTask("test-oxfmt", {
        type: "test",
        definition: {
          command: "oxfmt",
          inputs: ["@group(sources)"],
          args: ["--check"],
        },
      });

      condu.root.defineTask("format-oxfmt", {
        type: "format",
        definition: {
          command: "oxfmt",
          options: { cache: false, runInCI: false },
        },
      });
    },
  });
