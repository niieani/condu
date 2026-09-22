import type {
  DependencyTargetList,
  MinimalManifest,
} from "@condu/workspace-utils/packageJsonTypes.js";
import {
  ensureDependencyIn,
  type DependencyResolver,
} from "../../ensureDependency.js";
import type { DependencyDefinition } from "./CollectedState.js";

const dependencyLists = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const satisfies readonly DependencyTargetList[];

/** Reconcile the complete desired set without mutating the input manifest. */
export async function reconcileDependencies<Manifest extends MinimalManifest>({
  manifest,
  dependencies,
  resolve,
}: {
  manifest: Manifest;
  dependencies: readonly DependencyDefinition[];
  resolve?: DependencyResolver;
}): Promise<{
  manifest: Manifest;
  stats: { changed: number; removed: number };
}> {
  const desired = collectDesiredDependencies(dependencies);
  const staged = structuredClone(manifest);
  const previouslyOwned = new Set(
    Object.keys(manifest.condu?.managedDependencies ?? {}),
  );
  const changed = new Set<string>();
  let removed = 0;

  for (const [alias, declarations] of desired) {
    const desiredLists = new Set(declarations.map(({ list }) => list));
    const ownsAlias = declarations[0]!.managed !== false;
    if (
      ownsAlias &&
      !previouslyOwned.has(alias) &&
      declarations.every(({ skipIfExists }) => skipIfExists) &&
      dependencyLists.some((list) => manifest[list]?.[alias] !== undefined) &&
      declarations.some(({ list }) => manifest[list]?.[alias] === undefined)
    ) {
      throw new Error(
        `Cannot take ownership of ${alias} in another dependency list. ` +
          "Use managed: false to retain user ownership or skipIfExists: false to explicitly adopt the alias.",
      );
    }
    // Ownership is currently stored per installed name. Preserve the descriptor
    // while relocating owned dependencies, and leave unmanaged placements alone.
    const previousDescriptor = previouslyOwned.has(alias)
      ? dependencyLists.map((list) => manifest[list]?.[alias]).find(Boolean)
      : undefined;

    for (const definition of declarations) {
      if (
        ownsAlias &&
        previousDescriptor &&
        !staged[definition.list]?.[alias] &&
        (definition.skipIfExists || definition.managed === "presence")
      ) {
        (staged[definition.list] ??= {})[alias] = previousDescriptor;
        changed.add(alias);
      }
      if (await ensureDependencyIn(staged, definition, resolve)) {
        changed.add(alias);
      }
    }

    if (ownsAlias && staged.condu?.managedDependencies?.[alias]) {
      for (const list of dependencyLists) {
        if (!desiredLists.has(list) && staged[list]?.[alias] !== undefined) {
          delete staged[list][alias];
          changed.add(alias);
        }
      }
    }
  }

  for (const alias of previouslyOwned) {
    if (desired.has(alias)) continue;
    for (const list of dependencyLists) {
      if (staged[list]) delete staged[list][alias];
    }
    delete staged.condu?.managedDependencies?.[alias];
    removed += 1;
  }

  return { manifest: staged, stats: { changed: changed.size, removed } };
}

function collectDesiredDependencies(
  dependencies: readonly DependencyDefinition[],
) {
  const desired = new Map<string, ReturnType<typeof normalizeDependency>[]>();
  for (const dependency of dependencies) {
    const normalized = normalizeDependency(dependency);
    const alias = normalized.installAsAlias;
    const previous = desired.get(alias) ?? [];
    const existing = previous.find(({ list }) => list === normalized.list);
    if (
      previous.some(
        ({ managed, name }) =>
          managed !== normalized.managed || name !== normalized.name,
      ) ||
      (existing && JSON.stringify(existing) !== JSON.stringify(normalized))
    ) {
      throw new Error(`Conflicting dependency declarations for ${alias}`);
    }
    if (!existing) previous.push(normalized);
    desired.set(alias, previous);
  }
  return desired;
}

function normalizeDependency(dependency: DependencyDefinition) {
  return {
    name: dependency.name,
    installAsAlias: dependency.installAsAlias ?? dependency.name,
    list: dependency.list ?? "devDependencies",
    managed: dependency.managed ?? "presence",
    skipIfExists: dependency.skipIfExists ?? true,
    rangePrefix: dependency.rangePrefix ?? "^",
    built: dependency.built ?? false,
    ...(dependency.version !== undefined
      ? { version: dependency.version }
      : { tag: dependency.tag ?? "latest" }),
  } satisfies DependencyDefinition;
}
