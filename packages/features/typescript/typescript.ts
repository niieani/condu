import { defineFeature } from "../../platform/core/defineFeature.js";
import type tsconfig from "../../platform/schema-types/schemas/tsconfig.js";

export const typescript = ({ tsconfig }: { tsconfig?: tsconfig } = {}) =>
  defineFeature({
    name: "typescript",
    order: { priority: "beginning" },
    actionFn: (config, state) => ({
      files: [
        {
          path: "tsconfig.json",
          content: JSON.stringify(
            {
              compilerOptions: {
                ...tsconfig?.compilerOptions,
              },
              ...tsconfig,
            } satisfies tsconfig,
            null,
            2,
          ),
        },
      ],
    }),
  });
