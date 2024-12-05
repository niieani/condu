import { defineFeature } from "condu/defineFeature.js";

export const vitest = (opts: {} = {}) =>
  defineFeature("vitest", {
    defineRecipe(condu, peerContext) {
      condu.root.ensureDependency("vitest");
    },
  });
