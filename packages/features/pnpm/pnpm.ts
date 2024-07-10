import { defineFeature } from "condu/defineFeature.js";
import type { WorkspaceManifest } from "@pnpm/workspace.read-manifest";

export const pnpm = ({
  workspace,
}: { workspace?: Omit<WorkspaceManifest, "packages"> } = {}) =>
  defineFeature({
    name: "pnpm",
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            {
              path: "pnpm-workspace.yaml",
              content: {
                packages: config.project.projectConventions
                  .map(({ glob }) => glob)
                  .sort(),
                ...workspace,
              } satisfies WorkspaceManifest,
            },
          ],
        },
      ],
    }),
  });
