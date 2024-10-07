import type { Linter, ESLint } from "eslint";
import js from "@eslint/js";
import importPlugin from "eslint-plugin-import-x";
import globals from "globals";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import * as typescriptParser from "@typescript-eslint/parser";
import type { ParserOptions } from "@typescript-eslint/parser";
import noExtraneousDependencies, {
  type AutoFixSpec,
  type Options,
} from "./rules/no-extraneous-dependencies.js";
import unicornPlugin from "eslint-plugin-unicorn";
import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import type { ContextProvidedToEslintConfig } from "./types.js";

export const getConfigs = (
  {
    conventions,
    projects = [],
    ignores = [],
    defaultRules,
    ...rest
  }: ContextProvidedToEslintConfig,
  additionalConfigsInput?:
    | Linter.Config[]
    | ((context: ContextProvidedToEslintConfig) => Linter.Config[]),
): Linter.Config[] => {
  const additionalConfigs = Array.isArray(additionalConfigsInput)
    ? additionalConfigsInput
    : typeof additionalConfigsInput === "function"
      ? additionalConfigsInput({
          conventions,
          projects,
          ignores,
          defaultRules,
          ...rest,
        })
      : [];
  const { generatedSourceFileNameSuffixes, sourceExtensions, buildDir } =
    conventions;
  const packageNameConventions = projects.filter(
    (p): p is { nameConvention: string; parentPath: string } =>
      typeof p === "object" &&
      "parentPath" in p &&
      p.nameConvention !== undefined,
  );
  const executableExtensionsList = conventions.sourceExtensions
    .filter((ext) => ext !== "json")
    .join(",");

  const globalIgnores = [
    `**/*{${generatedSourceFileNameSuffixes.join(",")}}.{${sourceExtensions.join(",")}}`,
    `${buildDir}/**`,
    `**/${CONDU_CONFIG_DIR_NAME}/**`,
    ".moon/**",
    ".yarn/**",
    "integration-tests/**",
    ...ignores,
  ];

  const importXPlugin = importPlugin.flatConfigs.recommended.plugins?.[
    "import-x"
  ] as ESLint.Plugin;

  const autoFixVersionMapping: AutoFixSpec = [
    ...packageNameConventions.map(
      ({ nameConvention }) => [nameConvention, "workspace:^"] as const,
    ),
    // ["vitest", "^", "devDependencies"],
  ];

  return [
    {
      // https://eslint.org/docs/latest/use/configure/configuration-files#globally-ignoring-files-with-ignores
      ignores: globalIgnores,
    },
    js.configs.recommended,
    {
      ...importPlugin.flatConfigs.recommended,
      ...importPlugin.flatConfigs.typescript,
      // TODO: use files from config
      files: [`**/*.{${executableExtensionsList}}`],
      plugins: {
        "import-x": {
          ...importXPlugin,
          rules: {
            ...importXPlugin.rules,
            // importPluginTypeScript,
            // ...(importPluginTypeScript.rules as unknown as ESLint.Plugin["rules"]),
            // override the no-extraneous-dependencies rule with our custom version:
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
            // TODO: parametrize based on config
            jsx: true,
          },
        } satisfies ParserOptions,
        // TODO: globals should be configurable
        globals: {
          ...globals.es2025,
          ...globals.node,
        },
      },
      rules: {
        "no-unused-vars": "off",
        ...importPlugin.flatConfigs.recommended.rules,
        ...importPlugin.flatConfigs.typescript.rules,
        // turn on errors for missing imports
        "import-x/no-unresolved": [
          "error",
          {
            // ignore: ["^bun:"]
          },
        ],
        "import-x/no-relative-packages": "error",
        "import-x/no-duplicates": ["error", { "prefer-inline": true }],
        "import-x/no-extraneous-dependencies": [
          "error",
          // TODO: make dynamic based on conventions
          {
            devDependencies: [
              `**/*.test.{${executableExtensionsList}}`,
              "**/.config/**",
              `**/*.config.{${executableExtensionsList}}`,
            ],
            autoFixVersionMapping,
            whitelist: ["vitest"],
            autoFixFallback: "^",
          } satisfies Options,
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

        ...defaultRules,
      },
      settings: {
        ...importPlugin.flatConfigs.recommended.settings,
        ...importPlugin.flatConfigs.typescript.settings,
        // "import-x/parsers": {
        //   "@typescript-eslint/parser": [".ts", ".tsx"],
        // },
        "import-x/resolver": {
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
    ...additionalConfigs,
  ] satisfies Linter.Config[];
};
