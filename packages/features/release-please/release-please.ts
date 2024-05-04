import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";
import { schemas } from "@condu/schema-types/utils/schemas.js";
import type ReleasePleaseConfig from "@condu/schema-types/schemas/releasePleaseConfig.gen.js";

export const releasePlease = ({}: {} = {}) =>
  defineFeature({
    name: "release-please",
    actionFn: (config, state) => {
      const isInternalCondu = config.project.manifest.name === CORE_NAME;
      return {
        effects: [
          {
            files: [
              {
                path: ".config/release-please/config.json",
                type: "committed",
                content: {
                  $schema: schemas.releasePleaseConfig,
                  "bootstrap-sha": "487dfcb00e029d0c8f483f41d0de82a992885f3d",
                  packages: {
                    "packages/features/release-please": {
                      "release-type": "node",
                      // "changelog-path": "CHANGELOG.md",
                      // "bump-minor-pre-major": false,
                      // "bump-patch-for-minor-pre-major": false,
                      // draft: false,
                      // prerelease: false,
                    },
                    "packages/platform/schema-types": {
                      "release-type": "node",
                    },
                    "packages/platform/core": {
                      "release-type": "node",
                    },
                  },
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
                  "packages/features/release-please": "1.0.0",
                  "packages/platform/schema-types": "1.0.0",
                  "packages/platform/core": "1.0.0",
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
