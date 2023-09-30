import path from "path";
import { getManifest } from "./toolchain.js";
import { CORE_NAME } from "./constants.js";
import { CONFIGURED, ConfiguredRepoConfig } from "@repo/core/configTypes.js";
import {
  WorkspaceProjectDefined,
  getProjectDefinitionsFromConventionConfig,
} from "./getProjectGlobsFromMoonConfig.js";
import type PackageJson from "@repo/schema-types/schemas/packageJson.js";
// import { ProjectManifest } from "@pnpm/types";

export interface LoadConfigOptions {
  startDir?: string;
}

type WriteManifestFn = (
  manifest: PackageJson,
  force?: boolean,
) => Promise<void>;

export type Project = Omit<
  Awaited<ReturnType<typeof getManifest>>,
  "fileName" | "manifest" | "writeProjectManifest"
> & {
  manifest: PackageJson;
  projectConventions: WorkspaceProjectDefined[];
  config: ConfiguredRepoConfig;
  writeProjectManifest: WriteManifestFn;
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
    manifest: manifest as PackageJson,
    writeProjectManifest: writeProjectManifest as WriteManifestFn,
    projectDir,
    projectConventions,
    config,
  };
}
