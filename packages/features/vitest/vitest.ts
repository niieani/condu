import { defineFeature } from "condu/defineFeature.js";

export const vitest = (opts: {} = {}) =>
  defineFeature({
    name: "vitest",
    actionFn: (config, state) => ({
      effects: [
        {
          devDependencies: ["vitest"],
          files: [],
        },
      ],
    }),
  });
