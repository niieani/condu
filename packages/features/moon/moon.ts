import { defineFeature } from "../../platform/core/defineFeature.js";
import type Toolchain from "./schemas/toolchain.js";
import type Workspace from "./schemas/workspace.js";
import yaml from "yaml";
import { schemas } from "./utils/schemas.js";

// TODO: add opinionated defaults for toolchain and workspace
// TODO: use a shared config property for typescript, etc.
// TODO: reuse the node version, package manager,
// TODO: infer main branch from git (maybe not necessary?)

const defaultToolchain: Toolchain = {
  /** Extend and inherit an external configuration file. */
  // extends: './shared/toolchain.yml',

  /** Configures Node.js within the toolchain. */
  node: {
    /** The version to use. */
    version: "20.4.0",

    /** The package manager to use when managing dependencies. */
    packageManager: "yarn",

    /** The version of the package manager to use. */
    yarn: {
      version: "4.0.0-rc",
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

const defaultWorkspace: Workspace = {
  // REQUIRED: A map of all projects found within the workspace, or a list or file system globs.
  // When using a map, each entry requires a unique project ID as the map key, and a file system
  // path to the project folder as the map value. File paths are relative from the workspace root,
  // and cannot reference projects located outside the workspace boundary.
  projects: ["packages/*"],
  /** Configures the version control system to utilize within the workspace. A VCS
is required for determining touched (added, modified, etc) files, calculating file hashes,
computing affected files, and much more. */
  vcs: {
    /**
     * The client to use when managing the repository.
     * Accepts "git". Defaults to "git".
     **/
    manager: "git",
    /**
     * The default branch (master/main/trunk) in the repository for comparing the
     * local branch against. For git, this is is typically "master" or "main",
     * and must include the remote prefix (before /).
     **/
    defaultBranch: "main",
  },
};

export const moon = ({
  toolchain,
  workspace,
}: {
  toolchain?: Toolchain;
  workspace?: Workspace;
}) =>
  defineFeature({
    name: "moon",
    order: { priority: "beginning" },
    actionFn: (config, state) => ({
      files: [
        { path: ".moon/" },
        { path: ".moon/cache" },
        { path: ".moon/docker" },
        {
          path: ".moon/toolchain.yml",
          content: yaml.stringify({
            $schema: schemas.toolchain,
            ...defaultToolchain,
            ...toolchain,
          }),
        },
        {
          path: ".moon/workspace.yml",
          content: yaml.stringify({
            $schema: schemas.workspace,
            ...defaultWorkspace,
            ...workspace,
          }),
        },
      ],
    }),
  });
