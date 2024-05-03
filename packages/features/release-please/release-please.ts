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
                  packages: {
                    "packages/features/release-please": {
                      "release-type": "node",
                      // "changelog-path": "CHANGELOG.md",
                      // "bump-minor-pre-major": false,
                      // "bump-patch-for-minor-pre-major": false,
                      // draft: false,
                      // prerelease: false,
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
                // ensure the file exists, fallback to {} if it doesn't
                content: (f) => f.getExistingContentAndMarkAsUserEditable({}),
              },
            ],
            devDependencies: ["release-please"],
          },
        ],
      };
    },
  });
