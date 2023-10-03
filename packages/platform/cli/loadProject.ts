import path from "path";
import { getManifest } from "./toolchain.js";
import { CORE_NAME } from "./constants.js";
import {
  CONFIGURED,
  type ConfiguredRepoConfig,
} from "@repo/core/configTypes.js";
import {
  getProjectDefinitionsFromConventionConfig,
  type WorkspaceProjectDefined,
} from "./getProjectGlobsFromMoonConfig.js";
import type PackageJson from "@repo/schema-types/schemas/packageJson.js";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";

export interface LoadConfigOptions {
  startDir?: string;
}

export type WriteManifestFn = (
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

export async function loadRepoProject({
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

export const getWorkspacePackages = async (project: Project) => {
  // note: could use 'moon query projects --json' instead
  // though that would lock us into 'moon'
  const packages: readonly object[] = await findWorkspacePackagesNoCheck(
    project.projectDir,
    { patterns: project.projectConventions.map(({ glob }) => glob) },
  );
  return packages as readonly {
    dir: string;
    manifest: PackageJson;
    writeProjectManifest: WriteManifestFn;
  }[];
};
