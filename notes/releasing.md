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
  - it does, but the problem is it replaces the "workspace:\*" due to [this bug](https://github.com/googleapis/release-please/issues/2173), making it unusable
  - perhaps I can patch it manually for now in a fork
- if not, let's try semantic-release with `pkgRoot` option
  - might need to move files from `build` to `.dist` or sth to make it work

Next step:

- [x] ensure that merging the test release PR will ONLY release the selected packages, rather than EVERYTHING via lerna
  - [x] maybe make all non-released packages private for the duration of the release?
- [x] lerna seems very poorly written, maybe I can just make my own releasing logic?
  - i.e. set correct version and (peer/dev)dependencies based on workspace? or steal pnpm publish logic for this? and then just publish required deps using the selected package manager
