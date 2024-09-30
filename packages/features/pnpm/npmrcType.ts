//
// Source: https://github.com/pnpm/pnpm.io/blob/30daa2f1041502b82262a129fe73ac8b8438a567/docs/npmrc.md
// Note, this was generated via GPT-4o-mini LLM using the following prompt
//
// Create a strict TypeScript interface for the config from the above described .npmrc file. Use TSDoc to annotate every field with the above readme content, retaining all the descriptions and usage examples.
// Example transformed field:
// ```ts
// /**
//  * When `true`, packages from the workspaces are symlinked to either
//  * `<workspace_root>/node_modules/.pnpm/node_modules` or to
//  * `<workspace_root>/node_modules` depending on other hoisting settings (`hoist-pattern` and `public-hoist-pattern`).
//  * @default true
//  */
// "hoist-workspace-packages"?: boolean;
// ```

import type { FullPnpmConfig } from "./npmrc.js";

type AuthTokenRecord = {
  /**
   * Define the authentication bearer token to use when accessing the specified registry.
   * For example:
   * ```sh
   * //registry.npmjs.org/:_authToken=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   * ```
   * You may also use an environment variable.
   */
  [x: `//${string}:_authToken`]: string;
};

type ScopeRecord = {
  /**
   * The npm registry that should be used for packages of the specified scope.
   * @default null
   */
  [x: `${string}:registry`]: string;
};

type NodeMirrorRecord = {
  /**
   * Sets the base URL for downloading Node.js.
   * The `<releaseDir>` portion of this setting can be any directory from https://nodejs.org/download: `release`, `rc`, `nightly`, `v8-canary`, etc.
   * @default "https://nodejs.org/download/<releaseDir>/"
   */
  [x: `node-mirror:${string}`]: string;
};

type CertRecord = {
  [x: `//${string}:${"cafile" | "certfile" | "keyfile"}`]: string;
};

type TokenHelperRecord = {
  /**
   * A token helper is an executable which outputs an auth token. This can be used in situations where the authToken is not a constant value but is something that refreshes regularly, where a script or other tool can use an existing refresh token to obtain a new access token.
   *
   * The configuration for the path to the helper must be an absolute path, with no arguments. In order to be secure, it is only permitted to set this value in the user `.npmrc`.
   *
   * Example:
   * ```
   * tokenHelper=/home/ivan/token-generator
   * ```
   */
  [x: `//${string}:tokenHelper`]: string;
};

export interface PnpmConfig
  extends AnnotatedPnpmConfig,
    AuthTokenRecord,
    ScopeRecord,
    NodeMirrorRecord,
    TokenHelperRecord,
    CertRecord,
    Omit<FullPnpmConfig, keyof AnnotatedPnpmConfig> {
  [key: string]: string | string[] | boolean | number | null | undefined;
}

interface AnnotatedPnpmConfig {
  /**
   * When `true`, all dependencies are hoisted to `node_modules/.pnpm/node_modules`. This makes
   * unlisted dependencies accessible to all packages inside `node_modules`.
   * @default true
   */
  hoist?: boolean;

  /**
   * When `true`, packages from the workspaces are symlinked to either
   * `<workspace_root>/node_modules/.pnpm/node_modules` or to `<workspace_root>/node_modules`
   * depending on other hoisting settings (`hoist-pattern` and `public-hoist-pattern`).
   * @default true
   */
  "hoist-workspace-packages"?: boolean;

  /**
   * Tells pnpm which packages should be hoisted to `node_modules/.pnpm/node_modules`. By
   * default, all packages are hoisted - however, if you know that only some flawed
   * packages have phantom dependencies, you can use this option to exclusively hoist
   * the phantom dependencies (recommended).
   *
   * Example:
   * ```ini
   * hoist-pattern[]=*eslint*
   * hoist-pattern[]=*babel*
   * ```
   *
   * You may also exclude patterns from hoisting using `!`.
   *
   * Example:
   * ```ini
   * hoist-pattern[]=*types*
   * hoist-pattern[]=!@types/react
   * ```
   * @default ["*"]
   */
  "hoist-pattern"?: string[];

