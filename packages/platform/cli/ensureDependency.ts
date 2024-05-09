// import semver from "semver";
import { readProjectManifest } from "@pnpm/read-project-manifest";
import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "@condu/core/utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import * as path from "node:path";
import { findUp } from "@condu/core/utils/findUp.js";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";
import type {
  DependencyDef,
  RepoPackageJson,
  WriteManifestFnOptions,
} from "@condu/core/configTypes.js";
import type { ProjectManifest } from "@pnpm/types";
import sortPackageJson from "sort-package-json";

const registry = "https://registry.npmjs.org/";
const resolveFromNpm = createNpmResolver(
  createFetchFromRegistry({}),
  // async (url) => {
  //   // @ts-expect-error pnpm types are wrong, it used node-fetch internally which isn't necessary
  //   const result: Promise<import("node-fetch").Response> = fetch(url);
  //   return result;
  // },
  createGetAuthHeaderByURI({ allSettings: {} }),
  // (uri) => {
  //   return undefined;
  // },
  { offline: false, cacheDir: getCacheDir(process) },
);

export async function getManifest(cwd: string) {
  const manifestPath = await findUp(
    [
      "package.json",
      "package.json5",
      "package.yaml",
      // "yarn.lock",
      // "package-lock.json",
      // "pnpm-workspace.yaml",
      // "pnpm-lock.yaml",
    ],
    { cwd },
  );
  const projectDir = manifestPath ? path.dirname(manifestPath) : cwd;

  const { manifest, writeProjectManifest, ...manifestWrapper } =
    await readProjectManifest(projectDir);
  return {
    ...manifestWrapper,
    manifest: {
      ...(manifest as PackageJson),
      name: manifest.name ?? path.basename(projectDir),
      kind: "workspace",
      path: projectDir,
      workspacePath: ".",
    } satisfies RepoPackageJson,
    writeProjectManifest: (
      {
        // omit these internal fields (see RepoPackageJson type):
        path,
        kind,
        workspacePath,
        // and keep the rest of package.json:
        ...pJson
      }: Partial<RepoPackageJson>,
      { force, merge }: WriteManifestFnOptions = {},
    ) =>
      writeProjectManifest(
        sortPackageJson({
          ...(merge ? manifest : {}),
          ...(pJson as ProjectManifest),
        }),
        force,
      ),
    projectDir,
  };
}

export async function ensureDependency({
  packageAlias,
  manifest,
  versionOrTag = "latest",
  target = "dependencies",
  skipIfExists = true,
}: DependencyDef & {
  manifest: PackageJson;
}) {
  const targetDependencyList = (manifest[target] ||= {});
  if (skipIfExists && targetDependencyList[packageAlias]) {
    return false;
  }
  const dependency = await resolveFromNpm(
    { alias: packageAlias, pref: versionOrTag },
    { registry },
  );
  if (!dependency || !dependency.manifest) {
    throw new Error(`no ${packageAlias} dependency found in the repository`);
  }

  const pkgDescriptor = `${
    dependency.manifest.name !== packageAlias
      ? `npm:${dependency.manifest.name}@`
      : ""
  }^${dependency.manifest.version}`;
  if (targetDependencyList[packageAlias] === pkgDescriptor) {
    return false;
  }
  targetDependencyList[packageAlias] = pkgDescriptor;
  return true;
}
