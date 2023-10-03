import type { Linter, ESLint } from "eslint";
import importPlugin from "eslint-plugin-import";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser, {
  type ParserOptions,
} from "@typescript-eslint/parser";
import noExtraneousDependencies from "./rules/no-extraneous-dependencies.cjs";

export default [
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
      "@typescript-eslint": typescriptEslint as unknown as ESLint.Plugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: typescriptParser as Linter.ParserModule,
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
          devDependencies: ["**/*.test.js"],
          autoFixVersionMapping: [
            ["@repo/", "workspace:*"],
            ["@repo-feature/", "workspace:*"],
          ],
          autoFixFallback: "=",
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],
      "@typescript-eslint/no-import-type-side-effects": "error",
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