  /**
   * Unlike `hoist-pattern`, which hoists dependencies to a hidden modules directory
   * inside the virtual store, `public-hoist-pattern` hoists dependencies matching
   * the pattern to the root modules directory. Hoisting to the root modules
   * directory means that application code will have access to phantom dependencies,
   * even if they modify the resolution strategy improperly.
   *
   * This setting is useful when dealing with some flawed pluggable tools that don't
   * resolve dependencies properly.
   *
   * Example:
   * ```ini
   * public-hoist-pattern[]=*plugin*
   * ```
   *
   * Note: Setting `shamefully-hoist` to `true` is the same as setting
   * `public-hoist-pattern` to `*`.
   *
   * You may also exclude patterns from hoisting using `!`.
   *
   * Example:
   * ```ini
   * public-hoist-pattern[]=*types*
   * public-hoist-pattern[]=!@types/react
   * ```
   * @default ["*eslint*", "*prettier*"]
   */
  "public-hoist-pattern"?: string[];

  /**
   * By default, pnpm creates a semistrict `node_modules`, meaning dependencies have
   * access to undeclared dependencies but modules outside of `node_modules` do not.
   * With this layout, most of the packages in the ecosystem work with no issues.
   * However, if some tooling only works when the hoisted dependencies are in the
   * root of `node_modules`, you can set this to `true` to hoist them for you.
   * @default false
   */
  "shamefully-hoist"?: boolean;

  /**
   * The directory in which dependencies will be installed (instead of
   * `node_modules`).
   * @default "node_modules"
   */
  "modules-dir"?: string;

  /**
   * Defines what linker should be used for installing Node packages.
   *
   * - **isolated** - dependencies are symlinked from a virtual store at `node_modules/.pnpm`.
   * - **hoisted** - a flat `node_modules` without symlinks is created. Same as the `node_modules` created by npm or Yarn Classic.
   * - **pnp** - no `node_modules`. Plug'n'Play is an innovative strategy for Node that is used by Yarn Berry.
   * @default "isolated"
   */
  "node-linker"?: "isolated" | "hoisted" | "pnp";

  /**
   * When `symlink` is set to `false`, pnpm creates a virtual store directory without
   * any symlinks. It is a useful setting together with `node-linker=pnp`.
   * @default true
   */
  symlink?: boolean;

  /**
   * When `false`, pnpm will not write any files to the modules directory
   * (`node_modules`). This is useful for when the modules directory is mounted with
   * filesystem in userspace (FUSE).
   * @default true
   */
  "enable-modules-dir"?: boolean;

  /**
   * The directory with links to the store. All direct and indirect dependencies of
   * the project are linked into this directory.
   *
   * This is a useful setting that can solve issues with long paths on Windows. If
   * you have some dependencies with very long paths, you can select a virtual store
   * in the root of your drive (for instance `C:\my-project-store`).
   *
   * Or you can set the virtual store to `.pnpm` and add it to `.gitignore`. This
   * will make stacktraces cleaner as paths to dependencies will be one directory
   * higher.
   * @default "node_modules/.pnpm"
   */
  "virtual-store-dir"?: string;

  /**
   * Sets the maximum allowed length of directory names inside the virtual store directory (`node_modules/.pnpm`).
   * You may set this to a lower number if you encounter long path issues on Windows.
   * @default 120
   */
  "virtual-store-dir-max-length"?: number;

  /**
   * Controls the way packages are imported from the store.
   *
   * - **auto** - try to clone packages from the store. If cloning is not supported
   * then hardlink packages from the store. If neither cloning nor linking is
   * possible, fall back to copying
   * - **hardlink** - hard link packages from the store
   * - **clone-or-copy** - try to clone packages from the store. If cloning is not supported then fall back to copying
   * - **copy** - copy packages from the store
   * - **clone** - clone (AKA copy-on-write or reference link) packages from the store
   * @default "auto"
   */
  "package-import-method"?:
    | "auto"
    | "hardlink"
    | "clone-or-copy"
    | "copy"
    | "clone";

