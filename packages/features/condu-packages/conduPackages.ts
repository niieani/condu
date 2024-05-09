import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";

export const condu = ({}: {} = {}) =>
  defineFeature({
    name: "condu",
    actionFn: (config, state) => {
      const isInternalCondu = config.project.manifest.name === CORE_NAME;
      return {
        effects: [
          {
            tasks: [
              {
                type: "publish",
                name: "before-release",
                definition: {
                  // TODO: add configurability/arguments
                  command: `${
                    isInternalCondu
                      ? `${config.node.packageManager.name} run `
                      : ""
                  }${CORE_NAME} before-release`,
                },
              },
            ],
          },
        ],
      };
    },
  });
