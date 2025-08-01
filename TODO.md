## MVP / alpha TODO List

- [ ] make CI github actions work agnostic from the build system (moon vs packageScripts)
- [ ] support bun's implementation of catalogs
- [ ] enable using biome formatter with prettier (in which case prettier is enabled for non-JS files)
- [ ] features should be able to contribute CLI command functionality via `defineFeature` - implement the ability for features to define their own CLI commands, e.g. `condu custom-command`, etc. we'll need to figure out how to disambiguate if multiple features contribute the same command. Or simply last one wins, and add a warning?
- [ ] feature to add autogenerated documentation website
- [ ] create new condu commands (`condu install`, `condu add`, `condu remove`) that run the underlying command in the correct package manager. To achieve this, use `nypm` dependency programmatically (Unified Package Manager for Node.js - npm, pnpm, yarn, Bun and Deno) - see [api](https://raw.githubusercontent.com/unjs/nypm/refs/heads/main/src/api.ts) and [readme](https://raw.githubusercontent.com/unjs/nypm/refs/heads/main/README.md).
- [ ] when using `pnpm`, hoist all packages in root level, but auto-add them as dependencies whenever needed - or use TS paths to resolve them for TS
- [ ] `co` command is short for `condu` and supports proxying to underlying package manager - i.e. `co install`, `co add`, etc.
- [ ] support globally installing condu, which enforces the use of local version for most commands (except for a few core ones like `condu init`, `condu install`, `condu add`, `condu remove`)
- [ ] move opinionated configuration away from features to the preset
- [ ] add api to condu so that modifyPackageJson keeps track of new properties added, so they can be removed when the feature is removed. the fields are tracked in package.json itself, under `condu` field, `condu.managedScripts: string[]` (with an array of keys of scripts that are managed by condu) and `condu.managedDependencies: { [dependency: string]: "presence" | "version" }` for added dependencies (version if strict version is controlled by condu, presence if only the package's presence is tracked), etc, `managedFields: string[]` for other keys that are being modified by `condu`. If after applying all features, there are fewer managed scripts, dependencies or fields than before, then these are removed from the package.json. Could be achieved by using a Proxy object, tracking changes, instead of a return type that modifies the package.json directly. Or doing a deep diff of each change.
- [ ] validate NPM task system without moonrepo
- [ ] revamped logging / output
- [ ] implement TS references sync (use [ts-referent](https://github.com/theKashey/ts-referent))
- [ ] pnpm install runs `condu apply` which adds pnpm-workspace, which need another pnpm install... how do we solve this?
- [ ] `condu release` should maybe run the build?
- [ ] Fix monorepo integration test for release to properly handle workspace dependencies
- [ ] update the monorepo preset to allow passing `false` for each feature config to disable it
- [ ] consider changing condu api to add prefixes e.g. `condu.in('package').file.create(...)`, `condu.root.packageJson.merge({...})`
- [ ] perhaps merge object (for package json) by default ([see](https://youtu.be/Pmieyp75SrA?t=491)), rather than replacing it, set undefined if you want to remove keys explicitly, perhaps unless a helper function `$replace({...})` is used, which internally adds a `Symbol.for('replace')` property into the object, and that's how we know to avoid merging.
- [ ] consider using `dependencies` and `prepare` [lifecycle scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts#life-cycle-scripts) to run `condu apply`
- [ ] support shorthand for filtering packages by name: `condu.in('package')`
- [ ] exclude condu-generated files from TS build (add file flag for typescript exclude, and inherit gitignore)
- [ ] add condu api to define a file flag's behavior (e.g. to inherit another flag, like the gitignore flag)
- [ ] add `repository`, `homepage` (fallback to repo) and `author`, `license` and `contributors` info to published package.json based on the root package.json
- [ ] features that can be added multiple times (e.g. because they're applied to multiple packages, like webpack build) need to have a way to be uniquely identified (feature id?) - update 'apply' to handle this. Question remains about initial peer context - I guess it needs to be empty and then peer merging can handle additions to peer context of that same feature. Maybe instead of feature ID, we only apply the first one, but we apply the peerContext for all of them - like a reducer? Though what about situations in which you configure separately targeting different packages?
- [ ] preset with my features and feature config pre-applied
- [ ] test it out in an existing project
  - [ ] add condu to `mockify` and publish the packages
- [ ] 'init' command improvements:
  - [ ] support converting a single-repo to a monorepo
  - [ ] auto-create the initial packages/ directory
  - [ ] maybe you can specify which preset to use and there are additional steps taken?
  - [ ] by default 'tsx' is missing from eslint apply, since bun always uses 'source' version its always needed
- [ ] use TS non-composite projects by default (composite support might need more work - adding references based on dependencies)
  - [ ] [disallow-workspace-cycles](https://pnpm.io/npmrc#disallow-workspace-cycles) in pnpm when typescript references are enabled
- [ ] 'apply' command:
  - [ ] verify that we prompt before overwriting files that were never managed by condu before
  - [ ] when applying is done, and newly created files where previously committed, but now are managed by condu and would be gitignored, condu should remove these files from git using `git rm --cached` if they're gitignored - this can be verified with `git ls-files --cached -- <file>`
- [ ] something is still broken with figuring out default branch
- [ ] if we had a wrapper on the tool (pnpm/yarn/npm/bun), could maybe symlink the workspace (and even lock) files? although maybe best not to move the lockfile in case it's used by other tools that do static analysis (like Snyk) and depend on it being in the root
- [ ] add a command to update/set the package manager and node version in the root package.json
- [ ] a way to add custom test / deploy scripts? maybe if one is present in any package.json, we could auto-add it to CI process?
- [ ] bump versions to 1.0

- alpha shippable 1.0 state -

## Later:

- [ ] feature to use `tsdown` in [unbundle mode](https://tsdown.dev/options/unbundle) for building packages
- [ ] create a philosophy page (like [here](https://tanstack.com/form/latest/docs/philosophy))
- [ ] share on https://peerlist.io/
- [ ] @shadcn/ui feature
- [ ] migrate to [stricli](https://bloomberg.github.io/stricli/docs/quick-start)
- [ ] vscode feature: translate condu tasks to vscode tasks.json
- [ ] consider whether features should have a version field
- [ ] come up with a linter for tags (to define which packages should never depend on another one)
- [ ] vscode extension that runs apply on .config/condu.ts change
- [ ] better logger (potentially https://github.com/unjs/consola)
- [ ] `condu init` can be used to apply changes to an existing project, in which case it will infer certain things from the existing project, like the package manager
- [ ] maybe even basic config like 'node' in ConduConfig should be its own feature with peerContext?
- [ ] when using conventional commits, set `github.copilot.chat.commitMessageGeneration.instructions`
- [ ] solve development mode linking? https://devblogs.microsoft.com/typescript/announcing-typescript-5-7/#path-rewriting-for-relative-paths
- [ ] perhaps bake-in a test tsconfig configuration using project references? see [this section](https://devblogs.microsoft.com/typescript/announcing-typescript-5-7/#searching-ancestor-configuration-files-for-project-ownership) of the article
- [ ] auto-deprecate packages that have been removed from the repo
- [ ] use `module.enableCompileCache()` ([link](https://github.com/nodejs/node/pull/54501))
- [ ] look into supporting [unimport](https://github.com/unjs/unimport)
- [ ] maybe use [nypm](https://github.com/unjs/nypm) to install/remove packages? or maybe just using [tinyexec](https://github.com/tinylibs/tinyexec) is [enough](https://github.com/unjs/nypm/blob/c2dce581644f1d9b8e11af587f2ba5114f24cdd2/src/_utils.ts#L62-L67)
- [ ] a dependency system of sorts, where user-defined features take precedence
  - in defineFeature we could have a `dependencies` field, which would be a list of features that need to be enabled for this feature to work, with a fallback peerDependency that applies the feature if the dependency is not met
  - when defining dependencies, you should be able to access peerContext of each of the dependencies
- [ ] should be possible to derive file attributes from other attributes (e.g. `gitignore` => `hidden` if unset)
- [ ] no use-before-define - it's silly, similarly no 'one class per file'
- [ ] automatically remove dependencies that were added declaratively by removing a feature
- [ ] global install with brew + creating github repos via CLI through API
- [ ] take inspiration for features from various starter kits:
  - [ ] monorepo starter kit: https://github.com/ixahmedxi/orbitkit
  - [ ] wdcstarterkit.com
  - [ ] epic-stack
  - [ ] create-t3-app
  - [ ] create-typescript-app (steps could be converted to features)
- [ ] add [knip](https://github.com/webpro-nl/knip)
- [ ] ability to publish multiple npm utility packages from a single folder (one per file)
- [ ] should this be a feature? package.json "exports" should be updated in apply to route paths to the sourceDir and support importing from the package name (should we discourage imports from root package? but it's an industry practice though)
- [ ] auto-generated typescript references
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
- [ ] add `inputs` / `implicitInputs`
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
