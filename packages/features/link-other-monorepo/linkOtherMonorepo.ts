import {
  createPackageOverridesForLinking,
  type LinkingOptions,
} from "@condu/core/utils/createPackageOverridesForLinking.js";
import { defineFeature } from "condu/defineFeature.js";

interface LinkingConfig {
  links: (
    | Omit<LinkingOptions, "linkedProjectDir" | "targetPackageDir">
    | Pick<Required<LinkingOptions>, "linkedProjectDir">
  )[];
}

declare module "@condu/types/extendable.js" {
  interface PeerContext {
    linkOtherMonorepo: LinkingConfig;
  }
}

export const linkOtherMonorepo = (opts: LinkingConfig) =>
  defineFeature("linkOtherMonorepo", {
    initialPeerContext: opts,

    async defineRecipe(condu, { links }) {
      const resolutions = Object.fromEntries(
        (
          await Promise.all(
            links.map((linkDef) =>
              createPackageOverridesForLinking({
                ...linkDef,
                targetPackageDir: condu.project.absPath,
              }),
            ),
          )
        ).flat(1),
      );

      condu.root.setDependencyResolutions(resolutions);
    },
  });
