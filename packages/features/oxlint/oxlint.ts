import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import type { OxlintFeatureInput, OxlintFeaturePeerContext } from "./types.js";

export interface OxlintFeatureConfig extends OxlintFeatureInput {}

export const oxlint = ({
  config = {},
  ignore = [],
}: OxlintFeatureConfig = {}) =>
  defineFeature("oxlint", {
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
            "oxc.oxc-vscode",
          ],
        },
      }),
    }),

    defineRecipe(condu, peerContext: OxlintFeaturePeerContext) {
      // Generate .oxlintrc.json configuration file
      condu.root.generateFile(".oxlintrc.json", {
        content({ globalRegistry }) {
          const oxlintConfig = {
            ...peerContext.config,
            ignorePatterns: [
              ...globalRegistry.files.map(([path]) => `/${path}`),
              `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
              `/${condu.project.config.conventions.buildDir}/`,
              ...condu.project.config.conventions.generatedSourceFileNameSuffixes.map(
                (suffix) => `**/*${suffix}.*`,
              ),
              ...(peerContext.config.ignorePatterns ?? []),
              ...peerContext.ignore,
            ].filter((pattern) => typeof pattern === "string"),
          };

          return oxlintConfig;
        },
      });

      // Add oxlint dependency
      condu.root.ensureDependency("oxlint");

      // Define oxlint task
      condu.root.defineTask("oxlint", {
        type: "test",
        definition: {
          command: "oxlint",
          inputs: ["@group(sources)"],
        },
      });
    },
  });
