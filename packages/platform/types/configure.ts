import type { RepoConfig, ConfiguredRepoConfig } from "./configTypes.js";

// export const CONFIGURED = Symbol.for("Configured");
export const CONFIGURED = "__configured__";

export const configure = (config: RepoConfig): ConfiguredRepoConfig => ({
  ...config,
  [CONFIGURED]: true,
});
