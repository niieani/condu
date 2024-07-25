import { defineFeature } from "condu/defineFeature.js";
import {
  CONDU_WORKSPACE_PACKAGE_NAME,
  CORE_NAME,
} from "@condu/types/constants.js";

export const conduPackages = ({}: {} = {}) =>
  defineFeature({
    name: "condu",
    actionFn: (config, state) => {
      const isInternalCondu =
        config.project.manifest.name === CONDU_WORKSPACE_PACKAGE_NAME;
      return {
        effects: [
          {
            tasks: [
              {
                type: "publish",
                name: "release",
                definition: {
                  // TODO: add configurability/arguments
                  command: `${
                    isInternalCondu
                      ? `${config.node.packageManager.name} run `
                      : ""
                  }${CORE_NAME} release`,
                },
              },
            ],
          },
        ],
      };
    },
  });
