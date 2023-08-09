import { $ as $$, spinner } from "zx";
// import semver from "semver";
import { readProjectManifest } from "@pnpm/read-project-manifest";
import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "./utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import type { ProjectManifest } from "@pnpm/types";
import path from "path";
import { findUp } from "./utils/findUp.js";

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

// wrapper that makes the io 'inherit' by default
const $ = (pieces: TemplateStringsArray, ...args: unknown[]) =>
  $$(pieces, ...args).stdio("inherit", "inherit", "inherit");

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

  return readProjectManifest(projectDir);
}

export async function ensureDependency({
  packageName,
  manifest,
  versionOrTag = "latest",
  target = "dependencies",
  skipIfExists = true,
}: {
  packageName: string;
  versionOrTag?: string;
  target?: "dependencies" | "devDependencies" | "optionalDependencies";
  skipIfExists?: boolean;
  manifest: ProjectManifest;
}) {
  const targetDependencyList = (manifest[target] ||= {});
  if (skipIfExists && targetDependencyList[packageName]) {
    return false;
  }
  const dependency = await resolveFromNpm(
    { alias: "lodash", pref: versionOrTag },
    { registry },
  );
  if (!dependency || !dependency.manifest) {
    throw new Error(`no ${packageName} dependency found in the repository`);
  }
  console.log(dependency.id);

  const pkgDescriptor = `^${dependency.manifest.version}`;
  if (targetDependencyList[packageName] === pkgDescriptor) {
    return false;
  }
  targetDependencyList[packageName] = pkgDescriptor;
  return true;
}
