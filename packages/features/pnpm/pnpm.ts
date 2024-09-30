import { defineFeature } from "condu/defineFeature.js";
import type { WorkspaceManifest } from "@pnpm/workspace.read-manifest";
import type { PnpmConfig } from "./npmrcType.js";
import { parse, stringify } from "ini";

export const pnpm = ({
  workspace,
  npmrc,
}: {
  workspace?: Omit<WorkspaceManifest, "packages">;
  npmrc?: PnpmConfig;
} = {}) =>
  defineFeature({
    name: "pnpm",
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            {
              path: "pnpm-workspace.yaml",
              type: "committed",
              content: {
                packages: (config.project.projectConventions ?? [])
                  .map(({ glob }) => glob)
                  .sort(),
                ...workspace,
              } satisfies WorkspaceManifest,
            },
            npmrc && {
              path: ".npmrc",
              content: async ({
                getExistingContentAndMarkAsUserEditable,
              }): Promise<string> => {
                const ini =
                  (await getExistingContentAndMarkAsUserEditable()) as string;
                const parsed = ini ? parse(ini, { bracketedArray: true }) : {};
                const updated: PnpmConfig = {
                  // apply some defaults
                  "patches-dir": ".config/patches",
                  ...parsed,
                  ...npmrc,
                };
                return stringify(updated, { bracketedArray: true });
              },
            },
          ],
        },
      ],
    }),
  });
