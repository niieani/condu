import type { PartialToolchainConfig as Toolchain } from "@moonrepo/types";

// TODO: add opinionated defaults for toolchain and workspace
// TODO: use a shared config property for typescript, etc.
export const defaultToolchain: Toolchain = {
  /** Extend and inherit an external configuration file. */
  // extends: './shared/toolchain.yml',
  /** Configures Node.js within the toolchain. */
  node: {
    /** The version to use. */
    // version: defaultNodeVersion,
    /** The package manager to use when managing dependencies. */
    // packageManager: defaultPackageManager,
    /** The version of the package manager to use. */
    yarn: {
      version: "latest",
    },

    /** Add `node.version` as a constraint in the root `package.json` `engines`. */
    addEnginesConstraint: true,

    /** Dedupe dependencies after the lockfile has changed. */
    dedupeOnLockfileChange: true,

    /** Version format to use when syncing dependencies within the project's `package.json`. */
    dependencyVersionFormat: "workspace",

    /** Infer and automatically create moon tasks from `package.json` scripts, per project. */
    // BEWARE: Tasks and scripts are not 1:1 in functionality, so please refer to the documentation.
    inferTasksFromScripts: false,

    /** Sync a project's `dependsOn` as dependencies within the project's `package.json`. */
    syncProjectWorkspaceDependencies: true,
    /** Sync `node.version` to a 3rd-party version manager's config file. */
    // Accepts "nodenv" (.node-version), "nvm" (.nvmrc), or none.
    // syncVersionManagerConfig: 'nodenv'
  },

  /** Configures how moon integrates with TypeScript. */
  typescript: {
    /** When `syncProjectReferences` is enabled and a dependent project reference
     * *does not* have a `tsconfig.json`, automatically create one. */
    createMissingConfig: false,

    /** Name of `tsconfig.json` file in each project root. */
    // projectConfigFileName: 'tsconfig.json',
    /** Name of `tsconfig.json` file in the workspace root. */
    // rootConfigFileName: 'tsconfig.json',
    /** Name of the config file in the workspace root that defines shared compiler
     * options for all project reference based config files. */
    // rootOptionsConfigFileName: 'tsconfig.options.json',
    /** Update a project's `tsconfig.json` to route the `outDir` compiler option
     * to moon's `.moon/cache` directory. */
    routeOutDirToCache: false,

    /** Sync a project's `dependsOn` as project references within the
     * project's `tsconfig.json` and the workspace root `tsconfig.json`. */
    syncProjectReferences: false,

    /** Sync a project's project references as import aliases to the `paths`
     * compiler option in each applicable project. */
    syncProjectReferencesToPaths: false,
  },
};
