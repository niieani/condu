import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import { pick } from "remeda";
import type {
  ContextProvidedToEslintConfig,
  EslintFeatureInput,
} from "./types.js";
import path from "node:path";

const RUNNING_SOURCE_VERSION = import.meta.url.endsWith(".ts");

export interface EslintFeatureConfig extends EslintFeatureInput {
  importAdditionalConfigFrom?: string;
}

export interface EslintFeaturePeerContext extends Required<EslintFeatureInput> {
  importAdditionalConfigFrom?: string;
}

declare module "condu" {
  interface PeerContext {
    eslint: EslintFeaturePeerContext;
  }
}

export const eslint = (config: EslintFeatureConfig = {}) =>
  defineFeature("eslint", {
    initialPeerContext: {
      ...config,
      defaultRules: config.defaultRules ?? {},
      ignores: config.ignores ?? [],
    },

    modifyPeerContexts: (project, initialPeerContext) => ({
      global: (current) => ({
        ...current,
        execWithTsSupport:
          RUNNING_SOURCE_VERSION ||
          initialPeerContext.importAdditionalConfigFrom?.endsWith(".ts") ||
          current.execWithTsSupport,
      }),
      autolink: (current) => ({
        ...current,
        ignore: [
          ...current.ignore,
          ...(initialPeerContext.importAdditionalConfigFrom
            ? [initialPeerContext.importAdditionalConfigFrom]
            : []),
        ],
      }),
      vscode: (current) => ({
        ...current,
        suggestedSettings: {
          ...current.suggestedSettings,
          "eslint.lintTask.enable": true,
          "eslint.useESLintClass": true,
          // forces vscode to run eslint with the node version installed in the system,
          // instead of the one bundled with vscode
          "eslint.runtime": "node",
          // "eslint.runtime": process.argv0,
        },
        enforcedSettings: {
          ...current.enforcedSettings,
          ...(project.config.globalPeerContext.execWithTsSupport
            ? {
                "eslint.execArgv": [
                  "--import",
                  import.meta
                    .resolve("tsx/esm")
                    .slice("file://".length),
                  // "--experimental-strip-types",
                  // "--import",
                  // // this is a chicken and egg problem, the package might not be installed yet, so we can't resolve it :(
                  // import.meta
                  //   .resolve("node-ts-resolver/strip")
                  //   .slice("file://".length),
                ],
              }
            : {}),
        },
      }),
    }),

    defineRecipe(condu, { defaultRules, ignores, importAdditionalConfigFrom }) {
      const execWithTsSupport =
        condu.project.config.globalPeerContext.execWithTsSupport;

      condu.root.generateFile("eslint.config.js", {
        content({ globalRegistry }) {
          const eslintContext: ContextProvidedToEslintConfig = {
            ...pick(condu.project.config, ["conventions", "projects"]),
            ignores: [
              ...globalRegistry.files.map(([filePath]) => filePath),
              ...ignores,
            ],
            defaultRules,
          };
          return /* ts */ `
// note: this file was auto-generated by condu
// if you want to make changes, edit the .config/condu.ts file instead

import { getConfigs } from "@condu-feature/eslint/config.${execWithTsSupport ? "ts" : "js"}";
${importAdditionalConfigFrom ? `import additionalConfigs from "./${CONDU_CONFIG_DIR_NAME}/${path.normalize(importAdditionalConfigFrom)}";` : ""}
const configs = getConfigs(${JSON.stringify(eslintContext, undefined, 2)}${importAdditionalConfigFrom ? ", additionalConfigs" : ""});
export default configs;
`.trimStart();
        },
      });

      condu.root.ensureDependency("eslint");
      condu.root.ensureDependency("eslint-plugin-import-x");
      condu.root.ensureDependency("eslint-plugin-unicorn");
      condu.root.ensureDependency("eslint-import-resolver-typescript");
      condu.root.ensureDependency("@eslint/js");
      condu.root.ensureDependency("@typescript-eslint/parser");
      condu.root.ensureDependency("@typescript-eslint/eslint-plugin");
      condu.root.setDependencyResolutions({
        "@eslint/core": "latest",
      });
      if (execWithTsSupport) {
        condu.root.ensureDependency("node-ts-resolver");
      }

      condu.root.defineTask("eslint", {
        type: "test",
        definition: {
          command: "eslint",
          inputs: ["@group(sources)"],
          ...(execWithTsSupport
            ? // TODO: consider node strip types instead
              {
                env: {
                  NODE_OPTIONS:
                    "--experimental-strip-types --import node-ts-resolver/strip",
                },
              }
            : {}),
        },
      });
    },
  });
