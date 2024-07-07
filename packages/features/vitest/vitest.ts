import { defineFeature } from "condu/defineFeature.js";

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
