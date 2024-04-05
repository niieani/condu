import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";

export const condu = ({}: {} = {}) =>
  defineFeature({
    name: "condu",
    actionFn: (config, state) => {
      const workspaceName = config.project.manifest.name;
      return {
        effects: [
          {
            tasks: [
              {
                type: "build",
                name: "prepare-package",
                definition: {
                  // TODO: add configurability/arguments
                  command: `${config.node.packageManager.name} run ${CORE_NAME} before-release`,
                  deps: [`${workspaceName}:tsc-project`],
                },
              },
            ],
          },
        ],
      };
    },
  });
