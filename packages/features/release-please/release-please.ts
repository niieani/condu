import { defineFeature } from "@condu/core/defineFeature.js";
import { CORE_NAME } from "@condu/core/constants.js";
import { schemas } from "@condu/schema-types/utils/schemas.js";
import type {
  ReleaserConfigOptions,
  default as ReleasePleaseConfig,
} from "@condu/schema-types/schemas/releasePleaseConfig.gen.js";
import type GithubWorkflow from "@condu/schema-types/schemas/githubWorkflow.gen.js";
import type { WorkspacePackage } from "@condu/core/configTypes.js";

export const releasePlease = ({
  selectPackages,
}: {
  selectPackages?: (pkg: WorkspacePackage) => boolean;
} = {}) =>
  defineFeature({
    name: "release-please",
    actionFn: async (config, state) => {
      const isInternalCondu = config.project.manifest.name === CORE_NAME;
      const packages = (await config.project.getWorkspacePackages()).filter(
        (pkg) =>
          !pkg.manifest.private && (!selectPackages || selectPackages(pkg)),
      );
      const releaserConfigPackages = Object.fromEntries(
        packages.map(({ manifest, dir }) => [
          dir,
          {
            "release-type": "node",
            component: manifest.name,
            "initial-version": "1.0.0",
          } satisfies ReleaserConfigOptions,
        ]),
      );
      const defaultManifest = Object.fromEntries(
        packages.map(({ dir }) => [dir, "0.0.0"]),
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
                  "group-pull-request-title-pattern": `chore: release ${config.project.manifest.name}`,
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
              {
                path: ".github/workflows/release-please.yml",
                type: "committed",
                content: {
                  on: {
                    push: { branches: [config.git.defaultBranch] },
                  },
                  permissions: {
                    contents: "write",
                    "pull-requests": "write",
                  },
                  jobs: {
                    "release-please": {
                      "runs-on": "ubuntu-latest",
                      outputs: {
                        releases_created:
                          "${{ steps.release-please.outputs.releases_created }}",
                        paths_released:
                          "${{ steps.release-please.outputs.paths_released }}",
                      },
                      steps: [
                        {
                          id: "release-please",
                          // uses: 'google-github-actions/release-please-action@v4',
                          uses: "niieani/release-please-action@use-fork",
                          with: {
                            "config-file": ".config/release-please/config.json",
                            "manifest-file":
                              ".config/release-please/manifest.json",
                          },
                        },
                      ],
                    },
                    // TODO: the next steps should be NPM publishing with lerna
                    release: {
                      "runs-on": "ubuntu-latest",
                      needs: ["release-please"],
                      if: "${{ needs.release-please.outputs.releases_created == 'true' }}",
                      steps: [
                        // TODO: decouple this reusable workflow
                        { uses: "./.github/workflows/moon-ci.yml" },
                        {
                          run: "./node_modules/.bin/lerna publish from-package --no-git-reset --no-push --yes",
                          env: {
                            NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
                          },
                        },
                        // {
                        //   name: "Upload Release Artifacts",
                        //   run: "gh release upload ${{ steps.release.outputs.tag_name }} ./artifact/some-build-artifact.zip",
                        // },
                      ],
                    },
                  },
                } satisfies GithubWorkflow,
              },
            ],
            devDependencies: ["release-please"],
          },
        ],
      };
    },
  });
