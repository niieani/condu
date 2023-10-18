import fs from "fs/promises";
import path from "path";
import { ensureDependency } from "./toolchain.js";
import type {
  CollectedFileDef,
  CollectedState,
  DependencyDef,
  FileDef,
  RepoConfigWithInferredValues,
  RepoPackageJson,
  StateFlags,
} from "@repo/core/configTypes.js";
import { groupBy, equals } from "remeda";
import { findWorkspacePackagesNoCheck } from "@pnpm/workspace.find-packages";
import { type LoadConfigOptions, loadRepoProject } from "./loadProject.js";
import { getDefaultGitBranch } from "@repo/core/utils/getDefaultGitBranch.js";
import yaml from "yaml";
import { nonEmpty } from "@repo/core/utils/filter.js";
import { P, isMatching, match } from "ts-pattern";
import { printUnifiedDiff } from "print-diff";
import readline from "node:readline/promises";

export async function collectState(
  config: RepoConfigWithInferredValues,
): Promise<CollectedState> {
  const state: CollectedState = {
    files: [],
    devDependencies: [],
    tasks: [],
  };

  const { project } = config;
  // TODO: topo-sort features by `order` config

  const flags: { [K in keyof StateFlags]?: string } = {};

  for (const feature of config.features) {
    // const featureConfig = feature.order;
    const featureState = await feature.actionFn(config, state);
    if (featureState.files) {
      const flattenedFiles = (
        await Promise.all(
          featureState.files.map(async (file): Promise<CollectedFileDef[]> => {
            if (!file) return [];
            const matchPackage = file.matchPackage;
            if (!matchPackage) {
              return [
                {
                  ...file,
                  targetDir: ".",
                  target: project.manifest,
                  featureName: feature.name,
                },
              ];
            }
            const packages = [
              ...(await project.getWorkspacePackages()),
              project,
            ];
            const isMatchingPackage = isMatching(matchPackage);
            const matchAllPackages =
              Object.keys(matchPackage).length === 1 &&
              "kind" in matchPackage &&
              matchPackage.kind === "package";

            // TODO: check if any packages matched and maybe add a warning if zero matches?
            const matches = packages.flatMap((pkg) =>
              isMatchingPackage(pkg.manifest)
                ? [
                    {
                      ...file,
                      targetDir: pkg.dir,
                      target: pkg.manifest,
                      featureName: feature.name,
                      skipIgnore: matchAllPackages,
                    },
                  ]
                : [],
            );

            return matchAllPackages
              ? [
                  ...matches,
                  // this one is used by the gitignore-like features, as it doesn't contain 'content'
                  ...project.projectConventions.map((convention) => ({
                    path: file.path,
                    publish: file.publish,
                    type: file.type,
                    featureName: feature.name,
                    targetDir: convention.glob,
                    target: project.manifest,
                  })),
                ]
              : matches;
          }),
        )
      ).flat();
      state.files.push(...flattenedFiles);
    }
    if (featureState.tasks) {
      if (flags.preventAdditionalTasks) {
        console.warn(
          `Feature ${feature.name} adds tasks, but the previously evaluated ${flags.preventAdditionalTasks} feature set the 'preventAdditionalTasks' flag already. This is likely due to the order of features being incorrect.`,
        );
      }
      state.tasks.push(...featureState.tasks.filter(nonEmpty));
    }
    if (featureState.devDependencies) {
      state.devDependencies.push(
        ...featureState.devDependencies.filter(nonEmpty),
      );
    }
    if (featureState.flags) {
      for (const key of featureState.flags) {
        // first feature to set a flag wins
        flags[key] ||= feature.name;
      }
    }
  }

  // TODO: store file list, tasks and dependencies in a git-committed file, so that any removals/upgrades can be flagged as changes during diffing
  // e.g. .config/toolchain/.files
  // e.g. .config/toolchain/.dependencies // automatically updated when doing 'yarn add' so that it's compatible with dep. auto-updaters
  // TODO: also store version of each feature, so that we can detect if a feature has been upgraded

  return state;
}

const stringify = (obj: unknown, filePath: string) =>
  filePath.match(/\.ya?ml$/i)
    ? yaml.stringify(obj)
    : JSON.stringify(obj, null, 2);

interface WrittenFile {
  path: string;
  content: string;
  writtenAt: number;
}

interface CachedWrittenFile extends WrittenFile {
  manuallyChanged?:
    | {
        at: number;
        content: string;
      }
    | "deleted";
}

