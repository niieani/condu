import type { AutoRc } from "auto";
import type { INpmConfig } from "@auto-it/npm";
const { defaultLabels } =
  require("@auto-it/core") as typeof import("@auto-it/core");

/** Auto configuration */
export = function rc(): AutoRc {
  return {
    labels: defaultLabels.map((label) => ({
      ...label,
      // prefix the default labels, so they don't conflict with default dependabot labels
      name: `version: ${label.name}`,
    })),
    plugins: [
      "released",
      [
        "npm",
        {
          exact: true,
          // best not to set the deprecated 'publishFolder' here
          // instead configure 'publish.directory' in lerna.json
        } satisfies INpmConfig,
      ],
    ],
  };
};