  /**
   * The time in minutes after which orphan packages from the modules directory should be removed.
   * pnpm keeps a cache of packages in the modules directory. This boosts installation speed when
   * switching branches or downgrading dependencies.
   * @default 10080
   */
  "modules-cache-max-age"?: number;

  /**
   * The time in minutes after which dlx cache expires.
   * After executing a dlx command, pnpm keeps a cache that omits the installation step for subsequent calls to the same dlx command.
   * @default 1440
   */
  "dlx-cache-max-age"?: number;

  /**
   * The location where all the packages are saved on the disk.
   *
   * The store should be always on the same disk on which installation is happening,
   * so there will be one store per disk. If there is a home directory on the current
   * disk, then the store is created inside it. If there is no home on the disk,
   * then the store is created at the root of the filesystem.
   * @default Varies based on the environment
   */
  "store-dir"?: string;

  /**
   * By default, if a file in the store has been modified, the content of this file is checked before linking it to a project's `node_modules`.
   * If `verify-store-integrity` is set to `false`, files in the content-addressable store will not be checked during installation.
   * @default true
   */
  "verify-store-integrity"?: boolean;

  /**
   * Only allows installation with a store server. If no store server is running,
   * installation will fail.
   * @default false
   * @deprecated
   */
  "use-running-store-server"?: boolean;

  /**
   * Some registries allow the exact same content to be published under different package names and/or versions.
   * This breaks the validity checks of packages in the store. To avoid errors when verifying the names and versions of such packages in the store,
   * you may set the `strict-store-pkg-content-check` setting to `false`.
   * @default true
   */
  "strict-store-pkg-content-check"?: boolean;

  /**
   * When set to `false`, pnpm won't read or generate a `pnpm-lock.yaml` file.
   * @default true
   */
  lockfile?: boolean;

  /**
   * When set to `true` and the available `pnpm-lock.yaml` satisfies the
   * `package.json` dependencies directive, a headless installation is performed. A
   * headless installation skips all dependency resolution as it does not need to
   * modify the lockfile.
   * @default true
   */
  "prefer-frozen-lockfile"?: boolean;

  /**
   * Add the full URL to the package's tarball to every entry in `pnpm-lock.yaml`.
   * @default false
   */
  "lockfile-include-tarball-url"?: boolean;

  /**
   * When set to `true`, the generated lockfile name after installation will be named
   * based on the current branch name to completely avoid merge conflicts. For example,
   * if the current branch name is `feature-foo`, the corresponding lockfile name will
   * be `pnpm-lock.feature-foo.yaml` instead of `pnpm-lock.yaml`.
   * @default false
   */
  "git-branch-lockfile"?: boolean;

  /**
   * This configuration matches the current branch name to determine whether to merge
   * all git branch lockfile files. By default, you need to manually pass the
   * `--merge-git-branch-lockfiles` command line parameter. This configuration allows
   * this process to be automatically completed.
   *
   * Example:
   * ```ini
   * merge-git-branch-lockfiles-branch-pattern[]=main
   * merge-git-branch-lockfiles-branch-pattern[]=release*
   * ```
   *
   * You may also exclude patterns using `!`.
   * @default null
   */
  "merge-git-branch-lockfiles-branch-pattern"?: string[] | null;

  /**
   * Max length of the peer IDs suffix added to dependency keys in the lockfile.
   * If the suffix is longer, it is replaced with a hash.
   * @default 1000
   */
  "peers-suffix-max-length"?: number;

  /**
   * The base URL of the npm package registry (trailing slash included).
   * @default "https://registry.npmjs.org/"
   */
  registry?: string;

  /**
   * A token helper is an executable which outputs an auth token. This can be used in situations where the authToken is not a constant value but is something that refreshes regularly, where a script or other tool can use an existing refresh token to obtain a new access token.
   *
   * The configuration for the path to the helper must be an absolute path, with no arguments. In order to be secure, it is only permitted to set this value in the user `.npmrc`.
   *
   * Example:
   * ```
   * tokenHelper=/home/ivan/token-generator
   * ```
   */
  tokenHelper?: string;

