import * as path from "node:path";
import { findUp } from "@condu/core/utils/findUp.js";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";
import type {
  RepoPackageJson,
  WorkspaceRootPackage,
  WriteManifestFnOptions,
} from "@condu/core/configTypes.js";
import type { ProjectManifest } from "@pnpm/types";
import sortPackageJson from "sort-package-json";
import { topoFromWorkspace } from "@condu/workspace-utils/topo.js";
import * as fs from "node:fs";
import {
  CONDU_CONFIG_DIR_NAME,
  CONDU_CONFIG_FILE_NAME,
} from "@condu/core/constants.js";

export async function getManifest(cwd: string): Promise<WorkspaceRootPackage> {
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
    { cwd, type: "directory" },
  );
  const workspaceDir = configDirPath ? path.dirname(configDirPath) : cwd;
  const configFilePath = path.join(
    workspaceDir,
    CONDU_CONFIG_DIR_NAME,
    CONDU_CONFIG_FILE_NAME,
  );

  // const root = await getPackage();
  const topology = await topoFromWorkspace({ cwd: workspaceDir });

  return {
    kind: "workspace",
    ...topology.root,
  };
}
