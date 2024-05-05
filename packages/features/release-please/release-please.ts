import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";
import { schemas } from "@condu/schema-types/utils/schemas.js";
import type {
  ReleaserConfigOptions,
  default as ReleasePleaseConfig,
} from "@condu/schema-types/schemas/releasePleaseConfig.gen.js";

export const releasePlease = ({}: {} = {}) =>
  defineFeature({
    name: "release-please",
    actionFn: async (config, state) => {
      const isInternalCondu = config.project.manifest.name === CORE_NAME;
      const packages = (await config.project.getWorkspacePackages()).filter(
        ({ manifest }) => !manifest.private,
      );
      const releaserConfigPackages = Object.fromEntries(
        packages.map(({ manifest, dir }) => [
          dir,
          {
            "release-type": "node",
            component: manifest.name,
          } satisfies ReleaserConfigOptions,
        ]),
      );
      const defaultManifest = Object.fromEntries(
        packages.map(({ dir }) => [dir, "1.0.0"]),
      );

      return {
        effects: [
          {
            files: [
              {
                path: ".config/release-please/config.json",
                type: "committed",
                content: {
                  $schema: schemas.releasePleaseConfig,
                  "tag-separator": "@",
                  "include-v-in-tag": false,
                  "bootstrap-sha": "487dfcb00e029d0c8f483f41d0de82a992885f3d",
                  packages: releaserConfigPackages,
                  plugins: [
                    {
                      type: "node-workspace",
                      updatePeerDependencies: true,
                    },
                  ],
                } satisfies ReleasePleaseConfig,
              },
              {
                path: ".config/release-please/manifest.json",
                type: "committed",
                // ensure the file exists
                content: async (f) => ({
                  ...defaultManifest,
                  ...(await f.getExistingContentAndMarkAsUserEditable({})),
                }),
              },
            ],
            devDependencies: ["release-please"],
          },
        ],
      };
    },
  });
