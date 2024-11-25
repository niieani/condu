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
- [x] CI & semantic-release or [Auto](https://github.com/intuit/auto)
- [x] "clean"/"default" feature? before build, we need to run apply and clean 'build' dir
- [x] add a `condu` package that just wraps `@condu/cli` and adds the build script - this way @condu/cli can exist as its own package
  - [x] make sure the NPM token has permissions to publish both
- [x] fix "Unable to determine the default git branch"
- [x] support defining dependencies for features w/o importing from @condu/core
  - [x] extract that defineFunction into a separate package and keep it external? put it all in 'condu' along with the types? or does that create a circular dependency? maybe re-export the types from 'condu'
- [x] better support for making '@condu/core' a peerDependency
- [x] pnpm feature
- [x] local link/debug mode:
  - [x] link-other-monorepo feature: 'createOverrides' script to pnpm install 'build' as linked
- [x] why is the packageManager not getting set correctly for moon? moon feature seems to try to install yarn
- [x] mark which dependencies are managed by condu, and which are managed by the user (e.g. key in package.json: managedDependencies: { "name": "condu" })
- [x] when creating: don't add author, license by default, as they will be inherited from the workspace during publish, unless overwritten
- [x] fix generated license author
- [x] clean up of devDependencies that should be removed once a feature is removed/disabled
- [x] move to pnpm
- [x] in presets allow configurability/overrides? maybe passthrough all the config objects?
- [x] `condu init` command or a command that could be run with `npx condu init` to
  - [x] add a default config file
  - [x] add a script to package.json "postinstall": "test -f .config/condu.ts && condu apply"
  - [x] optionally create a new folder with git repo if `name` positional parameter is provided
  - [x] a preset package just exports an object, so applying a preset is just merging each of the properties
  - [ ] can be used to apply changes to an existing project, in which case it will infer certain things from the existing project, like the package manager
- [x] ensure `sourceDir` works with publishing
- [x] something is up with resolving
- [x] non-monorepo/single package mode
- [x] prettier
- [x] editorconfig
- [x] eslint customization / extension
  - [x] allow loading .config/eslint.ts (or specify custom filename?)
- [ ] add `inputs` / `implicitInputs`
- [x] update release-please to use google version and update fork with https://github.com/googleapis/release-please-action/pull/1041
- [x] cache file needs to include condu version
- [x] vitest feature
- [x] CI build and test using moon
- [x] a way to ensure that certain dependencies/devDependencies/peerDependencies are set, or at least copy them over from template
- [ ] add `repository`, `homepage` (fallback to repo) and `author`, `license` and `contributors` info to published package.json based on the root package.json
- [x] re-evaluate the API for writing features - there's a lot of nesting, can it be simplified a bit?
  - also need a way to hook into each others features (i.e. modify behavior if other features are enabled)
  - maybe simply hooking into the outputted files (if they exist?), creating kind of a pipeline of file transformations?
- [ ] preset with my features and feature config pre-applied
- [ ] test it out in an existing project
  - [ ] add condu to `mockify` and publish the packages
- [ ] 'init' command:
  - [ ] support converting a single-repo to a monorepo
  - [ ] auto-create the initial packages/ directory
  - [ ] maybe you can specify which preset to use and there are additional steps taken?
  - [ ] by default 'tsx' is missing from eslint apply, since bun always uses 'source' version its always needed
- [ ] use non-composite projects by default (composite support might need more work - adding references based on dependencies)
- [ ] 'apply' command:
  - [ ] when applying is done for the first time, and files exist, make sure to prompt for overwrite and remove these files from git using git rm --cached
- [ ] something is still broken with figuring out default branch
- [ ] if we had a wrapper on the tool (pnpm/yarn/bun), could maybe symlink the workspace (and even lock) files? although maybe best not to move the lockfile in case it's used by other tools that do static analysis (like Snyk) and depend on it being in the root
- [ ] add a command to update/set the package manager and node version in the root package.json
- [ ] a way to add custom test / deploy scripts? maybe if one is present in any package.json, we could auto-add it to CI process?
- [ ] bump versions to 1.0

- alpha shippable 1.0 state -

## Later:

- [ ] a dependency system of sorts, where user-defined features take precedence
  - in defineFeature we could have a `dependencies` field, which would be a list of features that need to be enabled for this feature to work, with a fallback peerDependency that applies the feature if the dependency is not met
  - when defining dependencies, you should be able to access peerContext of each of the dependencies
- [ ] should be possible to derive file attributes from other attributes (e.g. `gitignore` => `hidden` if unset)
- [ ] no use-before-define - it's silly, similarly no 'one class per file'
- [ ] automatically remove dependencies that were added declaratively by removing a feature
- [ ] global install with brew + creating github repos via CLI through API
- [ ] should features be able to contribute CLI command functionality via defineFeature?
- [ ] take inspiration for features from various starter kits:
  - [ ] monorepo starter kit: https://github.com/ixahmedxi/orbitkit
  - [ ] wdcstarterkit.com
  - [ ] epic-stack
  - [ ] create-t3-app
  - [ ] create-typescript-app (steps could be converted to features)
- [ ] add [knip](https://github.com/webpro-nl/knip)
- [ ] ability to publish multiple npm utility packages from a single folder (one per file)
- [ ] should this be a feature? package.json "exports" should be updated in apply to route paths to the sourceDir and support importing from the package name (should we discourage imports from root package? but it's an industry practice though)
- [ ] adopt EffectTS
- [ ] support TS's `rewriteRelativeImportExtensions` and use .ts extensions as default (use eslint to enforce .ts extensions)
  - this also solves Deno compatibility
- [ ] eslint - targeting package and allow multiple configs
- [ ] should we collocate per-package build config in the respective packages, or keep them global?
  - [ ] if yes, then how do we do it? `.config` folder per package?
  - [ ] make decision: where do we keep local config files? are they centrally managed? do we use config identifiers in folders names to nest configs?
- [ ] consider snake_case (the only truly universally compatible convention) https://typescript-eslint.io/rules/naming-convention/
  - although the sad reality is that most of the JS world [uses camelCase](https://news.ycombinator.com/item?id=6777600)
- [ ] fix the CLI command displayed (instead of "bun main.bundle.js") + add help
- [ ] some basic integration tests that use the linked/built packages
- [ ] add a mutex lock to prevent concurrent runs of apply, maybe something like [this](https://github.com/szikszail/cross-process-lock/blob/master/src/lock.ts) (auto-expire lock after a few seconds)
- [ ] integration test the release process - inspiration: [zx-bulk-release](https://github.com/semrel-extra/zx-bulk-release/blob/b2a22a483a810be63e059bcbcb1db08289729809/src/test/js/integration.test.js)
- [ ] store file list, tasks and dependencies in a git-committed file, so that any removals/upgrades can be flagged as changes during diffing
  - e.g. .config/condu/.files
  - e.g. .config/condu/.dependencies // automatically updated when doing 'yarn add' so that it's compatible with dep. auto-updaters
- [ ] also store version of each feature, so that we can detect if a feature has been upgraded
- [ ] detect packageManager from lockfile if not configured
- [ ] what is up with yarnrc changing on its own?
- [ ] add validation for feature dependencies (e.g. "auto" feature depends on "lerna")
  - maybe instead of dependencies, but see below - contributed state?
  - https://github.com/newdash/graphlib ?
- [ ] add shared state for features (features can contribute to it and build on top of each other's state)
  - perhaps features contribute individual settings, like in vscode - providing a required schema - that way we could validate that the dependent state is valid
- [ ] basic any-config feature:
  - [ ] bare minimum: just copy files from .config to the root and add them to .gitignore, or
  - [ ] symlink all non-js files from .config to the root (e.g. for .env)
  - [ ] create dummy root .cjs files that require or .js/.mjs files that import their equivalent from .config
- [ ] during 'apply', auto-transpile .ts config files into .js based on extension? (e.g. webpack.config.source.cts -> webpack.config.gen.cjs)
- [ ] to simplify config, automatically use features that are installed as devDependencies using the default parameters (maybe a flag can turn this off?)
- [ ] add validation on CI to make sure no uncommitted files are left dangling after `condu apply` / `yarn` on CI
- [ ] document how author, license aren't added by 'create' by default, as they will be inherited from the workspace during release, unless specified
- [ ] cli to analyze codebase for never used dependencies/devDependencies and autoremove excess/unused dependencies
  - integrate [depcheck](https://www.npmjs.com/package/depcheck)
- [ ] built local link/debug mode:
  - [ ] TSC compile watch mode? possibly using `chokidar` or `turbowatch`
  - [ ] compile, but don't change sourcemap references, keep them pointing to the source directory
- [ ] commitlint + husky for linting commit messages
- [ ] website with a catalog of features, or maybe even a UI which you can run locally to easily configure your project?
- [ ] invitation to folks to contribute features
- [ ] add possibility for folks to offer bounty/cash for features
- [ ] fix the issue with default git branch not resolving on CI
- [ ] verified published packages:
  - [ ] https://publint.dev/
  - [ ] https://arethetypeswrong.github.io/
- [ ] homegrown replacement for release-please / semantic-release / auto?
  - something simple and pluggable, and most of all, really robust. These tools are a joke.
  - use commit messages as the base to build a changelog
  - keep an updated, editable "release me PR" with the changelog and bump type (becomes the source of truth)
    - list in the form: "feat: some change (SHA, SHA, SHA...)" if squashing multiple changes, ref those SHAs to keep the history
    - more flexibility than semantic release, less manual work (and lower contribution barrier) than changesets
    - you can still release every change automatically like semrel by automatically merging the PR (or maybe there an option for this)
    - pluggable bumping strategies for various languages/tools
  - 3 part CI actions: "PR keeper", "release preparer", "release publisher"
  - everything is a function, exportable. zx-bulk-release does this well.
- [ ] ensure `packageManager` includes a SHA after the version
- [ ] jsr.io feature - publish to JSR (sets `isolatedDeclarations: true` in tsconfig)
- [ ] use the [new ${configDir} syntax in tsconfig](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5-beta/#the-configdir-template-variable-for-configuration-files) once eslint typescript resolver [supports it](https://github.com/import-js/eslint-import-resolver-typescript/issues/299)
- [ ] eventually use TS' [transpileDeclaration API](https://devblogs.microsoft.com/typescript/announcing-typescript-5-5-beta/#the-transpiledeclaration-api) for d.ts, and SWC for compiling
- [ ] additional eslints:
  - [ ] https://github.com/eslint-community/eslint-plugin-n
- [ ] consider swapping pnpm internals for https://www.npmjs.com/package/@manypkg/get-packages
- [ ] implement package.json linter:
  - https://github.com/JamieMason/syncpack
  - or https://github.com/Thinkmill/manypkg
- [ ] document Dual Package Hazard: https://www.npmjs.com/package/tshy
  - potentially offer not publishing dual-package, but instead having CJS require and re-export ESM for Node >=22
- [ ] prettier plugins: https://github.com/un-ts/prettier
- [ ] "recommended" preset of features that always opts you in to the latest and greatest of the JS ecosystem
- [ ] website
  - inspiration: [tailwind](https://tailwindcss.com/) - make configs disappear and appear in a mock vscode/github UI?
- [ ] easy way to quickly create a new Github repo, already preconfigured, with initial commit, etc.
- [ ] public library of patches to common dependencies (e.g. [graceful-fs](https://github.com/isaacs/node-graceful-fs/issues/245#issuecomment-2037699522))
- [ ] eslint additions
  - [ ] ban `export let`
- [ ] support rescript
- [ ] usability: how can we ensure that apply has been run before anything else?
  - consider modifying package.json to add "preXYZ" to each script, that auto-runs apply
    - maybe not the best idea, since user might be using pre-scripts already, or using scripts in other scripts (which would cause pre to be apply multiple times)
    - perhaps a better way is to utilize the script runner dependencies
- [ ] autodetect when certain tools are configured, but without a condu plugin, and suggest installation
  - yarn - important because of the plugin
  - others: typescript, gitignore, etc.
- [ ] in apply: auto-create package.json when missing, but matches one of the conventions
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
  - [ ] unify all of my active non-monorepo repositories to make sure all of them are kept up-to-date
  - when cloning only a single repo, it needs to be able to bootstrap itself
    - maybe a command which will clone the parent repo (or use a global clone based on ENV variable) to make parent repo tooling available and generate config files only for that specific repo?
  - the managing repo doesn't contains submodules or list (for privacy)
  - more basic, but good references: https://manicli.com/project-background
- [ ] telemetry
- [ ] error reporting API for features
- [ ] transpile config files from `.config/raw` to root (to avoid having to create workarounds loading .ts files)
- [ ] unify/clarify naming around projects/workspaces/packages/workspace-root/etc
- [ ] allow setting default TypeScript extension: '.ts', '.cts', '.mts', '.js' (for building in TSDoc mode), as well as the default extension in imports: 'source' ('.ts') or 'output' ('.js')
- [ ] allow using one of the large scaffolds (epic-stack, electronforge, ignite red)
- [ ] consider [eslint-cjs-to-esm](https://github.com/azu/eslint-cjs-to-esm)
- [ ] for library-bundle:
  - [ ] option to bundle node_modules or not (with exceptions)
  - [ ] automatically remove the bundled modules from the built package.json, and maybe add them to optionalPeerDependencies?
  - [ ] perhaps the bundled package is published separately? e.g. under a package.bundle name? maybe this is overridable?
  - [x] consider code-splitting by CLI command, to make the initial load faster?
- [ ] explain when it's better to ship unbundled (libraries) - all transpiled files individually - and when bundling actually can make sense (e.g. for applications - CLI, etc.)
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
- [ ] jest feature
- [ ] react-router feature
- [ ] State file to track changes made to the repo by the tool, and show diff before applying (for upgrading)
- [ ] Migration tool - should remove files from gitignore from committed files
- [ ] Docs: Great collection of [CLI websites](https://news.ycombinator.com/item?id=26878936) on HN
- [ ] TS: add a pure JavaScript with TSDoc mode
- [ ] adding arbitrary github action files from config (which means generating them from code is possible)
- [ ] config file - store local overrides diffing
  - i.e. if you manually change a YAML/JSON config file, we store the diff in .config, and then when we regenerate the config, we apply the diff on top of it
- [ ] create package.json's automatically on apply if they don't exist, then run yarn!
- [ ] website
- [ ] Product Hunt release
- [ ] to get good quality TS errors for both .cjs and .mjs, a wild idea would be to just dump the generated .cts files for build, and then remove them after build. maybe this could be done in the memoryFS that's overlaid on top of the real FS, where we use memFS only for the project directory, and the rest is real FS? or better yet, exclude from real FS specifically all the renamed files only. Mocked FS and we just run real `tsc --build` inside of it?
- [ ] write a generic TS helper for records/maps that contain arrays, it's a pain to always have to initialize them. or maybe have an initializer getOrSet or push/add() helper that pre-initializes it for you?
- [ ] add [ts-reset](https://github.com/total-typescript/ts-reset) to typescript
- [ ] look into https://www.farmfe.org/ and rsbuild

Other ideas:

- what if enabling the features is done by a simple list file (defaults),
  but if you want to customize, you then create a config file?
- would we want to allow installing some vendor packages by copying them into the project via git URL + sha? they're immutable unless you manually update them. might be used for using non-transpiled version of a package

- use build-time macros to enable generation of config files from JavaScript, essentially enable templating of scripts within condu configuration files

Post-release:

- https://gist.github.com/khalidx/1c670478427cc0691bda00a80208c8cc
- [ ] https://twitter.com/mattpocockuk/status/1787893902512443406?t=TFbEEj9exMvHuZLx4ZmaFA&s=19 - post to respond to when condu is ready
- [ ] https://github.com/microsoft/TypeScript/issues/25376

References:

- https://github.com/nodejs/cjs-module-lexer - extract named exports via analysis from CommonJS modules
- similar tool: https://packemon.dev/
- alternatives to consider for dual building from TSC (unfortunately uses babel):
- [duel](https://github.com/knightedcodemonkey/duel)
- [specifier updating](https://github.com/knightedcodemonkey/specifier)
- [tsup](https://github.com/egoist/tsup)
