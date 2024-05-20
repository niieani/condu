import { basename, dirname, join, relative, resolve } from "node:path";
import { promises as fs } from "node:fs";
import glob from "fast-glob";
import { analyze, type TTopoResult } from "toposource";
import * as yaml from "yaml";
import slash from "slash";

import type {
  ITopoOptionsNormalized,
  IDepEntry,
  IDepEntryEnriched,
  IPackageEntry,
  IPackageDeps,
  ITopoOptions,
  ITopoContext,
  IGetManifestPaths,
} from "./interface.js";
import { readProjectManifest } from "@pnpm/read-project-manifest";
import type {
  RepoPackageJson,
  WriteManifestFnOptions,
} from "@condu/core/configTypes.js";
import sortPackageJson from "sort-package-json";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";

const defaultScopes = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

export const getPackages = async (
  options: ITopoOptionsNormalized,
): Promise<Record<string, IPackageEntry>> => {
  const { pkgFilter } = options;
  const manifestsPaths = await getManifestsPaths(options);
  const entries = await Promise.all<IPackageEntry>(
    manifestsPaths.map((manifestPath) => getPackage(options.cwd, manifestPath)),
  );

  checkDuplicates(entries);

  return entries.reduce<Record<string, IPackageEntry>>((m, entry) => {
    if (pkgFilter(entry)) {
      m[entry.name] = entry;
    }
    return m;
  }, {});
};

const checkDuplicates = (named: { name: string }[]): void | never => {
  const duplicates = named
    .map((m) => m.name)
    .filter((e, i, a) => a.lastIndexOf(e) !== i);
  if (duplicates.length > 0) {
    throw new Error(`Duplicated pkg names: ${duplicates.join(", ")}`);
  }
};

export const getPackage = async (
  workspaceRootDirectory: string,
  manifestPath: string,
): Promise<IPackageEntry> => {
  const absPath = dirname(manifestPath);
  const relPath = relative(workspaceRootDirectory, absPath) || ".";
  const manifestRelPath = relative(workspaceRootDirectory, manifestPath);

  // readProjectManifest uses pnpm's types for package.json, we need to cast it to our own type
  const pnpmProjectManifestResult = await readProjectManifest(absPath);
  const manifest = pnpmProjectManifestResult.manifest as RepoPackageJson;
  const writeProjectManifest =
    pnpmProjectManifestResult.writeProjectManifest as (
      manifest: PackageJson,
      force?: boolean,
    ) => Promise<void>;

  return {
    name: manifest.name ?? basename(absPath),
    manifestRelPath,
    manifestAbsPath: manifestPath,
    manifest,
    relPath,
    absPath,
    writeProjectManifest: (
      pJson: PackageJson,
      { force, merge }: WriteManifestFnOptions = {},
    ) =>
      writeProjectManifest(
        sortPackageJson({
          ...(merge ? manifest : {}),
          ...pJson,
        }),
        force,
      ),
  };
};

export const topo = (
  packages: readonly IPackageEntry[],
  {
    depFilter = (_) => true,
    scopes = defaultScopes,
  }: Pick<ITopoOptions, "depFilter"> & { scopes?: string[] } = {},
) => {
  const { edges, nodes } = getGraph(
    packages.map((p) => p.manifest),
    depFilter,
    scopes,
  );
  const analysis = analyze([...edges, ...nodes.map<[string]>((n) => [n])]);

  return {
    edges,
    nodes,
    ...analysis,
  };
};

export const topoFromWorkspace = async (
  options: ITopoOptions = {},
): Promise<ITopoContext> => {
  const {
    cwd = process.cwd(),
    filter = (_) => true,
    pkgFilter = filter,
    depFilter = (_) => true,
    workspaces,
    workspacesExtra = [],
  } = options;
  const root = await getPackage(cwd, resolve(cwd, "package.json"));
  const _options: ITopoOptionsNormalized = {
    cwd,
    filter,
    depFilter,
    pkgFilter,
    workspacesExtra,
    workspaces: [
      ...(workspaces || (await extractWorkspaces(root))),
      ...workspacesExtra,
    ],
  };
  const packages = await getPackages(_options);
  const analysis = topo(Object.values(packages), _options);

  return {
    packages,
    root,
    ...analysis,
  };
};

