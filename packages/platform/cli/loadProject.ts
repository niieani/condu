/// <reference path="./async-memoize-one.d.ts" />

import * as path from "node:path";
import { getManifest } from "./ensureDependency.js";
import { CORE_NAME } from "@condu/core/constants.js";
import {
  CONFIGURED,
  type ConfiguredRepoConfig,
  type RepoConfigWithInferredValues,
  type RepoPackageJson,
} from "@condu/core/configTypes.js";
import {
  getProjectDefinitionsFromConventionConfig,
  type WorkspaceProjectDefined,
} from "../core/utils/getProjectGlobsFromMoonConfig.js";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import memoizeOne from "async-memoize-one";
import type { ProjectManifest } from "@pnpm/types";
import {
  CONFIG_DIR,
  DEFAULT_NODE_VERSION,
  DEFAULT_PACKAGE_MANAGER,
  DEFAULT_SOURCE_EXTENSIONS,
} from "./commands/apply/constants.js";
import { getDefaultGitBranch } from "@condu/core/utils/getDefaultGitBranch.js";
import sortPackageJson from "sort-package-json";
import type {
  WorkspacePackage,
  LoadConfigOptions,
  WriteManifestFnOptions,
} from "@condu/core/configTypes.js";

export interface Project
  extends WorkspacePackage,
    Omit<
      Awaited<ReturnType<typeof getManifest>>,
      "fileName" | "manifest" | "writeProjectManifest"
    > {
  projectConventions: WorkspaceProjectDefined[];
  /** absolute path to the project */
  projectDir: string;
  config: RepoConfigWithInferredValues;
  getWorkspacePackages: () => Promise<readonly WorkspacePackage[]>;
}

export async function loadRepoProject({
  startDir = process.cwd(),
}: LoadConfigOptions = {}): Promise<Project | undefined> {
  const { manifest, writeProjectManifest, projectDir } =
    await getManifest(startDir);
  const configFile = path.join(projectDir, `.config`, `${CORE_NAME}.ts`);
  const importedConfigFile = await import(
    /* webpackIgnore: true */
    configFile
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

  const defaultBranch: string =
    config.git?.defaultBranch ?? (await getDefaultGitBranch(projectDir));
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
    workspaceDir: projectDir,
    configDir: path.join(projectDir, CONFIG_DIR),
  } as const;

  const project: Project = {
    manifest,
    writeProjectManifest,
    projectDir,
    projectConventions,
    dir: ".",
    config: configWithInferredValues,
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
        name: manifest.name ?? path.basename(dir),
        kind: "package",
        path: dir,
        workspacePath: relativePath,
      } satisfies RepoPackageJson,
      writeProjectManifest: (
        { path, workspacePath, kind, ...pJson }: Partial<RepoPackageJson>,
        { force, merge }: WriteManifestFnOptions = {},
      ) =>
        writeProjectManifest(
          sortPackageJson({
            ...(merge ? manifest : {}),
            ...(pJson as ProjectManifest),
          }),
          force,
        ),
    };
  });
};
