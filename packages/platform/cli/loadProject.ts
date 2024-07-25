/// <reference path="./async-memoize-one.d.ts" />

import * as path from "node:path";
import {
  CONDU_CONFIG_DIR_NAME,
  CONDU_CONFIG_FILE_NAME,
  CORE_NAME,
  CONFIG_DIR,
  DEFAULT_NODE_VERSION,
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_SOURCE_EXTENSIONS,
} from "@condu/types/constants.js";
import type {
  ConfiguredRepoConfig,
  RepoConfigWithInferredValues,
  LoadConfigOptions,
  WorkspaceRootPackage,
  WorkspaceSubPackage,
  WorkspaceProjectDefined,
} from "@condu/types/configTypes.js";
import { CONFIGURED } from "@condu/types/configure.js";
import { getProjectDefinitionsFromConventionConfig } from "@condu/core/utils/getProjectGlobsFromMoonConfig.js";
import memoizeOne from "async-memoize-one";
import { getDefaultGitBranch } from "@condu/core/utils/getDefaultGitBranch.js";
import sortPackageJson from "sort-package-json";
import { findUp } from "@condu/core/utils/findUp.js";
import * as fs from "node:fs";
import { getManifestsPaths, getPackage } from "@condu/workspace-utils/topo.js";

export interface Project extends WorkspaceRootPackage {
  projectConventions: WorkspaceProjectDefined[];
  config: RepoConfigWithInferredValues;
  getWorkspacePackages: () => Promise<readonly WorkspaceSubPackage[]>;
}

export async function loadRepoProject({
  startDir = process.cwd(),
}: LoadConfigOptions = {}): Promise<Project | undefined> {
  const configDirPath = await findUp(
    async (file) => {
      if (file.name === CONDU_CONFIG_DIR_NAME) {
        return fs.promises.exists(
          path.join(
            file.parentPath,
            CONDU_CONFIG_DIR_NAME,
            CONDU_CONFIG_FILE_NAME,
          ),
        );
      }
      return false;
    },
    { cwd: startDir, type: "directory" },
  );
  const workspaceDir = configDirPath ? path.dirname(configDirPath) : startDir;
  const configFilePath = path.join(
    workspaceDir,
    CONDU_CONFIG_DIR_NAME,
    CONDU_CONFIG_FILE_NAME,
  );

  const importedConfigFile = await import(
    /* webpackIgnore: true */
    configFilePath
  ).catch((error) => {
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

  const workspacePackage = await getPackage(
    workspaceDir,
    path.resolve(workspaceDir, "package.json"),
  );
  const { manifest } = workspacePackage;

  const defaultBranch: string =
    config.git?.defaultBranch ?? (await getDefaultGitBranch(workspaceDir));

  const { packageManager, engines } = manifest;
  const [packageManagerName, packageManagerVersion] = packageManager?.split(
    "@",
  ) ?? [DEFAULT_PACKAGE_MANAGER];
  const nodeVersion = engines?.node ?? DEFAULT_NODE_VERSION;

  const configWithInferredValues: RepoConfigWithInferredValues = {
    ...config,
    git: {
      ...config.git,
      defaultBranch,
    },
    node: {
      ...(packageManagerName === "yarn" ||
      packageManagerName === "pnpm" ||
      packageManagerName === "npm"
        ? {
            packageManager: {
              name: packageManagerName,
              version: packageManagerVersion,
            },
          }
        : {
            packageManager: {
              name: DEFAULT_PACKAGE_MANAGER,
            },
          }),
      version: nodeVersion,
    },
    conventions: {
      ...config.conventions,
      sourceDir: config.conventions?.sourceDir ?? "src",
      buildDir: config.conventions?.buildDir ?? "build",
      sourceExtensions:
        config.conventions?.sourceExtensions ?? DEFAULT_SOURCE_EXTENSIONS,
    },
    workspaceDir: workspacePackage.absPath,
    configDir: path.join(workspacePackage.absPath, CONFIG_DIR),
  } as const;

  const project: Project = {
    kind: "workspace",
    projectConventions,
    config: configWithInferredValues,
    getWorkspacePackages: memoizeOne(() => getWorkspacePackages(project)),
    ...workspacePackage,
  };

  return project;
}

export const getWorkspacePackages = async (
  project: Pick<Project, "projectConventions" | "absPath">,
): Promise<WorkspaceSubPackage[]> => {
  // note: could use 'moon query projects --json' instead
  // though that would lock us into 'moon'
  const packageJsonPaths = await getManifestsPaths({
    cwd: project.absPath,
    workspaces: project.projectConventions.map(({ glob }) => glob).sort(),
  });
  return Promise.all(
    packageJsonPaths.map(async (manifestPath) => ({
      kind: "package",
      ...(await getPackage(project.absPath, manifestPath)),
    })),
  );
};
