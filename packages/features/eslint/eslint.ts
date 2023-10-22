import { defineFeature } from "@repo/core/defineFeature.js";
// import { nonEmpty } from "@repo/core/utils/filter.js";

export const eslint = ({}: {} = {}) =>
  defineFeature({
    name: "eslint",
    actionFn: (config, state) => ({
      files: [
        {
          path: "eslint.config.js",
          content: `import config from '@repo-feature/eslint/config.${
            config.project.manifest.name === "toolchain" ? "ts" : "js"
          }';
export default config;`,
        },
      ],
      devDependencies: [
        "eslint",
        "eslint-plugin-import@npm:eslint-plugin-i@latest",
        "eslint-plugin-unicorn",
        "eslint-import-resolver-typescript",
        "@typescript-eslint/parser",
        "@typescript-eslint/eslint-plugin",
      ],
    }),
  });
