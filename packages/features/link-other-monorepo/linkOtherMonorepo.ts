import {
  createPackageOverridesForLinking,
  type LinkingOptions,
} from "@condu/core/utils/createPackageOverridesForLinking.js";
import { defineFeature } from "condu/defineFeature.js";

export const linkOtherMonorepo = ({
  links,
}: {
  links: (
    | Omit<LinkingOptions, "linkedProjectDir" | "targetPackageDir">
    | Pick<Required<LinkingOptions>, "linkedProjectDir">
  )[];
}) =>
  defineFeature({
    name: "link-other-monorepo",
    actionFn: async (config, state) => {
      const resolutions = Object.fromEntries(
        (
          await Promise.all(
            links.map((linkDef) =>
              createPackageOverridesForLinking({
                ...linkDef,
                targetPackageDir: config.project.absPath,
              }),
            ),
          )
        ).flat(1),
      );
      return {
        effects: [{ resolutions }],
      };
    },
  });