  /**
   * The Certificate Authority signing certificate that is trusted for SSL
   * connections to the registry. Values should be in PEM format.
   * @default The npm CA certificate
   */
  ca?: string | string[] | null;

  /**
   * A path to a file containing one or multiple Certificate Authority signing
   * certificates. Similar to the `ca` setting, but allows for multiple CAs, as well
   * as for the CA information to be stored in a file instead of being specified via
   * CLI.
   * @default null
   */
  cafile?: string;

  /**
   * A client certificate to pass when accessing the registry. Values should be in
   * PEM format.
   * @default null
   */
  cert?: string;

  /**
   * Define the path to a certificate file to use when accessing the specified
   * registry.
   */
  certfile?: string;

  /**
   * Define the path to a client key file to use when accessing the specified
   * registry.
   */
  keyfile?: string;

  /**
   * A client key to pass when accessing the registry. Values should be in PEM format.
   * @default null
   */
  key?: string;

  /**
   * When fetching dependencies that are Git repositories, if the host is listed in this setting,
   * pnpm will use shallow cloning to fetch only the needed commit, not all the history.
   * @default ["github.com", "gist.github.com", "gitlab.com", "bitbucket.com", "bitbucket.org"]
   */
  "git-shallow-hosts"?: string[];

  /**
   * A proxy to use for outgoing HTTPS requests.
   * @default null
   */
  "https-proxy"?: string;

  /**
   * A proxy to use for outgoing http requests.
   * @default null
   */
  "http-proxy"?: string;

  /**
   * A proxy to use for outgoing http requests.
   * @default null
   */
  proxy?: string;

  /**
   * The IP address of the local interface to use when making connections to the npm
   * registry.
   * @default undefined
   */
  "local-address"?: string;

  /**
   * The maximum number of connections to use per origin (protocol/host/port combination).
   * @default network-concurrency x 3
   */
  maxsockets?: number;

  /**
   * A comma-separated string of domain extensions that a proxy should not be used for.
   * @default null
   */
  noproxy?: string;

  /**
   * Whether or not to do SSL key validation when making requests to the registry via
   * HTTPS.
   * @default true
   */
  "strict-ssl"?: boolean;

  /**
   * Controls the maximum number of HTTP(S) requests to process simultaneously.
   * @default 16
   */
  "network-concurrency"?: number;

  /**
   * How many times to retry if pnpm fails to fetch from the registry.
   * @default 2
   */
  "fetch-retries"?: number;

  /**
   * The exponential factor for retry backoff.
   * @default 10
   */
  "fetch-retry-factor"?: number;

  /**
   * The minimum (base) timeout for retrying requests.
   * @default 10000 (10 seconds)
   */
  "fetch-retry-mintimeout"?: number;

  /**
   * The maximum fallback timeout to ensure the retry factor does not make requests
   * too long.
   * @default 60000 (1 minute)
   */
  "fetch-retry-maxtimeout"?: number;

  /**
   * The maximum amount of time to wait for HTTP requests to complete.
   * @default 60000 (1 minute)
   */
  "fetch-timeout"?: number;

  /**
   * When `true`, any missing non-optional peer dependencies are automatically installed.
   * @default true
   */
  "auto-install-peers"?: boolean;

  /**
   * When this setting is set to `true`, packages with peer dependencies will be deduplicated after peers resolution.
   * @default true
   */
  "dedupe-peer-dependents"?: boolean;

  /**
   * If this is enabled, commands will fail if there is a missing or invalid peer
   * dependency in the tree.
   * @default false
   */
  "strict-peer-dependencies"?: boolean;

  /**
   * When enabled, dependencies of the root workspace project are used to resolve peer dependencies of any projects in the workspace.
   * It is a useful feature as you can install your peer dependencies only in the root of the workspace, and you can be sure that all projects in the workspace use the same versions of the peer dependencies.
   * @default true
   */
  "resolve-peers-from-workspace-root"?: boolean;

