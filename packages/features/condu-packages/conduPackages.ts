import { defineFeature, CONDU_WORKSPACE_PACKAGE_NAME, CORE_NAME } from "condu";

export const conduPackages = (opts: {} = {}) =>
  defineFeature("condu-packages", {
    defineRecipe: (condu) => {
      const isInternalCondu =
        condu.project.manifest.name === CONDU_WORKSPACE_PACKAGE_NAME;

      condu.root.defineTask("release", {
        type: "publish",
        definition: {
          // TODO: add configurability/arguments
          command: `${
            isInternalCondu
              ? `${condu.project.config.node.packageManager.name} run `
              : ""
          }${CORE_NAME} release`,
        },
      });
    },
  });
