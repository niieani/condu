import { defineFeature } from "condu/defineFeature.js";
import { CORE_NAME, CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import { schemas } from "@condu/schema-types/utils/schemas.js";
import type {
  ReleaserConfigOptions,
  default as ReleasePleaseConfig,
} from "@condu/schema-types/schemas/releasePleaseConfig.gen.js";
import type { GithubWorkflow } from "@condu/schema-types/schemas/githubWorkflow.gen.js";
import type { ConduPackageEntry } from "@condu/types/configTypes.js";

export const releasePlease = ({
  selectPackages,
  initialVersion,
  configOverrides,
}: {
  selectPackages?: (pkg: ConduPackageEntry) => boolean;
  initialVersion?: string;
  configOverrides?: Partial<ReleasePleaseConfig>;
} = {}) =>
  defineFeature({
    name: "release-please",
    actionFn: async (config, state) => {
      const allWorkspacePackages = config.project.workspacePackages;
      const packages = allWorkspacePackages.filter(
        (pkg) =>
          !pkg.manifest.private && (!selectPackages || selectPackages(pkg)),
      );
      const releaserConfigPackages = Object.fromEntries(
        packages.map(({ manifest, relPath: dir }) => [
          dir,
          {
            "release-type": "node",
            component: manifest.name,
            "initial-version":
              initialVersion ??
              (manifest.condu?.initialDevelopment ? "0.0.1" : "1.0.0"),
          } satisfies ReleaserConfigOptions,
        ]),
      );
      const defaultManifest = Object.fromEntries(
        packages.map(({ relPath: dir }) => [dir, "0.0.0"]),
      );

      return {
        effects: [
          {
            files: [
              {
                path: `${CONDU_CONFIG_DIR_NAME}/release-please/config.json`,
                type: "committed",
                content: {
                  $schema: schemas.releasePleaseConfig,
                  "tag-separator": "@",
                  "include-v-in-tag": false,
                  "group-pull-request-title-pattern": `chore: release ${config.project.manifest.name} (\${branch} branch)`,
                  "bump-minor-pre-major": true,
                  "bump-patch-for-minor-pre-major": true,
                  packages: releaserConfigPackages,
                  plugins: [
                    {
                      type: "node-workspace",
                      updatePeerDependencies: true,
                    },
                  ],
                  ...configOverrides,
                } satisfies ReleasePleaseConfig,
              },
              {
                path: `${CONDU_CONFIG_DIR_NAME}/release-please/manifest.json`,
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
                  name: "Release Please",
                  on: {
                    push: { branches: [config.git.defaultBranch] },
                    workflow_dispatch: {
                      inputs: {
                        skipNpmRelease: {
                          description: "Skip NPM release",
                          type: "boolean",
                          required: false,
                          default: false,
                        },
                      },
                    },
                  },
                  env: {
                    GIT_DEFAULT_BRANCH:
                      "${{ github.event.repository.default_branch }}",
                  },
                  permissions: {
                    // allows release creation:
                    contents: "write",
                    // allows PR creation/modification:
                    "pull-requests": "write",
                    // allows NPM release with attestations:
                    attestations: "write",
                  },
                  jobs: {
                    "release-please": {
                      name: "Get packages to release & update release-please PRs",
                      "runs-on": "ubuntu-latest",
                      outputs: {
                        releases_pending:
                          "${{ steps.release-please.outputs.releases_pending }}",
                        paths_to_release:
                          "${{ steps.release-please.outputs.paths_to_release }}",
                      },
                      steps: [
                        {
                          id: "release-please",
                          name: "Release Please: list candidate releases",
                          // uses: 'googleapis/release-please-action@v4',
                          uses: "niieani/release-please-action@condu",
                          with: {
                            "config-file": ".config/release-please/config.json",
                            "manifest-file":
                              ".config/release-please/manifest.json",
                            only: "list-candidate-releases",
                          },
                        },
                        // TODO: only run this if no releases are pending, or after the release step is done
                        {
                          id: "release-please-prs",
                          name: "Release Please: update PRs",
                          // uses: 'googleapis/release-please-action@v4',
                          uses: "niieani/release-please-action@condu",
                          with: {
                            "config-file": ".config/release-please/config.json",
                            "manifest-file":
                              ".config/release-please/manifest.json",
                            only: "update-pull-requests",
                          },
                        },
                      ],
                    },
                    // TODO: the next steps should be NPM publishing with lerna
                    release: {
                      name: "Release packages to NPM",
                      "runs-on": "ubuntu-latest",
                      needs: ["release-please"],
                      if: "${{ needs.release-please.outputs.releases_pending == 'true' }}",
                      steps: [
                        {
                          name: "Git Checkout",
                          uses: "actions/checkout@v4",
                          with: { "fetch-depth": 0 },
                        },
                        // TODO: always use the version from main, not the checked out one
                        {
                          name: "Repository setup",
                          uses: "./.github/actions/moon-ci-setup",
                        },
                        {
                          name: "Release packages to NPM",
                          if: "${{ !inputs.skipNpmRelease }}",
                          run: `${config.node.packageManager.name} run ${CORE_NAME} release --ci --npm-tag=latest ./\${{ join( fromJSON( needs.release-please.outputs.paths_to_release ), ' ./' ) }}`,
                          env: {
                            NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
                          },
                        },
                        //                         {
                        //                           run: `
                        // git config --global user.email "72759630+google-github-actions-bot@users.noreply.github.com"
                        // git config --global user.name "Google GitHub Actions Bot"
                        // git add . && git commit -m "chore: satisfy lerna requirements"
                        // `.trim(),
                        //                         },
                        // {
                        //   run: "./node_modules/.bin/lerna publish from-package --no-git-reset --no-push --yes",
                        //   env: {
                        //     NODE_AUTH_TOKEN: "${{ secrets.NPM_TOKEN }}",
                        //   },
                        // },
                        {
                          name: "Create Github Releases",
                          id: "release-please",
                          // uses: 'googleapis/release-please-action@v4',
                          uses: "niieani/release-please-action@condu",
                          with: {
                            "config-file": ".config/release-please/config.json",
                            "manifest-file":
                              ".config/release-please/manifest.json",
                            only: "create-github-releases",
                          },
                        },
                        // {
                        //   name: "Upload Release Artifacts",
                        //   run: "gh release upload ${{ steps.release-please.outputs.tag_name }} ./artifact/some-build-artifact.zip",
                        // },
                      ],
                    },
                  },
                } satisfies GithubWorkflow,
              },
            ],
          },
        ],
      };
    },
  });