  /**
   * Controls colors in the output.
   * - **auto** - output uses colors when the standard output is a terminal or TTY.
   * - **always** - ignore the difference between terminals and pipes.
   * - **never** - turns off colors.
   * @default "auto"
   */
  color?: "auto" | "always" | "never";

  /**
   * Any logs at or higher than the given level will be shown.
   * You can instead pass `--silent` to turn off all output logs.
   * @default "info"
   */
  loglevel?: "debug" | "info" | "warn" | "error";

  /**
   * Experimental option that enables beta features of the CLI. This means that you
   * may get some changes to the CLI functionality that are breaking changes, or
   * potentially bugs.
   * @default false
   */
  "use-beta-cli"?: boolean;

  /**
   * If this is enabled, the primary behaviour of `pnpm install` becomes that of
   * `pnpm install -r`, meaning the install is performed on all workspace or
   * subdirectory packages.
   * @default true
   */
  "recursive-install"?: boolean;

  /**
   * If this is enabled, pnpm will not install any package that claims to not be
   * compatible with the current Node version.
   * @default false
   */
  "engine-strict"?: boolean;

  /**
   * The location of the npm binary that pnpm uses for some actions, like publishing.
   */
  "npm-path"?: string;

  /**
   * If this setting is disabled, pnpm will not fail if a different package manager is specified in the `packageManager` field of `package.json`.
   * When enabled, only the package name is checked, so you can still run any version of pnpm regardless of the version specified in the `packageManager` field.
   * @default true
   */
  "package-manager-strict"?: boolean;

  /**
   * When enabled, pnpm will fail if its version doesn't exactly match the version specified in the `packageManager` field of `package.json`.
   * @default false
   */
  "package-manager-strict-version"?: boolean;

  /**
   * When enabled, pnpm will automatically download and run the version of pnpm specified in the `packageManager` field of `package.json`.
   * This is the same field used by Corepack.
   * @default false
   */
  "manage-package-manager-versions"?: boolean;

  /**
   * Do not execute any scripts defined in the project `package.json` and its
   * dependencies.
   * @default false
   */
  "ignore-scripts"?: boolean;

  /**
   * Do not execute any scripts of the installed packages. Scripts of the projects are executed.
   * @default false
   */
  "ignore-dep-scripts"?: boolean;

  /**
   * The maximum number of child processes to allocate simultaneously to build
   * node_modules.
   * @default 5
   */
  "child-concurrency"?: number;

  /**
   * Use and cache the results of (pre/post)install hooks.
   * @default true
   */
  "side-effects-cache"?: boolean;

  /**
   * Only use the side effects cache if present, do not create it for new packages.
   * @default false
   */
  "side-effects-cache-readonly"?: boolean;

  /**
   * Set to true to enable UID/GID switching when running package scripts.
   * If set explicitly to false, then installing as a non-root user will fail.
   * @default false if running as root, else true
   */
  "unsafe-perm"?: boolean;

  /**
   * Options to pass through to Node.js via the `NODE_OPTIONS` environment variable.
   * This does not impact how pnpm itself is executed but it does impact how lifecycle scripts are called.
   * @default null
   */
  "node-options"?: string;

  /**
   * Specifies which exact Node.js version should be used for the project's runtime.
   * pnpm will automatically install the specified version of Node.js and use it for
   * running `pnpm run` commands or the `pnpm node` command.
   */
  "use-node-version"?: string;

  /**
   * The Node.js version to use when checking a package's `engines` setting.
   * @default The value returned by node -v, without the v prefix
   */
  "node-version"?: string;

  /**
   * If this is enabled, locally available packages are linked to `node_modules`
   * instead of being downloaded from the registry. This is very convenient in a
   * monorepo. If you need local packages to also be linked to subdependencies, you
   * can use the `deep` setting.
   * @default false
   */
  "link-workspace-packages"?: boolean | "deep";

  /**
   * If this is enabled, local packages from the workspace are preferred over
   * packages from the registry, even if there is a newer version of the package in
   * the registry.
   * @default false
   */
  "prefer-workspace-packages"?: boolean;

