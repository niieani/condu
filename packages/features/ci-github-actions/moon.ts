import { defineFeature, getYamlParseAndStringify } from "condu";
import type { GithubWorkflow } from "@condu/schema-types/schemas/githubWorkflow.gen.js";
import type { GithubAction } from "@condu/schema-types/schemas/githubAction.gen.js";

declare module "condu" {
  interface FileNameToSerializedTypeMapping {
    ".github/actions/moon-ci-setup/action.yml": GithubAction;
    ".github/workflows/moon-ci.yml": GithubWorkflow;
  }
}

// TODO: maybe moonCi feature should just add a step to .github/actions/ci-setup/action.yml ?
// then the Github Actions CI pulls those commands in
export const moonCi = (opts: {} = {}) =>
  defineFeature("moonCi", {
    defineRecipe(condu) {
      const config = condu.project.config;
      const packageManager = config.node.packageManager.name;
      condu.root.generateFile(".github/actions/moon-ci-setup/action.yml", {
        ...getYamlParseAndStringify<GithubAction>(),
        attributes: { gitignore: false },
        content: {
          name: "Moon CI Setup",
          description: "Setup the environment for Moon CI",
          inputs: {
            "registry-url": {
              description: "The NPM registry URL",
              required: false,
              default:
                config.publish?.registry ?? "https://registry.npmjs.org/",
            },
          },
          runs: {
            using: "composite",
            steps: [
              // {
              //   uses: "actions/checkout@v4",
              //   // 0 indicates all history for all branches and tags:
              //   with: { "fetch-depth": 0 },
              // },
              // TODO: use pnpm action if pnpm is the package manager
              ...(packageManager !== "npm" && packageManager !== "bun"
                ? [{ run: `corepack enable`, shell: "bash" }]
                : []),
              {
                uses: "actions/setup-node@v4",
                with: {
                  "node-version-file": "package.json",
                  // "node-version": config.node.version,
                  cache: packageManager === "bun" ? "" : packageManager,
                  "registry-url": "${{ inputs.registry-url }}",
                },
              },
              { uses: "oven-sh/setup-bun@v2" },
              {
                // for pnpm & bun: install --frozen-lockfile
                // for yarn: install --immutable
                // for npm: npm ci
                run: `${packageManager} ${
                  packageManager === "yarn"
                    ? "install --immutable"
                    : packageManager === "npm"
                      ? "ci"
                      : "install --frozen-lockfile"
                }`,
                shell: "bash",
              },
              {
                run: `./node_modules/.bin/moon ci :build`,
                shell: "bash",
                env: { MOON_TOOLCHAIN_FORCE_GLOBALS: "true" },
              },
            ],
          },
        },
      });

      condu.root.generateFile(".github/workflows/moon-ci.yml", {
        ...getYamlParseAndStringify<GithubWorkflow>(),
        attributes: { gitignore: false },
        content: {
          name: "Moon CI",
          on: {
            push: { branches: [config.git.defaultBranch] },
            pull_request: {},
          },
          env: {
            GIT_DEFAULT_BRANCH: "${{ github.event.repository.default_branch }}",
          },
          jobs: {
            ci: {
              name: "Moon CI",
              "runs-on": "ubuntu-latest",
              env: { MOON_TOOLCHAIN_FORCE_GLOBALS: "true" },
              steps: [
                {
                  uses: "actions/checkout@v4",
                  // 0 indicates all history for all branches and tags:
                  with: { "fetch-depth": 0 },
                },
                // TODO: always use the version from main, not the checked out one
                {
                  name: "Moon CI Setup",
                  uses: "./.github/actions/moon-ci-setup",
                },
                {
                  name: "Test",
                  run: `./node_modules/.bin/moon ci :test`,
                  shell: "bash",
                },
              ],
            },
          },
        },
      });
    },
  });
