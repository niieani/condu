import * as path from "node:path";
import {
  CONDU_CONFIG_DIR_NAME,
  CONDU_CONFIG_FILE_NAME,
  CORE_NAME,
  DEFAULT_NODE_VERSION,
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_SOURCE_EXTENSIONS,
  DEFAULT_GENERATED_SOURCE_FILE_NAME_SUFFIXES,
} from "./constants.js";
import type {
  ConduConfigWithInferredValues,
  LoadConfigOptions,
  ConduConfigDefaultExport,
} from "./api/configTypes.js";
import {
  ConduPackageEntry,
  type WorkspaceSubPackage,
} from "./commands/apply/ConduPackageEntry.js";
import { CONFIGURED } from "./api/configure.js";
import { getProjectDefinitionsFromConventionConfig } from "./getProjectGlobsFromMoonConfig.js";
import { getDefaultGitBranch } from "@condu/core/utils/getDefaultGitBranch.js";
import { findUp } from "@condu/core/utils/findUp.js";
import * as fs from "node:fs/promises";
import { getManifestsPaths, getPackage } from "@condu/workspace-utils/topo.js";
import { ConduProject } from "./commands/apply/ConduProject.js";

export async function loadConduProject({
  startDir = process.cwd(),
}: LoadConfigOptions = {}): Promise<ConduProject | undefined> {
  const configDirPath = await findUp(
    async (file) => {
      if (file.name === CONDU_CONFIG_DIR_NAME) {
        return fs
          .access(
            path.join(
              file.parentPath,
              CONDU_CONFIG_DIR_NAME,
              CONDU_CONFIG_FILE_NAME,
            ),
            fs.constants.R_OK,
          )
          .then(() => true)
          .catch(() => false);
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
  const workspacePackage = new ConduPackageEntry(
    await getPackage({
      workspaceRootDir: workspaceDir,
      manifestAbsPath: path.resolve(workspaceDir, "package.json"),
      kind: "workspace",
    }),
  );

  const importedConfigFile = await import(
    /* webpackIgnore: true */
    configFilePath
  ).catch((error) => {
    console.error(`Unable to load the ${CORE_NAME} config file:\n`, error);
  });

  const configFn: ConduConfigDefaultExport | undefined =
    importedConfigFile?.default;

  if (!configFn || typeof configFn !== "function") {
    console.error(
      `Invalid configuration file. Make sure to use the configure function to export your configuration. Right now it is ${typeof configFn}`,
    );
    return;
  }

  const config = await configFn(workspacePackage);

  if (!config || !config[CONFIGURED]) {
    console.error(
      `Invalid configuration file. Make sure to use the configure function to export your configuration.`,
    );
    return;
  }

  const projectConventions = getProjectDefinitionsFromConventionConfig(
    config.projects,
  );

  const defaultBranch: string =
    config.git?.defaultBranch ?? (await getDefaultGitBranch(workspaceDir));

  const { manifest } = workspacePackage;
  const { packageManager, engines, pnpm } = manifest;
  const [packageManagerName, packageManagerVersion] =
    packageManager?.split("@") ?? [];
  const nodeVersion = engines?.node ?? DEFAULT_NODE_VERSION;

  const configWithInferredValues: ConduConfigWithInferredValues = {
    ...config,
    engine: "bun",
    git: {
      ...config.git,
      defaultBranch,
    },
    node: {
      ...(packageManagerName === "yarn" ||
      packageManagerName === "pnpm" ||
      packageManagerName === "npm" ||
      packageManagerName === "bun"
        ? {
            packageManager: {
              name: packageManagerName,
              version: packageManagerVersion,
            },
          }
        : {
            packageManager: {
              name: pnpm ? "pnpm" : DEFAULT_PACKAGE_MANAGER,
            },
          }),
      version: nodeVersion,
    },
    conventions: {
      ...config.conventions,
      sourceDir: config.conventions?.sourceDir ?? ".",
      buildDir: config.conventions?.buildDir ?? "build",
      sourceExtensions:
        config.conventions?.sourceExtensions ?? DEFAULT_SOURCE_EXTENSIONS,
      generatedSourceFileNameSuffixes:
        config.conventions?.generatedSourceFileNameSuffixes ??
        DEFAULT_GENERATED_SOURCE_FILE_NAME_SUFFIXES,
      projectConventions,
    },
    workspaceDir: workspacePackage.absPath,
    configDir: path.join(workspacePackage.absPath, CONDU_CONFIG_DIR_NAME),
    globalPeerContext: {
      ...config.globalPeerContext,
      execWithTsSupport: Boolean(
        import.meta.url.endsWith(".ts") ||
          config.globalPeerContext?.execWithTsSupport,
      ),
    },
  } as const;

  const workspacePackages = await getWorkspacePackages({
    projectConventions,
    absPath: workspacePackage.absPath,
  });
  return new ConduProject({
    projectConventions,
    config: configWithInferredValues,
    workspacePackage,
    workspacePackages,
  });
}

export const getWorkspacePackages = async (
  project: Pick<ConduProject, "projectConventions" | "absPath">,
): Promise<WorkspaceSubPackage[]> => {
  if (!project.projectConventions) return [];
  // note: could use 'moon query projects --json' instead
  // though that would lock us into 'moon'
  const packageJsonPaths = await getManifestsPaths({
    cwd: project.absPath,
    workspaces: project.projectConventions.map(({ glob }) => glob).sort(),
  });
  return Promise.all(
    packageJsonPaths.map(
      async (manifestAbsPath) =>
        new ConduPackageEntry(
          await getPackage({
            workspaceRootDir: project.absPath,
            manifestAbsPath,
            kind: "package",
          }),
        ),
    ),
  );
};