  /**
   * If this is enabled, pnpm creates a single `pnpm-lock.yaml` file in the root of
   * the workspace. This also means that all dependencies of workspace packages will
   * be in a single `node_modules` (and get symlinked to their package `node_modules`
   * folder for Node's module resolution).
   * @default true
   */
  "shared-workspace-lockfile"?: boolean;

  /**
   * This setting controls how dependencies that are linked from the workspace are added to `package.json`.
   * @default "rolling"
   */
  "save-workspace-protocol"?: boolean | "rolling";

  /**
   * When executing commands recursively in a workspace, execute them on the root workspace project as well.
   * @default false
   */
  "include-workspace-root"?: boolean;

  /**
   * When set to `true`, no workspace cycle warnings will be printed.
   * @default false
   */
  "ignore-workspace-cycles"?: boolean;

  /**
   * When set to `true`, installation will fail if the workspace has cycles.
   * @default false
   */
  "disallow-workspace-cycles"?: boolean;

  /**
   * Configure how versions of packages installed to a `package.json` file get
   * prefixed.
   * @default "^"
   */
  "save-prefix"?: "^" | "~" | "";

  /**
   * If you `pnpm add` a package and you don't provide a specific version, then it
   * will install the package at the version registered under the tag from this
   * setting.
   * @default "latest"
   */
  tag?: string;

  /**
   * Specify a custom directory to store global packages.
   * @default Varies based on the environment
   */
  "global-dir"?: string;

  /**
   * Allows to set the target directory for the bin files of globally installed packages.
   * @default Varies based on the environment
   */
  "global-bin-dir"?: string;

  /**
   * The directory where pnpm creates the `pnpm-state.json` file that is currently used only by the update checker.
   * @default Varies based on the environment
   */
  "state-dir"?: string;

  /**
   * The location of the cache (package metadata and dlx).
   * @default Varies based on the environment
   */
  "cache-dir"?: string;

  /**
   * When true, all the output is written to stderr.
   * @default false
   */
  "use-stderr"?: boolean;

  /**
   * Set to `false` to suppress the update notification when using an older version of pnpm than the latest.
   * @default true
   */
  "update-notifier"?: boolean;

  /**
   * Create symlinks to executables in `node_modules/.bin` instead of command shims. This setting is ignored on Windows, where only command shims work.
   * @default true, when node-linker is set to hoisted and the system is POSIX
   */
  "prefer-symlinked-executables"?: boolean;

  /**
   * During installation the dependencies of some packages are automatically patched. If you want to disable this, set this config to `false`.
   * @default false
   */
  "ignore-compatibility-db"?: boolean;

  /**
   * Controls how dependencies are resolved.
   * @default "highest"
   */
  "resolution-mode"?: "highest" | "time-based" | "lowest-direct";

  /**
   * Set this to `true` if the registry that you are using returns the "time" field in the abbreviated metadata.
   * As of now, only Verdaccio from v5.15.1 supports this.
   * @default false
   */
  "registry-supports-time-field"?: boolean;

  /**
   * When `false`, the `NODE_PATH` environment variable is not set in the command shims.
   * @default true
   */
  "extend-node-path"?: boolean;

  /**
   * When deploying a package or installing a local package, all files of the package are copied.
   * By default, if the package has a `"files"` field in the `package.json`, then only the listed files and directories are copied.
   * @default false
   */
  "deploy-all-files"?: boolean;

  /**
   * When set to `true`, dependencies that are already symlinked to the root `node_modules` directory of the workspace will not be symlinked to subproject `node_modules` directories.
   * @default false
   */
  "dedupe-direct-deps"?: boolean;

  /**
   * When this setting is enabled, dependencies that are injected will be symlinked from the workspace whenever possible.
   * If the dependent project and the injected dependency reference the same peer dependencies,
   * then it is not necessary to physically copy the injected dependency into the dependent's `node_modules`; a symlink is sufficient.
   * @default true
   */
  "dedupe-injected-deps"?: boolean;
}
