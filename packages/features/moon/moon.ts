import {
  defineFeature,
  getYamlParseAndStringify,
  getMoonWorkspaceProjectsFromConventionConfig,
  CONDU_CONFIG_DIR_NAME,
  CONDU_CONFIG_FILE_NAME,
} from "condu";
import type {
  PartialVcsConfig,
  PartialToolchainConfig as Toolchain,
  PartialWorkspaceConfig as Workspace,
  PartialInheritedTasksConfig as Tasks,
} from "@moonrepo/types";

import { otherSchemas as schemas } from "@condu/schema-types/utils/schemas.js";
import { defaultToolchain } from "./defaultToolchain.js";

declare module "condu" {
  interface PeerContext {
    moon: MoonPeerContext;
  }
  interface FileNameToSerializedTypeMapping {
    ".moon/toolchain.yml": Toolchain;
    ".moon/workspace.yml": Workspace;
    ".moon/tasks.yml": Tasks;
  }
}

interface MoonPeerContext {
  toolchain: Toolchain;
  workspace: Omit<Workspace, "projects" | "vcs"> & {
    /** projects should be defined in the top-level config */
    projects?: never;
    vcs?: Omit<PartialVcsConfig, "defaultBranch">;
  };
}

type MoonConfig = Partial<MoonPeerContext>;

export const moon = (config: MoonConfig = {}) =>
  defineFeature("moon", {
    initialPeerContext: {
      toolchain: {
        ...defaultToolchain,
        ...config.toolchain,
      },
      workspace: {
        ...config.workspace,
      },
    },
    defineRecipe(condu, { toolchain, workspace }) {
      const config = condu.project.config;
      const moonWorkspaceProjects =
        getMoonWorkspaceProjectsFromConventionConfig(config.projects);

      const sourceExtensionsConcatenated =
        config.conventions.sourceExtensions.join(",");

      condu.root.ensureDependency("@moonrepo/cli", { built: true });
      condu.root.ignoreFile(".moon/");
      condu.root.ignoreFile(".moon/cache");
      condu.root.ignoreFile(".moon/docker");

      condu.root.generateFile(".moon/toolchain.yml", {
        ...getYamlParseAndStringify<Toolchain>(),
        content: {
          $schema: schemas.toolchain,
          ...toolchain,
          ...(config.projects && {
            typescript: {
              // TODO: implement references sync in condu, so we don't depend on moon for it:
              // syncProjectReferences: true,
              // syncProjectReferencesToPaths: true,
              // createMissingConfig: true,
              rootOptionsConfigFileName: "tsconfig.options.json",
              ...toolchain.typescript,
            },
          }),
          node: {
            packageManager: config.node.packageManager.name,
            ...toolchain.node,
          },
        },
      });

      condu.root.generateFile(".moon/workspace.yml", {
        ...getYamlParseAndStringify<Workspace>(),
        content: {
          $schema: schemas.workspace,
          ...workspace,
          projects: {
            ...moonWorkspaceProjects,
            sources: {
              ...moonWorkspaceProjects.sources,
              [condu.project.name]: ".",
            },
          },
          vcs: {
            defaultBranch: config.git.defaultBranch,
            ...workspace?.vcs,
          },
          // hasher: {
          //   ignorePatterns: [
          //     `${config.conventions.buildDir}/**`,
          //     ...(workspace?.hasher?.ignorePatterns ?? []),
          //   ],
          // },
        },
      });

      condu.root.generateFile(".moon/tasks.yml", {
        ...getYamlParseAndStringify<Tasks>(),
        content: {
          $schema: schemas.tasks,
          fileGroups: {
            sources: [
              `${config.conventions.sourceDir}/**/*.{${sourceExtensionsConcatenated}}`,
            ],
            tests: [
              `${config.conventions.sourceDir}/**/*.test.{${sourceExtensionsConcatenated}}`,
            ],
          },
          implicitInputs: [
            // workspace relative config changes should invalidate all caches
            `/${CONDU_CONFIG_DIR_NAME}/${CONDU_CONFIG_FILE_NAME}`,
          ],
        },
      });
    },
  });
