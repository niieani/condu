import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import type { WorkspaceManifest } from "@pnpm/workspace.read-manifest";
import type { PnpmConfig } from "./npmrcType.js";
import { parse, stringify } from "ini";

interface PnpmFeatureConfig {
  workspace?: Omit<WorkspaceManifest, "packages">;
  npmrc?: PnpmConfig;
}

declare module "condu" {
  interface PeerContext {
    pnpm: Required<PnpmFeatureConfig>;
  }
}

// TODO: there should be a npmrc feature and pnpm depends on it, contributing to it's peerContext
export const pnpm = (config: PnpmFeatureConfig = {}) =>
  defineFeature("pnpm", {
    initialPeerContext: {
      workspace: config.workspace ?? {},
      npmrc: config.npmrc ?? {},
    },

    defineRecipe(condu, { workspace, npmrc }) {
      if (condu.project.projectConventions || workspace) {
        const conventions = condu.project.projectConventions ?? [];
        condu.root.generateFile("pnpm-workspace.yaml", {
          content: {
            packages: conventions.map(({ glob }) => glob).sort(),
            ...workspace,
          } satisfies WorkspaceManifest,
          attributes: {
            gitignore: false,
          },
        });
      }

      if (npmrc) {
        condu.root.modifyUserEditableFile<".npmrc", PnpmConfig>(".npmrc", {
          content: ({ content }) => {
            return {
              // apply some defaults
              "patches-dir": `${CONDU_CONFIG_DIR_NAME}/patches`,
              registry: condu.project.config.publish?.registry,
              ...content,
              ...npmrc,
            };
          },
          ifNotExists: "create",
          parse: (content): PnpmConfig =>
            parse(content, { bracketedArray: true }),
          stringify: (content) =>
            stringify(removeUndefinedValues(content), { bracketedArray: true }),
        });
      }
    },
  });

function removeUndefinedValues<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined),
  ) as T;
}
