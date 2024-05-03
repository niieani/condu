## MVP / alpha TODO List

- [x] moonrepo integration
- [x] typescript
- [x] typescript references
- [x] scaffolding new packages in monorepo (Create package command)
- [x] GitHub Actions
- [x] automatically add missing workspace dependencies to package.json
- [x] Individual Package overrides
- [x] yarn constraints
- [x] TS building for release - all files can be in the
  - prior art:
    - [tsconfig-to-dual-package](https://github.com/azu/tsconfig-to-dual-package#how-it-works)
    - [tsc-multi](https://github.com/tommy351/tsc-multi)
  - [x] make a script to copy all source files into the dist folder, except configs
  - [x] might need to settle for .cjs + .js for now if we want to use tsc --build for default esm build
    - this is also the future, since cjs is going away
  - [x] for main pass: simply build project with tsc
    - [x] post-build need to update .map files to have the correct paths, as sourceMappingURL is incorrect and needs to be corrected to use the adjecent .map file
  - [x] for other pass:
    - [x] build as ESM
    - [x] all the in-project references (relative or imports from existing monorepo ids) can be auto renamed to .mts
      - [x] make a list of all files as if imported using package name (e.g. '@thing/package/file.js')
      - [x] for each package, make additionally a list of all files
      - [x] for each file in each package, make a list of possible relative paths for other files (e.g. '../file.js')
      - [x] regexp replace all instances of the above with the '.mjs' extension
      - [x] since the extension is mandatory, failure is very unlikely. even if the filename is common, like './calc.js', it is unlikely this string would be used for anything other than an import from/export from
  - [x] adjust the "sources" in the .map files
  - [x] output will have: .ts, .js, .js.map, .d.ts, .mjs, .d.mts, .mjs.map + all other files
  - [x] solve source map references, still relative to the root, instead of always next to the file
  - [x] verify that `const x = <x>() => {}` works, because TS thinks it's a JSX tag, [which is supported in mts/cts by default](https://github.com/microsoft/TypeScript/issues/44442))
  - important [thread about this](https://github.com/microsoft/TypeScript/issues/49462)
- [x] figure out webpack merging / a custom config for this repo specifically?
- [x] added hooking for package.json generation, use it in the library feature to set the correct entry points
- [x] trim the "dependencies" in published package.json based on the config
- [x] auto-run 'apply' after package changes
- [x] pre-release
  - [x] copy/generate LICENSE to each package
  - [x] set correct package.json fields
    - [x] generate correct entry points (like https://github.com/isaacs/tshy)
    - [x] conventional entry point:
      - use `index.ts`, `main.ts` or `${packageName}.ts` if they exist (set camelCase or kebab-case in "conventions" - use it also for file name linting defaults)
- [x] vscode auto-ignore generated files
- [x] use https://www.npmjs.com/package/comment-json to keep the comments and only amend input if it exists
- [x] fully fleshed out build step on CI (incl. prepare dependency)
- [ ] pnpm feature
- [ ] fix the CLI command displayed (instead of "bun main.bundle.js") + add help
- [ ] better support for making '@condu/core' a peerDependency
- [ ] should we collocate per-package build config in the respective packages, or keep them global?
  - [ ] if yes, then how do we do it? `.config` folder per package?
  - [ ] make decision: where do we keep local config files? are they centrally managed? do we use config identifiers in folders names to nest configs?
- [ ] CI & semantic-release or [Auto](https://github.com/intuit/auto)
- [ ] some basic integration tests that use the built packages
  - what do I actually want to test here? ooh the release process!!!
  - inspiration: [zx-bulk-release](https://github.com/semrel-extra/zx-bulk-release/blob/b2a22a483a810be63e059bcbcb1db08289729809/src/test/js/integration.test.js)
- [ ] "clean"/"default" feature? before build, we need to run apply and clean 'build' dir
- [ ] add an 'init' command to create a new repo with config (or update existing one) from scratch
- [ ] vitest feature
- [ ] CI build and test using moon

- alpha shippable state -

- similar tool: https://packemon.dev/
- alternatives to consider for dual building from TSC (unfortunately uses babel):

  - [duel](https://github.com/knightedcodemonkey/duel)
  - [specifier updating](https://github.com/knightedcodemonkey/specifier)

## Bumping versions / releases

Flow would have to be:

- use separate tag for latest release: `latest` (or `prerelease`)
  - derived from `main` + applied all versions (+copied over CHANGELOGs) based on `latest` in all package.jsons
- apply version bump with lerna
- remove 'build' from .gitignore
- build/prepare + commit + tag/release
- push as `latest` tag

Actually, the better CI flow:

- apply versions to the `package.json`s
  - use getLatestTaggedVersion from [zx-bulk-release](https://github.com/semrel-extra/zx-bulk-release/blob/b2a22a483a810be63e059bcbcb1db08289729809/src/main/js/processor/meta.js#L196-L210)
- build/prepare
- remove 'build' from .gitignore (`condu apply --publish` ?)
- `git add build` & commit
- run auto shipit -- to bump versions and release
- ensure CI has concurrency 1 per branch/sha

Notes:
use a test NPM registry to test ([verdaccio](https://github.com/semrel-extra/zx-bulk-release/blob/b2a22a483a810be63e059bcbcb1db08289729809/verdaccio.config.yaml)).
make sure that lerna has syncDistVersion enabled to also version the built packages

Question: how does `auto` know what tags the PR had that was just merged?

- [changesets](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
- [multi-semantic-release](https://github.com/anolilab/multi-semantic-release)
- [semantic-release-monorepo](https://github.com/pmowrer/semantic-release-monorepo)
- [nx plugin](https://github.com/jscutlery/semver#jscutlerysemver)
- [beachball](https://microsoft.github.io/beachball/)
- [release-it](https://github.com/release-it/release-it)
  - not great for monorepos, needs workspaces defined in order
- [release-please](https://github.com/googleapis/release-please)
  - many languages support which is nice
  - looks like a decent option
  - can combine with publishing from lerna ([from-package](https://lerna.js.org/docs/features/version-and-publish#from-package)) for publishing
  - can support prerelease version strategy
  - doesn't do any NPM releasing itself, can use Lerna
- [semantic-release-yarn](https://github.com/hongaar/semantic-release-yarn)
- [zx-bulk-release](https://github.com/semrel-extra/zx-bulk-release/)
- [monodeploy](https://github.com/tophat/monodeploy)

Maybe just stick to semantic-release for now so I'm unblocked for other projects??

### Ideas for next steps

Ugh this is terrible.

Options:

1. instead of using a top-level `build` folder that mimics the structure, could use a subdirectory like `.release`

- not just for `dist` files, but the entire package with package.json, and other files copied
- this also potentially simplifies the issue of caching the build artifacts, since they're descendants of the package
- this might make it possible to use semantic release with `pkgRoot` option

2. modify/validate the monorepo semantic release to utilize [`pkgRoot`](https://github.com/semantic-release/npm#options)
3. figure out logic for injecting the correct version into the `package.json`s, then use `lerna version` to bump the versions
4. store the versions in the package.jsons committed to the repo
5. use changesets - with [`publishConfig.directory`](https://github.com/changesets/changesets/blob/0bf89b3709e3e3df6ed5dbb8ece0fb000a55d5f4/packages/cli/src/commands/publish/publishPackages.ts#L133C34-L135) - pnpm directory [seems to](https://pnpm.io/package_json#publishconfigdirectory) should also work even when not a subdirectory
   - I don't love changesets, because they're manual disjointed from commits (duplication)
   - but they could work with reasonable low effort and seem to be pretty stable...

### Strategy

- let's try release-please, and see if it can add 'version' to the package.jsons that don't have it
  - if not, I could accept keeping the version baked in, since it creates a PR to do the release anyway - it bumps the version in the PR
- if not, let's try semantic-release with `pkgRoot` option
  - might need to move files from `build` to `.dist` or sth to make it work

## Later:

- [ ] commitlint + husky for linting commit messages
- [ ] consider swapping pnpm internals for https://www.npmjs.com/package/@manypkg/get-packages
- [ ] "recommended" preset of features that always opts you in to the latest and greatest of the JS ecosystem
- [ ] website
  - inspiration: [tailwind](https://tailwindcss.com/) - make configs disappear and appear in a mock vscode/github UI?
- [ ] easy way to quickly create a new Github repo, already preconfigured, with initial commit, etc.
- [ ] add validation on CI to make sure no uncommitted files are left dangling after `condu apply` / `yarn` on CI
- [ ] public library of patches to common dependencies (e.g. [graceful-fs](https://github.com/isaacs/node-graceful-fs/issues/245#issuecomment-2037699522))
- [ ] add validation for feature dependencies (e.g. "auto" feature depends on "lerna")
  - maybe not dependencies, but see below - contributed state?
- [ ] clean up or write to console a list of devDependencies that should be removed once a feature is removed/disabled
- [ ] command to analyze codebase for never used dependencies/devDependencies and auto-remove them
- [ ] eslint additions
  - [ ] ban `export let`
- [ ] support rescript
- [ ] add shared state for features (features can contribute to it and build on top of each other's state)
  - perhaps features contribute individual settings, like in vscode - providing a required schema - that way we could validate that the dependent state is valid
- [ ] basic any-config feature:
  - [ ] bare minimum: just copy files from .config to the root and add them to .gitignore, or
  - [ ] symlink all non-js files from .config to the root (e.g. for .env)
  - [ ] create dummy root .cjs files that require or .js/.mjs files that import their equivalent from .config
- [ ] during 'apply', auto-transpile .ts config files into .js based on extension? (e.g. webpack.config.source.cts -> webpack.config.gen.cjs)
- [ ] usability: how can we ensure that apply has been run before anything else?
  - consider modifying package.json to add "preXYZ" to each script, that auto-runs apply
    - maybe not the best idea, since user might be using pre-scripts already, or using scripts in other scripts (which would cause pre to be apply multiple times)
    - perhaps a better way is to utilize the script runner dependencies
- [ ] autodetect when certain tools are configured, but without a condu plugin, and suggest installation
  - yarn - important because of the plugin
  - others: typescript, gitignore, etc.
- [ ] in apply: auto-create package.json when missing, but matches one of the conventions
- [ ] automatically use features that are installed as devDependencies using the default parameters (maybe a flag can turn this off?)
- [ ] multi-repo mode
  - best of both worlds - monorepo for development and keeping tools in sync, single-repo management benefits (separate issues, PRs, etc.)
    - see previous art: [meta](https://github.com/mateodelnorte/meta)
  - orchestrate multiple repos with a parent configuration repo
  - support GitHub: automatically create a repo when creating a new package
    - [ ] autoconfigure repo based on settings (e.g. enable/disable wiki, issues, etc.)
      - either via package.json or repo.toml or something?
    - [ ] sync Github settings on apply-remote command? or something like that?
    - [ ] for CI: checkout the parent repo to run selected build/release?
    - [ ] option to automatically fetch all non-forked github repositories of a user?
  - could unify all of my repositories to make sure all of them are kept up-to-date
  - when cloning only a single repo, it needs to be able to bootstrap itself
    - maybe a command which will clone the parent repo (or use a global clone based on ENV variable) to make parent repo tooling available and generate config files only for that specific repo?
  - the managing repo doesn't contains submodules or list (for privacy)
  - more basic, but good references: https://manicli.com/project-background
- [ ] error reporting API for features
- [ ] transpile config files from .config to root (to avoid having to create workarounds loading .ts files)
- [ ] unify/clarify naming around projects/workspaces/packages/workspace-root/etc
- [ ] allow setting default TypeScript extension: '.ts', '.cts', '.mts', '.js' (for building in TSDoc mode), as well as the default extension in imports: 'source' ('.ts') or 'output' ('.js')
- [ ] allow using one of the large scaffolds (epic-stack, electronforge, ignite red)
- [ ] consider [eslint-cjs-to-esm](https://github.com/azu/eslint-cjs-to-esm)
- [ ] for library-bundle:
  - [ ] option to bundle node_modules or not (with exceptions)
  - [ ] automatically remove the bundled modules from the built package.json, and maybe add them to optionalPeerDependencies?
  - [ ] perhaps the bundled package is published separately? e.g. under a package.bundle name? maybe this is overridable?
  - [ ] consider code-splitting by CLI command, to make the initial load faster?
- [ ] explain why it's better to ship unbundled - all transpiled files individually - and when bundling actually can make sense (e.g. for applications - CLI, etc.)
- [ ] 2 modes for running TypeScript that you could toggle between - with workspace references, or single-project
  - small projects don't need the overhead/downsides of workspace references
- [ ] [rollup-plugin-ts](https://github.com/wessberg/rollup-plugin-ts) ?
  - [ ] although, see discussion [here](https://github.com/microsoft/TypeScript/issues/4433), apparently it doesn't support declaration maps for now
- [ ] allow CJS building via SWC (automatically polyfills a bunch of things, and warns on top level await)
- [ ] when running `apply`, cli should clear previously generated files that are no longer needed
- [ ] should there be 2 default modes for TS? one targetting a more relaxed environment (apps), one targetting more strict ESM?
- [ ] clean-up empty directories left after deleting unused configs
- [ ] will Deno work with the ESM output out of the box?
- [ ] what if package jsons were also autogenerated? see [bit](https://blog.bitsrc.io/how-to-easily-manage-dependencies-in-a-js-monorepo-6216bd6621ea)
- [ ] jest
- [ ] Customizable package source directory (so we can skip src in mono repo), when publishing copy src into the publish directory. Hmm will semantic publishing work if we copy sources?
- [ ] State file to track changes made to the repo by the tool, and show diff before applying (for upgrading)
- [ ] Migration tool - should remove files from gitignore from committed files
- [ ] Docs: Great collection of [CLI websites](https://news.ycombinator.com/item?id=26878936) on HN
- [ ] TS: add a pure JavaScript with TSDoc mode
- [ ] adding arbitrary github action files from config (which means generating them from code is possible)
- [ ] config file - store local overrides diffing
  - i.e. if you manually change a YAML/JSON config file, we store the diff in .config, and then when we regenerate the config, we apply the diff on top of it
- [ ] move `@repo/core` dependency listing in features to peerDependencies
- [ ] create package.json's automatically on apply if they don't exist, then run yarn!
- [ ] website
- [ ] Product Hunt release
- [ ] to get good quality TS errors for both .cjs and .mjs, a wild idea would be to just dump the generated .cts files for build, and then remove them after build. maybe this could be done in the memoryFS that's overlaid on top of the real FS, where we use memFS only for the project directory, and the rest is real FS? or better yet, exclude from real FS specifically all the renamed files only. Mocked FS and we just run real `tsc --build` inside of it?
- [ ] write a generic TS helper for records/maps that contain arrays, it's a pain to always have to initialize them. or maybe have an initializer getOrSet or push/add() helper that pre-initializes it for you?

Other ideas:

- use build-time macros to enable generation of config files from JavaScript, essentially enable templating of scripts within condu configuration files

Post-release:

- https://gist.github.com/khalidx/1c670478427cc0691bda00a80208c8cc
