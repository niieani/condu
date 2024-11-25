import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "@condu/core/utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import type {
  MinimalManifest,
  PackageJsonConduSection,
} from "./commands/apply/ConduPackageEntry.js";
import type { DependencyDefinition } from "./commands/apply/CollectedState.js";

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
 */
export async function ensureDependencyIn(
  manifest: MinimalManifest,
  {
    name,
    installAsAlias = name,
    list = "devDependencies",
    managed = "presence",
    skipIfExists = true,
    rangePrefix = "^",
    ...opts
  }: DependencyDefinition,
): Promise<void> {
  const targetDependencyList = (manifest[list] ||= {});
  const existingVersion = targetDependencyList[installAsAlias];
  if (skipIfExists && existingVersion) {
    return;
  }
  const dependency =
    managed === "presence" && existingVersion
      ? { manifest: { name, version: existingVersion } }
      : "tag" in opts && opts.tag
        ? await resolveFromNpm({ alias: name, pref: opts.tag }, { registry })
        : { manifest: { name, version: opts.version } };

  if (!dependency?.manifest) {
    throw new Error(`no ${name} dependency found in the NPM registry`);
  }

  const pkgDescriptor = `${
    dependency.manifest.name !== installAsAlias
      ? `npm:${dependency.manifest.name}@`
      : ""
  }${rangePrefix}${dependency.manifest.version}`;
  targetDependencyList[installAsAlias] = pkgDescriptor;

  if (managed) {
    const managedDependencies = ensureManagedDependenciesSection(manifest);
    managedDependencies[installAsAlias] = managed;
  }
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