export const extractWorkspaces = async (root: IPackageEntry) =>
  (Array.isArray(root.manifest.workspaces)
    ? root.manifest.workspaces
    : root.manifest.workspaces?.packages) ||
  root.manifest.bolt?.workspaces ||
  (await (async () => {
    try {
      const pnpmWsCfg = resolve(root.absPath, "pnpm-workspace.yaml");
      const contents = yaml.parse(await fs.readFile(pnpmWsCfg, "utf8")) as {
        packages: string[];
      };
      return contents.packages;
    } catch {
      return undefined;
    }
  })()) ||
  [];

export const getGraph = (
  manifests: RepoPackageJson[],
  depFilter: ITopoOptionsNormalized["depFilter"],
  scopes = defaultScopes,
): {
  nodes: string[];
  edges: [dependencyName: string, packageName: string][];
} => {
  const nodes = manifests.map(({ name }) => name).sort(deterministicSort);
  const edges = manifests
    .reduce<[string, string][]>((edges, pkg) => {
      const m = new Set();
      iterateDeps(
        pkg,
        ({ name, version, scope }) => {
          if (
            !m.has(name) &&
            nodes.includes(name) &&
            depFilter({ name, version, scope })
          ) {
            m.add(name);
            edges.push([name, pkg.name]);
          }
        },
        scopes,
      );

      return edges;
    }, [])
    .sort((a, b) => deterministicSort(a.join(), b.join()));

  return {
    edges,
    nodes,
  };
};

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/bower_components/**",
  "**/test/**",
  "**/tests/**",
];

// deterministically sort the packages by name
export const deterministicSort = <T>(a: T, b: T) =>
  a > b ? 1 : a < b ? -1 : 0;

export const getManifestsPaths = async ({
  workspaces,
  cwd,
}: IGetManifestPaths) =>
  (
    await glob(
      workspaces.map((w) => slash(join(w, "package.json"))),
      {
        cwd,
        onlyFiles: true,
        absolute: true,
        ignore: DEFAULT_IGNORE,
      },
    )
  ).sort(deterministicSort);

export const traverseQueue = async ({
  queue,
  prev,
  cb,
}: {
  queue: TTopoResult["queue"];
  prev: TTopoResult["prev"];
  cb: (name: string) => any;
}) => {
  const acc: Record<string, Promise<void>> = {};

  return Promise.all(
    queue.map(
      (name) =>
        (acc[name] = (async () => {
          await Promise.all((prev.get(name) || []).map((p) => acc[p]));
          await cb(name);
        })()),
    ),
  );
};

export const traverseDeps = async ({
  packages,
  pkg: parent,
  scopes = defaultScopes,
  cb,
}: {
  pkg: IPackageEntry;
  packages: Record<string, IPackageEntry>;
  scopes?: string[];
  cb(depEntry: IDepEntryEnriched): any;
}) => {
  const { manifest } = parent;
  const results: Promise<void>[] = [];

  iterateDeps(
    manifest,
    ({ name, version, scope, deps }) => {
      const pkg = packages[name];
      if (!pkg) return;
      results.push(
        Promise.resolve(cb({ name, version, scope, deps, pkg, parent })),
      );
    },
    scopes,
  );

  await Promise.all(results);
};

export const iterateDeps = (
  manifest: RepoPackageJson,
  cb: (ctx: IDepEntry & { deps: IPackageDeps }) => any,
  scopes = defaultScopes,
) => {
  for (const scope of scopes) {
    const deps = manifest[scope as keyof RepoPackageJson] as IPackageDeps;
    if (!deps) continue;

    for (let [name, version] of Object.entries(deps)) {
      cb({ name, version, deps, scope });
    }
  }
};
