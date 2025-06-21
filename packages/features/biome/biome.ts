import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import type { BiomeFeatureInput, BiomeFeaturePeerContext } from "./types.js";

export interface BiomeFeatureConfig extends BiomeFeatureInput {}

export const biome = ({ config = {}, ignore = [] }: BiomeFeatureConfig = {}) =>
  defineFeature("biome", {
    initialPeerContext: {
      config,
      ignore,
    },

    modifyPeerContexts: () => ({
      vscode: (current) => ({
        ...current,
        extensions: {
          ...current.extensions,
          recommendations: [
            ...(current.extensions.recommendations ?? []),
            "biomejs.biome",
          ],
        },
      }),
    }),

    defineRecipe(condu, peerContext: BiomeFeaturePeerContext) {
      // Generate biome.json configuration file
      condu.root.generateFile("biome.json", {
        content({ globalRegistry }) {
          const ignorePatterns = [
            ...globalRegistry.files.map(([path]) => `!${path}`),
            `!${CONDU_CONFIG_DIR_NAME}/.cache/**`,
            `!${condu.project.config.conventions.buildDir}/**`,
            ...condu.project.config.conventions.generatedSourceFileNameSuffixes.map(
              (suffix) => `!**/*${suffix}.*`,
            ),
            ...peerContext.ignore.map((pattern) => `!${pattern}`),
          ].filter((pattern) => typeof pattern === "string");

          const biomeConfig = {
            $schema: "https://biomejs.dev/schemas/2.0.0-beta/schema.json",
            ...peerContext.config,
            files: {
              ...peerContext.config.files,
              includes: [
                "**",
                ...(peerContext.config.files?.includes ?? []),
                ...ignorePatterns,
              ],
            },
          };

          return biomeConfig;
        },
      });

      // Add biome dependency - use strict version, not a range
      condu.root.ensureDependency("@biomejs/biome", { rangePrefix: "" });

      // Define biome tasks
      condu.root.defineTask("biome-lint", {
        type: "test",
        definition: {
          command: "biome",
          args: ["lint", "."],
          inputs: ["@group(sources)"],
        },
      });

      condu.root.defineTask("biome-format", {
        type: "format",
        definition: {
          command: "biome",
          args: ["format", ".", "--write"],
          options: { cache: false, runInCI: false },
        },
      });

      condu.root.defineTask("biome-check", {
        type: "test",
        definition: {
          command: "biome",
          args: ["check", "."],
          inputs: ["@group(sources)"],
        },
      });
    },
  });
