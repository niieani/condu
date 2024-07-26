import type { Linter, ESLint } from "eslint";
import importPlugin from "eslint-plugin-import-x";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser, {
  type ParserOptions,
} from "@typescript-eslint/parser";
import noExtraneousDependencies from "./rules/no-extraneous-dependencies.cjs";
import unicornPlugin from "eslint-plugin-unicorn";

export default [
  {
    // https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
    // TODO: ignore from config
    ignores: [
      "**/*.{gen,generated}.{js,jsx,ts,tsx,mjs}",
      "build/**",
      ".moon/**",
      ".yarn/**",
    ],
  },
  {
    // TODO: use files from config
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      import: {
        ...importPlugin,
        rules: {
          ...importPlugin.rules,
          "no-extraneous-dependencies": noExtraneousDependencies,
        },
      },
      unicorn: unicornPlugin,
      "@typescript-eslint": typescriptEslint as unknown as ESLint.Plugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: typescriptParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      } satisfies ParserOptions,
      // globals: {
      //   ...globals.browser,
      // },
    },
    rules: {
      // turn on errors for missing imports
      "import/no-unresolved": "error",
      "import/no-relative-packages": "error",
      "import/no-duplicates": ["error", { "prefer-inline": true }],
      "import/no-extraneous-dependencies": [
        "error",
        // TODO: make dynamic based on conventions
        {
          devDependencies: ["**/*.test.{js,jsx,ts,tsx}", "**/.config/**"],
          autoFixVersionMapping: [
            ["@condu/", "workspace:^"],
            ["@condu-feature/", "workspace:^"],
            ["condu", "workspace:^"],
          ],
          autoFixFallback: "^",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
      // for compatibility with deno, we want node: prefixes
      // https://docs.deno.com/runtime/manual/node/node_specifiers
      "unicorn/prefer-node-protocol": "error",

      // others:
      "unicorn/prefer-regexp-test": "error",
      "unicorn/better-regex": "error",
      "unicorn/new-for-builtins": "error",
      "unicorn/consistent-function-scoping": "error",
      "unicorn/custom-error-definition": "error",
      "unicorn/escape-case": "error",

      // TODO: opinionated rules (these should not be defaults)
      "unicorn/no-null": "error",
      "unicorn/no-typeof-undefined": "error",
      "unicorn/filename-case": [
        "error",
        {
          cases: {
            camelCase: true,
            pascalCase: true,
            kebabCase: true,
          },
          ignore: [`\\.d\\.ts$`],
        },
      ],
      "unicorn/no-abusive-eslint-disable": "error",
      "unicorn/no-array-for-each": "error",
      "unicorn/no-array-method-this-argument": "error",
      "unicorn/no-document-cookie": "error",
      "unicorn/no-for-loop": "error",
      "unicorn/no-hex-escape": "error",
      "unicorn/no-instanceof-array": "error",
      "unicorn/no-invalid-remove-event-listener": "error",
      // TODO: review the rest https://github.com/sindresorhus/eslint-plugin-unicorn/tree/main?tab=readme-ov-file
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`

          // Choose from one of the "project" configs below or omit to use <root>/tsconfig.json by default

          // use <root>/path/to/folder/tsconfig.json
          // project: "path/to/folder",

          // Multiple tsconfigs (Useful for monorepos)

          // use a glob pattern
          // project: "packages/*/tsconfig.json",

          // // use an array
          // project: [
          //   "packages/module-a/tsconfig.json",
          //   "packages/module-b/tsconfig.json",
          // ],

          // // use an array of glob patterns
          // project: [
          //   "packages/*/tsconfig.json",
          //   "other-packages/*/tsconfig.json",
          // ],
        },
      },
    },
  },
] satisfies Linter.FlatConfig[];
