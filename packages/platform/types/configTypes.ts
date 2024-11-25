import type { PackageJson } from "@condu/schema-types/schemas/packageJson.gen.js";
import type { CONFIGURED } from "./configure.js";
import type { FeatureDefinition } from "@condu/cli/commands/apply/conduApi.js";
import type {
  ConduPackageEntry,
  ConduPackageJson,
} from "@condu/cli/commands/apply/ConduPackageEntry.js";
import type { PeerContext } from "@condu/cli/commands/apply/PeerContext.js";
import type { AutoLinkConfig } from "@condu/cli/builtin-features/autolink.js";

export interface Conventions {
  /** @default '.' */
  sourceDir?: string;
  sourceExtensions?: string[];
  buildDir?: string;
  /** @default ['.gen', '.generated'] */
  generatedSourceFileNameSuffixes?: string[];

  // TODO: add a convention for test files
}

export interface ResolvedConventionsWithWorkspace
  extends Required<Conventions> {
  projectConventions?: readonly DefinedWorkspaceProjectConvention[] | undefined;
}

type GitConfig = {
  /** inferred from git if empty */
  defaultBranch?: string;
};

type NodeConfig = {
  /** @default 'yarn' */
  packageManager?: {
    name: "yarn" | "npm" | "pnpm" | "bun";
    version?: string | undefined;
  };
  version?: string | undefined;
};

// TODO: add 'deno'
type Engine = "node" | "bun";

export interface NpmPublishConfig {
  registry?: string;
  access?: "public" | "restricted";
}

export interface ConduConfig {
  /** primary engine used to run the tool */
  engine?: Engine;
  node?: NodeConfig;
  publish?: NpmPublishConfig;
  git?: GitConfig;
  features: FeatureDefinition<keyof PeerContext>[];
  /** automatically links any config file inside .config/ folder to the root directory and makes it invisible */
  autolink?: boolean | AutoLinkConfig;
  /** when present, assumes monorepo */
  projects?: WorkspaceProjectsConvention[];
  conventions?: Conventions;
}

export interface ConfiguredConduConfig extends ConduConfig {
  [CONFIGURED]: true;
}

export interface ConduConfigWithInferredValues extends ConfiguredConduConfig {
  /** absolute path to the workspace */
  workspaceDir: string;
  /** absolute path to the config directory */
  configDir: string;
  conventions: ResolvedConventionsWithWorkspace;
  git: Required<GitConfig>;
  node: Required<NodeConfig>;
  engine: Engine;
}

export type GetConduConfigPromise = (
  pkg: ConduPackageEntry,
) => Promise<ConfiguredConduConfig>;

export type ConduConfigInput =
  | ConduConfig
  | ((pkg: ConduPackageEntry) => ConduConfig)
  | ((pkg: ConduPackageEntry) => Promise<ConduConfig>);

export type ConduConfigDefaultExport =
  | ConfiguredConduConfig
  | ((pkg: ConduPackageEntry) => ConfiguredConduConfig)
  | ((pkg: ConduPackageEntry) => Promise<ConfiguredConduConfig>);

export interface LoadConfigOptions {
  startDir?: string;
  throwOnManualChanges?: boolean;
}

export interface WriteManifestFnOptions {
  force?: boolean;
  merge?: boolean;
}

export type WriteManifestFn = (
  manifest: ConduPackageJson | PackageJson,
  options?: WriteManifestFnOptions,
) => Promise<void>;

export interface ProjectConventionConfig {
  private?: boolean;

  /**
   * path to the template folder, relative to the path of the new would-be package
   * it will be used to bootstrap packages created using the convention
   *
   * @default `../@template`
   **/
  templatePath?: string;
}

export interface ParentDirectoryProjectConvention
  extends ProjectConventionConfig {
  /**
   * defines how the name should be created from the project directory name.
   * '*' in the string refers to the project directory name
   * @example when '@condu/*' will name the project '@condu/utils' if the project folder is 'utils'
   * @default '*'
   **/
  nameConvention?: string;
  /**
   * defines the path to the project directory
   * @example when set to 'packages/tools' will expect that packages will live in the 'packages/tools' directory
   **/
  parentPath: string;
}

export interface ExplicitPathProjectConvention extends ProjectConventionConfig {
  path: string;
  name?: string;
}

export type WorkspaceProjectsConvention =
  | ExplicitPathProjectConvention
  | ParentDirectoryProjectConvention
  | string;

export type DefinedWorkspaceProjectConvention =
  | ({
      readonly glob: string;
      readonly type: "explicit";
    } & Partial<ExplicitPathProjectConvention>)
  | ({
      readonly glob: string;
      readonly type: "glob";
    } & Partial<ParentDirectoryProjectConvention>);
