# Quick Reference for condu

This project is a configuration management library that uses code-based configuration to manage projects (predominantly JavaScript/TypeScript ones).

## Build/Test/Lint Commands

- Build: `pnpm exec moon run :build`
- Typecheck: `pnpm exec moon run :typecheck-typescript` or `pnpm exec tsc --noEmit` (note that it is not possible to typecheck individual packages)
- Lint: `pnpm exec moon run :eslint`
- Code test: `pnpm exec vitest --watch=false`
- Run single test: `pnpm exec vitest --watch=false path/to/file.test.ts`
- Test: `pnpm exec moon run :test` (combines typecheck, eslint, prettier; for now excludes `vitest`)
- Format: `pnpm exec moon run :format-prettier`
- Clean: `pnpm exec moon run :clean`
- Regenerate config files: `pnpm exec condu apply`
- Dry run release: `pnpm exec condu release --dry-run`

## Code Style Guidelines

- TypeScript:
  - Strict mode
  - If a type exists, use it. Never use `any`, for external/unverified inputs use `unknown`.
  - `verbatimModuleSyntax: true`, use `import type` or `import { type X }` whenever possible
  - prefer `satisfies` if possible, avoid casting using `as`
  - when importing from a dependency that exists in the repo, ensure that it is installed in package.json and then run `pnpm i`
  - when importing from an external dependency if it doesn't have types, try to install them via `pnpm i @types/dep` in the correct directory
- Package Manager: pnpm
- monorepo: packages are created in respective directories:
  - `packages/generic` - generic packages that the project might depend on. These should never depend on any non-generic package.
  - `packages/platform` - the core packages related to the `condu` CLI tool
  - `packages/features` - `condu`'s individual features (plugins or extensions)
  - `packages/presets` - condu presets
  - `packages/test` - test packages and packages related to testing
- CLI:
  - uses 'clipanion' for parsing arguments and registering commands
  - `packages/platform/condu/cli.ts`: CLI command are registered
  - `packages/platform/condu/commands`: Actual command implementation
- package.json:
  - add both external and internal dependencies using `pnpm`, never modify the "dependencies" property directly
  - for internal dependencies, always use `workspace:*` as the version, e.g. `pnpm i "@condu-test/utils@workspace:*" -D`
  - external `devDependencies` that are reused for building/testing of many packages should be added to the workspace root of the monorepo, not to the individual package. For example, `vitest` should never be listed in package.json of individual packages.
  - scripts: Do not modify package.json scripts, global build/test/lint commands listed above can already do this for all and specific packages
  - never define `main`, `exports`, `types` manually, omit these fields, as they are auto-added during publish
- Files: .ts source files, build outputs include .js/.cjs/.cts with maps into the `build` dir
- Configuration management: project dog-foods itself as the configuration manager, so all config files for all tools are managed inside of `.config` and never committed to git. Specifically, `.config/condu.ts` configures things like TypeScript, eslint, pnpm, Github Action workflows, etc. Running `pnpm exec condu apply` re-generates config files based on the config.
- Project management: the project keeps track of TODOs and remaining work to be done in `TODO.md`
- Always spell `condu` lowercase
- Code:
  - Formatting: 2 space indentation, 80 char line limit
  - Naming: camelCase for variables/functions/filenames, PascalCase for classes/types
  - Imports: ESM style, include `.js` extension even when importing `.ts` files, use package name for importing from internal monorepo packages
  - Node Builtins: use the `node:` prefix when importing, e.g. `node:fs` instead of `fs`.
  - Prefer nullish coalescing `??` operator instead of `||` when applicable
  - Error Handling: Use Result types or async/await with try/catch
  - Source files: Place them directly in the package's folder, without an additional `src` subdirectory
  - Prefer `undefined` over `null` (e.g. `JSON.stringify(x, undefined, 2)`)
  - Use `??=` operator when appropriate
  - When writing functions, prefer a single destructured object as the only argument (`fn({opt1, opt2})`). In some cases `fn(requiredArgument, {opt1, opt2})` signature is acceptable. Do *NOT* create functions with >3 arguments.
  - Use latest ECMAScript 2025 features (esnext) including all stage 4 TC39 proposal up to 2025, like `Symbol.dispose`, `using`, etc.
- key places in the repo:
  - `packages/platform/condu/cli.ts`: CLI command are registered
  - `packages/platform/condu/commands`: Actual command implementation
  - `packages/platform/condu/commands/apply/*`: everything related to `apply`ing the features' recipes - generating and modifying files, adding dependencies, etc.
  - `packages/platform/condu/commands/apply/conduApiTypes.ts`: condu's feature API capabilities
  - when calling functions, prefer inlining arguments `fn({ someArg: true })` over separate definition `const opts = {someArg: true}; fn(opts)` to avoid having to define the type of `opts` separately
  - When creating codegen utilities that includes code as a string, use a template literal and prefix it with a comment indicating language, e.g.: `/* ts */ some.code('here')`
- Refer to `README.md` and update it when necessary

When building or editing condu features:

- use `modifyPackageJson` or `modifyPublishedPackageJson` based on the type of edit to package.json file, never `modifyGeneratedFile`.
- to generate TypeScript types from JSON schemas: add schema URL to `packages/platform/schema-types/utils/schemas.ts`, then run `pnpm run updateSchemas`
- when modifying user-editable comment-JSON files, use `assign` from `comment-json` to preserve comments and formatting
- use peer context to share configuration between features; declare module extension for type safety

## Actions to take after modifying the project

- regenerate config files (`condu apply`)
- run typecheck, lint, tests, build, and dry-run release to ensure everything is working correctly
- run format to ensure code is properly formatted
- stage the changes in git & commit, using Conventional Commits for semantic commit message. Include an expanded message describing the change and the prompt used to create it.

## Actions that should never be taken

- *NEVER* modify `CHANGELOG.md` manually, it is autogenerated from commits by `release-please` during the release process.
- *NEVER* modify `package.json` files manually, `cd` to the target package directory, and use `pnpm` to add dependencies or run commands. Additional fields like `main`, `exports`, `types` are auto-generated during the publish process.
