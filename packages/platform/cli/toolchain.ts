import { spinner } from "zx";
// import semver from "semver";
import { readProjectManifest } from "@pnpm/read-project-manifest";
import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "@repo/core/utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import path from "path";
import { findUp } from "@repo/core/utils/findUp.js";
import { $ } from "./zx.js";
import type PackageJson from "@repo/schema-types/schemas/packageJson.js";
import type { DependencyDef, RepoPackageJson } from "@repo/core/configTypes.js";
import type { ProjectManifest } from "@pnpm/types";

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

async function setup() {
  await $`yarn config set nodeLinker node-modules`;
}

// await $`yarn`;
// await spinner("waiting", () => $`sleep 5`);

// const cwd = process.cwd();
// const {
//   manifest,
//   fileName: manifestPath,
//   writeProjectManifest,
// } = await getManifest(cwd);
// console.log(manifestPath);

// // await ensureDependency({ packageName: "lodash", manifest });

// // await writeProjectManifest(manifest);
// await $`echo done`;

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
      kind: "workspace",
      path: projectDir,
      workspacePath: ".",
    } satisfies RepoPackageJson,
    writeProjectManifest: (
      { path, kind, ...pJson }: Partial<RepoPackageJson>,
      force?: boolean,
    ) =>
      writeProjectManifest(
        { ...manifest, ...(pJson as ProjectManifest) },
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
