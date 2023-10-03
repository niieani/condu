import type { AutoRc } from "auto";
import type { INpmConfig } from "@auto-it/npm";

/** Auto configuration */
export default function rc(): AutoRc {
  return {
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
}
