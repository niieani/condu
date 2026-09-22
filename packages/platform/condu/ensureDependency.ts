import { createNpmResolver } from "@pnpm/npm-resolver";
import { getCacheDir } from "@condu/core/utils/dirs.js";
import { createFetchFromRegistry } from "@pnpm/fetch";
import { createGetAuthHeaderByURI } from "@pnpm/network.auth-header";
import type {
  MinimalManifest,
  PackageJsonConduSection,
} from "@condu/workspace-utils/packageJsonTypes.js";
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
  {
    offline: false,
    cacheDir: getCacheDir(process),
    registries: { default: registry },
  },
);

export type DependencyResolver = (dependency: {
  name: string;
  tag?: string;
}) => Promise<{ name: string; version: string }>;

const resolveDependency: DependencyResolver = async ({ name, tag }) => {
  const dependency = await resolveFromNpm(
    { alias: name, bareSpecifier: tag },
    {},
  );
  if (!dependency?.manifest) {
    throw new Error(`no ${name} dependency found in the NPM registry`);
  }
  return dependency.manifest;
};

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
    built = false,
    ...opts
  }: DependencyDefinition,
  resolve: DependencyResolver = resolveDependency,
): Promise<boolean> {
  let changed = false;
  if (
    (manifest.pnpm || manifest.packageManager?.startsWith("pnpm@")) &&
    built
  ) {
    const pnpm = (manifest.pnpm ??= {});
    const onlyBuiltDependencies = (pnpm.onlyBuiltDependencies ??= []);
    if (!onlyBuiltDependencies.includes(installAsAlias)) {
      onlyBuiltDependencies.push(installAsAlias);
      changed = true;
    }
  }

  const targetDependencyList = (manifest[list] ??= {});
  const existingVersion = targetDependencyList[installAsAlias];
  if (!existingVersion || (!skipIfExists && managed !== "presence")) {
    const dependency = opts.version
      ? { name, version: opts.version }
      : await resolve({ name, tag: opts.tag });
    const pkgDescriptor = `${
      dependency.name !== installAsAlias ? `npm:${dependency.name}@` : ""
    }${rangePrefix}${dependency.version}`;
    if (existingVersion !== pkgDescriptor) {
      targetDependencyList[installAsAlias] = pkgDescriptor;
      changed = true;
    }
  }

  const previousOwnership = manifest.condu?.managedDependencies;
  const wasManaged = previousOwnership?.[installAsAlias];
  if (managed && (!existingVersion || !skipIfExists || wasManaged)) {
    const managedDependencies = ensureManagedDependenciesSection(manifest);
    if (managedDependencies[installAsAlias] !== managed) {
      managedDependencies[installAsAlias] = managed;
      changed = true;
    }
  } else if (!managed && previousOwnership?.[installAsAlias]) {
    delete previousOwnership[installAsAlias];
    changed = true;
  }
  return changed;
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
