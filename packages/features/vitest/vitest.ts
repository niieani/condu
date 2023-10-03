import { defineFeature } from "@repo/core/defineFeature.js";

export const vitest = ({}: {} = {}) =>
  defineFeature({
    name: "vitest",
    actionFn: (config, state) => ({
      devDependencies: ["vitest"],
      files: [],
    }),
  });