const writeFileFromDef = async ({
  file,
  rootDir,
  manifest,
  projectDir,
  previouslyWrittenFiles,
}: {
  file: FileDef;
  rootDir: string;
  manifest: RepoPackageJson;
  projectDir: string;
  previouslyWrittenFiles: Map<string, CachedWrittenFile>;
}): Promise<(() => Promise<WrittenFile>) | WrittenFile | undefined> => {
  const targetPath = path.join(rootDir, file.path);
  const pathFromProjectDir = path.relative(projectDir, targetPath);

  const previouslyWritten = previouslyWrittenFiles.get(pathFromProjectDir);
  // marking as handled:
  previouslyWrittenFiles.delete(pathFromProjectDir);

  const resolvedContent =
    typeof file.content === "function"
      ? ((await file.content(manifest)) as string | object | undefined)
      : file.content;

  if (typeof resolvedContent === "undefined") {
    if (previouslyWritten) {
      console.log(`Deleting, no longer needed: ${pathFromProjectDir}`);
      await fs.rm(targetPath);
    }
    // nothing to add to cache state:
    return;
  }
  const content =
    typeof resolvedContent === "string"
      ? resolvedContent
      : stringify(resolvedContent, file.path);

  if (
    previouslyWritten &&
    !previouslyWritten.manuallyChanged &&
    content === previouslyWritten.content
  ) {
    console.log(`Already fresh: ${pathFromProjectDir}`);
    return previouslyWritten;
  }

  if (typeof previouslyWritten?.manuallyChanged === "object") {
    const manuallyChanged = previouslyWritten.manuallyChanged;
    // this needs to happen sequentially, because we're prompting the user for input:
    return async () => {
      console.log(`Manual changes present in ${pathFromProjectDir}:`);
      printUnifiedDiff(manuallyChanged.content, content, process.stdout);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      const rawAnswer = await rl.question(
        "Do you want to overwrite the file? (y/n)",
      );
      rl.close();
      const shouldOverwrite = match(rawAnswer)
        .with(P.union("y", "Y", P.string.regex(/yes/i)), () => true)
        .otherwise(() => false);

      if (shouldOverwrite) {
        return write({ targetPath, content, pathFromProjectDir });
      } else {
        console.log(`Skipping: ${pathFromProjectDir}`);
        return {
          path: file.path,
          writtenAt: previouslyWritten.writtenAt,
          content: previouslyWritten.content,
        };
      }
    };
  }

  return write({ targetPath, content, pathFromProjectDir });
};

async function write({
  targetPath,
  content,
  pathFromProjectDir,
}: {
  targetPath: string;
  content: string;
  pathFromProjectDir: string;
}): Promise<WrittenFile> {
  console.log(`Writing: ${targetPath}`);
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(targetPath, content);
  const stat = await fs.stat(targetPath);
  const result: WrittenFile = {
    path: pathFromProjectDir,
    content,
    writtenAt: stat.mtimeMs,
  };
  return result;
}

export async function writeFiles({
  files,
  targetPackageDir,
  manifest,
  projectDir,
  previouslyWrittenFiles,
}: {
  files: readonly FileDef[];
  targetPackageDir: string;
  manifest: RepoPackageJson;
  projectDir: string;
  previouslyWrittenFiles: Map<string, CachedWrittenFile>;
}) {
  const rootDir = path.join(projectDir, targetPackageDir);
  const filesOrFns = await Promise.all(
    files.map((file) =>
      // TODO: add logging
      // TODO: add manual diffing with confirmation that change is ok
      writeFileFromDef({
        file,
        rootDir,
        manifest,
        projectDir,
        previouslyWrittenFiles,
      }),
    ),
  );
  const writtenFiles: WrittenFile[] = [];
  // this needs to happen sequentially, because we're prompting the user for input
  for (const fileOrFn of filesOrFns) {
    if (!fileOrFn) continue;
    writtenFiles.push(
      typeof fileOrFn === "function" ? await fileOrFn() : fileOrFn,
    );
  }
  return writtenFiles;
}

const DEFAULT_PACKAGE_MANAGER = "yarn";
// TODO: fetch latest version?
const DEFAULT_NODE_VERSION = "20.7.0";
const DEFAULT_SOURCE_EXTENSIONS = [
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
];

const FILE_STATE_PATH = ".config/.cache/files.json";

async function readPreviouslyWrittenFileCache(
  projectDir: string,
): Promise<Map<string, CachedWrittenFile>> {
  try {
    const file = await fs.readFile(path.join(projectDir, FILE_STATE_PATH));
    const cache = JSON.parse(file.toString()) as WrittenFile[];
    return new Map(
      await Promise.all(
        cache.map(
          async (file): Promise<readonly [string, CachedWrittenFile]> => {
            const fileName = path.basename(file.path);
            if (fileName === "tsconfig.json") {
              // TODO: how do we handle tsconfig edited by moon?
              // ignore changes for now
              return [file.path, file];
            }
            const fullPath = path.join(projectDir, file.path);
            const stat = await fs.stat(fullPath).catch(() => undefined);
            if (!stat) {
              return [file.path, { ...file, manuallyChanged: "deleted" }];
            }
            const newContent = (await fs.readFile(fullPath)).toString();
            return [
              file.path,
              {
                ...file,
                manuallyChanged: !stat
                  ? "deleted"
                  : stat?.atimeMs !== file.writtenAt &&
                    newContent !== file.content
                  ? {
                      at: stat.atimeMs,
                      content: newContent,
                    }
                  : undefined,
              },
            ] as const;
          },
        ),
      ),
    );
  } catch (e) {
    return new Map();
  }
}

