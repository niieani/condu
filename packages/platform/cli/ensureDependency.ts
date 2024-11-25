import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "@condu/core/utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import type {
  DependencyDef,
  MinimalManifest,
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

/**
 * Mutates the manifest to ensure the dependency is present.
 * @returns true if the manifest was changed.
 */
export async function ensureDependencyIn(
  manifest: MinimalManifest,
  {
    name,
    installAsAlias = name,
    list = "dependencies",
    skipIfExists = true,
    managed = "presence",
    rangePrefix = "^",
    ...opts
  }: DependencyDef,
): Promise<boolean> {
  const targetDependencyList = (manifest[list] ||= {});
  if (skipIfExists && targetDependencyList[installAsAlias]) {
    return false;
  }
  const dependency =
    "tag" in opts && opts.tag
      ? await resolveFromNpm({ alias: name, pref: opts.tag }, { registry })
      : {
          manifest: {
            name,
            version: opts.version,
          },
        };
  if (!dependency || !dependency.manifest) {
    throw new Error(`no ${name} dependency found in the NPM registry`);
  }

  const pkgDescriptor = `${
    dependency.manifest.name !== installAsAlias
      ? `npm:${dependency.manifest.name}@`
      : ""
  }${rangePrefix}${dependency.manifest.version}`;
  if (targetDependencyList[installAsAlias] === pkgDescriptor) {
    // TODO: should we add to managed list
    // if the expected version is the same as the one already in the manifest?
    return false;
  }
  targetDependencyList[installAsAlias] = pkgDescriptor;

  if (managed) {
    const managedDependencies = ensureManagedDependenciesSection(manifest);
    managedDependencies[installAsAlias] = managed;
  }

  return true;
}

export function ensureManagedDependenciesSection(manifest: MinimalManifest) {
  const conduSection = ensureConduSection(manifest);
  let managedDependencies = conduSection.managedDependencies;
  if (typeof managedDependencies !== "object" || !managedDependencies) {
    managedDependencies = conduSection.managedDependencies = {};
  }
  return managedDependencies;
}

export function ensureConduSection(
  manifest: MinimalManifest,
): PackageJsonConduSection {
  let conduSection = manifest.condu;
  if (typeof conduSection !== "object" || !conduSection) {
    conduSection = manifest.condu = {};
  }
  return conduSection;
}
