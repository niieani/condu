# CLAUDE.md - Quick Reference for condu

This project is a configuration management library that uses code-based configuration to manage projects (predominantly JavaScript/TypeScript ones).

## Build/Test/Lint Commands

- Build: `pnpm exec moon run :build`
- Typecheck: `pnpm exec moon run :typecheck-typescript` or `pnpm exec tsc --noEmit`
- Lint: `pnpm exec moon run :eslint`
- Code test: `pnpm exec vitest`
- Run single test: `pnpm exec vitest path/to/file.test.ts`
- Test: `pnpm exec moon run :test` (combines typecheck, eslint, prettier; for now excludes `vitest`)
- Format: `pnpm exec moon run :format-prettier`
- Clean: `pnpm exec moon run :clean`
- Regenerate config files: `pnpm exec condu apply`

## Code Style Guidelines

- Package Manager: pnpm
- monorepo: packages are created in respective directories:
  - `packages/generic` - generic packages that are in this repo as they're dependencies of the project, but don't depend on the project
  - `packages/platform` - the core packages related to the `condu` CLI tool
  - `packages/features` - `condu`'s individual features (plugins or extensions)
  - `packages/presets` - condu presets
  - `packages/test` - test packages and packages related to testing
- TypeScript: Strict mode, prefer undefined over null
- Dependencies: when one package requires another as an internal dependency, use `workspace:*` as its version, then run `pnpm i` to ensure it resolves
- Files: .ts source files, build outputs include .js/.cjs/.cts with maps into the `build` dir
- Configuration management: project dog-foods itself as the configuration manager, so all config files for all tools are managed inside of `.config` and never committed to git. Specifically, `.config/condu.ts` configures things like TypeScript, eslint, pnpm, Github Action workflows, etc. Running `pnpm exec condu apply` re-generates config files based on the config.
- Project management: the project keeps track of TODOs and remaining work to be done in `TODO.md`
- Always spell `condu` lowercase
- Code:
  - Formatting: 2 space indentation, 80 char line limit
  - Naming: camelCase for variables/functions, PascalCase for classes/types
  - Imports: ESM style, include `.js` extension even when importing `.ts` files, use package name for importing from internal monorepo packages
  - Prefer nullish coalescing `??` operator when safe to use instead of `||`
  - Error Handling: Use Result types or async/await with try/catch
- key places in the repo:
  - `packages/platform/condu/cli.ts`: CLI command are registered
  - `packages/platform/condu/commands`: Actual command implementation
  - `packages/platform/condu/commands/apply/*`: everything related to `apply`ing the features' recipes - generating and modifying files, adding dependencies, etc.
- Documentation in `DOCUMENTATION.md`