export async function apply(options: LoadConfigOptions = {}) {
  const project = await loadRepoProject(options);
  if (!project) {
    return;
  }

  const {
    manifest,
    writeProjectManifest,
    projectDir,
    config,
    projectConventions,
    getWorkspacePackages,
  } = project;

  const projectGlobs = projectConventions.map((project) => project.glob).sort();

  // TODO: migrate to https://github.com/Effect-TS/schema
  // const config = t.decodeOrThrow(
  //   RepoConfigValidator,
  //   importedConfigFile.default,
  //   `Errors in config file`,
  // );

  let didChangeManifest = false;

  const defaultBranch: string =
    config.git?.defaultBranch ?? (await getDefaultGitBranch(projectDir));
  const { packageManager, engines } = manifest;
  const [packageManagerName, packageManagerVersion] = packageManager?.split(
    "@",
  ) ?? [DEFAULT_PACKAGE_MANAGER];
  const nodeVersion = engines?.node ?? DEFAULT_NODE_VERSION;

  // sync defined workspaces to package.json
  if (
    !Array.isArray(manifest.workspaces) ||
    !equals((manifest.workspaces ?? []).sort(), projectGlobs)
  ) {
    // TODO: support pnpm workspaces
    manifest.workspaces = projectGlobs;
    didChangeManifest = true;
  }

  const collectedState = await collectState({
    ...config,
    git: {
      ...config.git,
      defaultBranch,
    },
    node: {
      ...(packageManagerName === "yarn" ||
      packageManagerName === "pnpm" ||
      packageManagerName === "npm"
        ? {
            packageManager: {
              name: packageManagerName,
              version: packageManagerVersion,
            },
          }
        : {
            packageManager: {
              name: DEFAULT_PACKAGE_MANAGER,
            },
          }),
      version: nodeVersion,
    },
    conventions: {
      ...config.conventions,
      sourceDir: config.conventions?.sourceDir ?? "src",
      distDir: config.conventions?.distDir ?? "dist",
      sourceExtensions:
        config.conventions?.sourceExtensions ?? DEFAULT_SOURCE_EXTENSIONS,
    },
    workspaceDir: projectDir,
    project,
  });

  const writableFiles = collectedState.files.filter(({ targetDir, content }) =>
    Boolean(targetDir && content),
  );
  const filesByPackageDir = groupBy(writableFiles, (file) => file.targetDir);

  // TODO: provide the manually changed previouslyWrittenFiles to respective features
  // TODO: would need to add feature name to each cache entry
  const previouslyWrittenFiles = await readPreviouslyWrittenFileCache(
    projectDir,
  );

  const writtenFiles: WrittenFile[] = [];
  for (const [targetPackageDir, files] of Object.entries(filesByPackageDir)) {
    const [{ target }] = files;
    if (!target) continue;

    const written = await writeFiles({
      files,
      projectDir,
      targetPackageDir,
      manifest: target,
      previouslyWrittenFiles,
    });

    writtenFiles.push(...written);
  }

  // anything that's left in 'previouslyWrittenFiles' is no longer being generated, and should be deleted:
  await Promise.all(
    [...previouslyWrittenFiles.values()].map(async (file) => {
      if (file.manuallyChanged) return;
      const fullPath = path.join(projectDir, file.path);
      console.log(`Deleting, no longer needed: ${file.path}`);
      await fs.rm(fullPath);
    }),
  );

  await writeFiles({
    files: [{ path: FILE_STATE_PATH, content: writtenFiles }],
    manifest,
    projectDir,
    targetPackageDir: ".",
    previouslyWrittenFiles: new Map(),
  });

  for (const packageNameOrDef of collectedState.devDependencies) {
    let dependencyDef: DependencyDef;
    if (typeof packageNameOrDef === "string") {
      const [packageAliasPart, versionOrTag] = packageNameOrDef
        .slice(1)
        .split("@", 2) as [string, string | undefined];
      dependencyDef = {
        packageAlias: `${packageNameOrDef[0]}${packageAliasPart}`,
        versionOrTag,
      };
    } else {
      dependencyDef = packageNameOrDef;
    }
    // TODO parallelize?
    didChangeManifest ||= await ensureDependency({
      manifest,
      target: "devDependencies",
      ...dependencyDef,
    });
  }

  if (didChangeManifest) {
    await writeProjectManifest(manifest);
    // TODO: run 'yarn install' or whatever the package manager is if manifest changed
  }
}
