import { defineFeature } from "@repo/core/defineFeature.js";

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
