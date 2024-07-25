import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "@condu/core/utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";
import type {
  DependencyDef,
  PackageJsonConduSection,
} from "@condu/types/configTypes.js";

const registry = "https://registry.npmjs.org/";
const { resolveFromNpm } = createNpmResolver(
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

export async function ensureDependency({
  packageAlias,
  manifest,
  versionOrTag = "latest",
  target = "dependencies",
  skipIfExists = true,
  managed = "presence",
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
    throw new Error(`no ${packageAlias} dependency found in the NPM registry`);
  }

  const pkgDescriptor = `${
    dependency.manifest.name !== packageAlias
      ? `npm:${dependency.manifest.name}@`
      : ""
  }^${dependency.manifest.version}`;
  if (targetDependencyList[packageAlias] === pkgDescriptor) {
    // TODO: should we add to managed list
    // if the expected version is the same as the one already in the manifest?
    return false;
  }
  targetDependencyList[packageAlias] = pkgDescriptor;

  if (managed) {
    const managedDependencies = ensureManagedDependenciesSection(manifest);
    managedDependencies[packageAlias] = managed;
  }

  return true;
}

function ensureManagedDependenciesSection(manifest: PackageJson) {
  let conduSection = ensureConduSection(manifest);
  let managedDependencies = conduSection["managedDependencies"];
  if (typeof managedDependencies !== "object" || !managedDependencies) {
    managedDependencies = conduSection["managedDependencies"] = {};
  }
  return managedDependencies;
}

function ensureConduSection(manifest: PackageJson): PackageJsonConduSection {
  let conduSection = manifest["condu"];
  if (typeof conduSection !== "object" || !conduSection) {
    conduSection = manifest["condu"] = {};
  }
  return conduSection;
}
