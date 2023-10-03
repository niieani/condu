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
          // will need to use lerna's --directory flag to publish when building to a temp folder
          // earlier option was the publishFolder, which is now deprecated,
          // when the build is within the package's folder, e.g. only contents of 'build' will be published
          // publishFolder
        } satisfies INpmConfig,
      ],
    ],
  };
}
