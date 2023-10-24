/// <reference path="./async-memoize-one.d.ts" />

import path from "node:path";
import { getManifest } from "./toolchain.js";
import { CORE_NAME } from "./constants.js";
import {
  CONFIGURED,
  type ConfiguredRepoConfig,
  type RepoPackageJson,
} from "@repo/core/configTypes.js";
import {
  getProjectDefinitionsFromConventionConfig,
  type WorkspaceProjectDefined,
} from "./getProjectGlobsFromMoonConfig.js";
import type PackageJson from "@repo/schema-types/schemas/packageJson.gen.js";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import memoizeOne from "async-memoize-one";
import type { ProjectManifest } from "@pnpm/types";

export interface LoadConfigOptions {
  startDir?: string;
}

export type WriteManifestFn = (
  manifest: RepoPackageJson | PackageJson,
  force?: boolean,
) => Promise<void>;

export interface WorkspacePackage {
  /** relative directory of the package from the projectDir */
  dir: string;
  manifest: RepoPackageJson;
  writeProjectManifest: WriteManifestFn;
}

export interface Project
  extends WorkspacePackage,
    Omit<
      Awaited<ReturnType<typeof getManifest>>,
      "fileName" | "manifest" | "writeProjectManifest"
    > {
  projectConventions: WorkspaceProjectDefined[];
  /** absolute path to the project */
  projectDir: string;
  config: ConfiguredRepoConfig;
  getWorkspacePackages: () => Promise<readonly WorkspacePackage[]>;
}

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

  const project: Project = {
    manifest,
    writeProjectManifest,
    projectDir,
    projectConventions,
    dir: ".",
    config,
    getWorkspacePackages: memoizeOne(() => getWorkspacePackages(project)),
  };

  return project;
}

export const getWorkspacePackages = async (
  project: Pick<Project, "projectConventions" | "projectDir">,
) => {
  // note: could use 'moon query projects --json' instead
  // though that would lock us into 'moon'
  const packages = await findWorkspacePackagesNoCheck(project.projectDir, {
    patterns: project.projectConventions.map(({ glob }) => glob).sort(),
  });
  return packages.flatMap(({ dir, manifest, writeProjectManifest }) => {
    const relativePath = path.relative(project.projectDir, dir);
    if (relativePath === "") {
      // skip workspace package
      return [];
    }
    return {
      dir: relativePath,
      manifest: {
        ...(manifest as PackageJson),
        kind: "package",
        path: dir,
        workspacePath: relativePath,
      } satisfies RepoPackageJson,
      writeProjectManifest: (
        { path, workspacePath, kind, ...pJson }: Partial<RepoPackageJson>,
        force?: boolean,
      ) =>
        writeProjectManifest(
          { ...manifest, ...(pJson as ProjectManifest) },
          force,
        ),
    };
  });
};
