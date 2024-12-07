import { defineFeature } from "condu/defineFeature.js";

// TODO: support workspace configs https://vitest.dev/guide/workspace
// TODO: create config file
export const vitest = (opts: {} = {}) =>
  defineFeature("vitest", {
    modifyPeerContexts: (project) => ({
      vscode: (current) => ({
        ...current,
        suggestedSettings: {
          ...current.suggestedSettings,
          "vitest.configSearchPatternExclude": `{**/node_modules/**,**/.*/**,**/*.d.ts,**/*.d.cts,**/*.d.mts,**/.config/**,${project.config.conventions.buildDir}/**}`,
        },
      }),
    }),
    defineRecipe(condu, peerContext) {
      condu.root.ensureDependency("vitest");
    },
  });
