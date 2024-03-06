import { defineFeature } from "@condu/core/defineFeature.js";

export const vitest = ({}: {} = {}) =>
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
