import path from "path";
import { getManifest } from "./toolchain.js";
import { CORE_NAME } from "./constants.js";
import { CONFIGURED, ConfiguredRepoConfig } from "../core/configTypes.js";
import {
  WorkspaceProjectDefined,
  getProjectDefinitionsFromConventionConfig,
} from "./getProjectGlobsFromMoonConfig.js";
import { ProjectManifest } from "@pnpm/types";

declare module "../di/di.js" {
  interface Container {
    loadProject: typeof loadProject;
  }
}

export interface LoadConfigOptions {
  startDir?: string;
}

export type Project = Omit<
  Awaited<ReturnType<typeof getManifest>>,
  "fileName"
> & {
  projectConventions: WorkspaceProjectDefined[];
  config: ConfiguredRepoConfig;
};

export async function loadProject({
  startDir = process.cwd(),
}: LoadConfigOptions = {}): Promise<Project | undefined> {
  const { manifest, writeProjectManifest, projectDir } = await getManifest(
    startDir,
  );
  const configFile = path.join(projectDir, `.config`, `${CORE_NAME}.ts`);
  const importedConfigFile = await import(configFile).catch((error) => {
    console.error(
      `Unable to load the ${CORE_NAME} config file:\n${error.message}`,
    );
  });

  const config: ConfiguredRepoConfig | undefined = importedConfigFile?.default;

  if (!config || typeof config !== "object" || !(CONFIGURED in config)) {
    console.error(
      `Invalid configuration file. Make sure to use the configure option`,
    );
    return;
  }

  const projectConventions = getProjectDefinitionsFromConventionConfig(
    config.projects,
  );

  return {
    manifest,
    writeProjectManifest,
    projectDir,
    projectConventions,
    config,
  };
}
