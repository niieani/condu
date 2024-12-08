I'm building a library and I've decided to refactor the API to be more flexible. Here's some background:

# condu

One config to rule them all.

Configuration as code. Think about condu as terraform for your repository configuration.

The un-template / un-boilerplate / un-scaffold / un-generator.
Keep ALL of your project configuration up to date, and easily override it, using a single language.

Managing the JavaScript ecosystem can be a full time job.
Upgrades to transpiles, migrations across builder systems, migrating or adding support for new engines (deno, bun), correct support for CommonJS and ESM, linting, testing, etc.
And if you maintain more than one package, multiply all of that work by each one!

Annoyed by ecosystem/tooling churn? Hard to maintain dependencies? Tired of manually updating configs?

Tired of various tools having different configuration formats?
Some starting with dot, some in their own folders, some in .json,
others in .yaml, JavaScript, or even .toml?

Configure everything with code! In TypeScript, neatly organized inside of a `.config` folder.

Additionally, reuse your configuration across projects, and easily update them all at once.
Override only the parts you need to in your given project, and keep the rest up to date.

Scaffolding seems great at first, but isn't good enough, because it's not maintainable.
The ecosystem moves too fast, and there are no configuration management tools in the JavaScript ecosystem.

Another problem is that often when you want to install a new tool, you have to update configuration files of all the tools you're using.
You need to know how to make the tools work together, and you need to know how to configure them.
This is challenging, because the tools are often not designed to work together, and they have different configuration formats.
It's unlikely you are an expert in all of them, and might be missing out on the best practices.
`condu` solves this by helping features contribute to other feature's context, or directly extend others' configuration files.

## Ideas

Embrace convention over configuration, but allow for easy configuration overrides.

- Simple repo management system:
  - Immutable/reconstructable configs (nix-os philosophy)
  - Allow custom build strategy
  - Allow overrides for any config
  - Allow search and replace for any config
  - Monorepo support
  - Set build strategy (simple, e.g. library-webpack or web-vite)
  - General repo strategy (Github actions)
  - Easy migrations
  - Config can be (should be?) in TypeScript ESM

## Example `.config/condu.ts` file

```ts
export default configure((pkg) => ({
  engine: "node",
  projects: [
    { parentPath: "packages/presets", nameConvention: "@condu-preset/*" },
    { parentPath: "packages/generic", nameConvention: "*" },
  ],
  features: [
    editorconfig(),
    typescript({
      tsconfig: { compilerOptions: { skipLibCheck: true } },
    }),
    libraryBundle({ entry: "cli.ts" }),
    eslint({
      importAdditionalConfigFrom: "./eslint.ts",
      defaultRules: { "unicorn/no-null": "error" },
    }),
    prettier({ ignore: ["**/.*.json"] }),
    moonCi(),
    releasePlease({ initialVersion: "0.0.1" }),
    vscode({
      suggestedConfig: { "explorer.fileNesting.enabled": true },
    }),
    gitignore({ ignore: [".env", ".env.*"] }),
  ],
}));
```

# Examples of existing feature definitions (using old API)

## gitignore.ts feature example (old API)

```ts
import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import { defineFeature } from "condu";
import * as path from "node:path";
import { groupBy } from "remeda";

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    order: { priority: "end" },
    actionFn: (config, state) => ({
      effects: [
        {
          files: [
            {
              path: ".gitignore",
              content: () => {
                return (
                  [
                    ".DS_Store",
                    "node_modules",
                    `/${CONDU_CONFIG_DIR_NAME}/.cache/`,
                    `/${config.conventions.buildDir}/`,
                    // ignore all generated files:
                    ...entriesFromFeatures,
                    ...(ignore.length > 0 ? ["# custom ignore patterns:"] : []),
                    ...ignore,
                  ].join("\n") + "\n"
                );
              },
            },
          ],
        },
      ],
    }),
  });
```

## eslint feature example (old API)

```ts
import { defineFeature } from "condu";
import { pick } from "remeda";
import type {
  ContextProvidedToEslintConfig,
  EslintFeatureInput,
} from "./types.js";
import path from "node:path";

const RUNNING_SOURCE_VERSION = import.meta.url.endsWith(".ts");

export const eslint = ({
  importAdditionalConfigFrom,
  defaultRules = {},
  ignores = [],
}: { importAdditionalConfigFrom?: string } & EslintFeatureInput = {}) =>
  defineFeature({
    name: "eslint",
    actionFn: (config, state) => {
      const needsTypeScript =
        RUNNING_SOURCE_VERSION || importAdditionalConfigFrom?.endsWith(".ts");
      return {
        autolinkIgnore: importAdditionalConfigFrom
          ? [importAdditionalConfigFrom]
          : [],
        effects: [
          {
            files: [
              {
                path: "eslint.config.js",
                content: () => {
                  const eslintContext: ContextProvidedToEslintConfig = {
                    ...pick(config, ["conventions", "projects"]),
                    ignores: [
                      ...state.files.map(({ path: p, targetDir }) =>
                        targetDir === "."
                          ? `${p}`
                          : `${targetDir}/${path.normalize(p)}`,
                      ),
                      ...ignores,
                    ],
                    defaultRules,
                  };
                  return `// note: this file was auto-generated by condu
import { getConfigs } from "@condu-feature/eslint/config.${
                    needsTypeScript ? "ts" : "js"
                  }";
${importAdditionalConfigFrom ? `import additionalConfigs from "./.config/${path.normalize(importAdditionalConfigFrom)}";` : ""}
const configs = getConfigs(${JSON.stringify(eslintContext, undefined, 2)}${importAdditionalConfigFrom ? ", additionalConfigs" : ""});
export default configs;\n`;
                },
              },
            ],
            devDependencies: [
              "eslint",
              "eslint-plugin-import-x",
              ...(needsTypeScript ? ["tsx"] : []),
            ],
            tasks: [
              {
                name: "eslint",
                type: "test",
                definition: {
                  command: "eslint",
                  inputs: ["@group(sources)"],
                  ...(needsTypeScript
                    ? {
                        env: { NODE_OPTIONS: "--import tsx/esm" },
                      }
                    : {}),
                },
              },
            ],
          },
        ],
      };
    },
  });
```

# The new feature definition API proposal

```ts
import { type FileMapping, type PeerContext, defineFeature } from "condu";

// merge interface declarations
interface FileMapping {
  ".gitignore": string;
}

// merge interface declarations to extend the global PeerContext
// define the kind of peer context for this feature, which can be extended by other features
interface PeerContext {
  gitignore: {
    ignore: string[];
  };
}

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    initialPeerContext: { ignore },

    // 'after' can be used to define dependencies of this feature to determine the optimal order of execution,
    // or define "*" if you want to run execute the feature after all other non "*"-depending features have executed
    after: "*",

    // for every configured feature, we execute 'mergePeerContext' to collect
    // and "reduce" the final peer context first (in topological order, as per "after" dependencies)
    // note that peer context contributions might be asynchronous
    // most features won't even to use this (it's an optional property of the feature definition API)
    mergePeerContext: async (config) => ({
      // each feature can define its own peer context
      // and it can be extended by other features
      // e.g. another feature could add a 'gitignore' key to the peer context
      // which is then available in the 'apply' function
      gitignore: (gitIgnorePeerContext) => ({
        ignore: [...gitIgnorePeerContext.ignore, "something"],
      }),
    }),

    // after we have peer context, we we execute 'apply' for every configured feature (in topological order)
    // and any files that are created, modified, their dependencies added,
    // but by this point peer context cannot be extended anymore
    apply: (condu, peerContext) => {
      // condu.config is available here

      // subsequent calls overwrite the previous ones
      // and output a warning
      condu.root.createManagedFile(".gitignore", {
        content: (pkg) => `...` + peerContext.ignore.join("\n"),
        // stringify: (content) => content,
      });

      // modifies a file that was created by another feature
      // modifications are run only after all createManagedFile calls, in the same order as features
      // if the file wasn't created in another feature, it errors
      // think of it like middleware for the file creation
      condu.root.modifyManagedFile(".gitignore", {
        content: (content, pkg) => {
          return content + `...`;
        },
        ifNotCreated: "error", // default is "ignore", can also be "error" or "create" - in last case we might need stringify/parse or fallback?
        // no stringify here necessary, we're depending on the previous feature to do that (unless "create" is set)
      });

      // loads the file from fs, and modifies it
      // subsequent calls receive the content from the previous call
      condu.root.modifyUserEditableFile(".gitignore", {
        createIfNotExists: true, // default is true
        content: (content, pkg) => {
          return content + `...`;
        },
        // optional: (by default uses json-comment for .json files, and yaml for .yaml files)
        // parse: (fileBuffer) => content,
        // stringify: (content) => content,
      });

      condu.root.addManagedDevDependency("tsx");

      // target a specific workspace/package:
      // alternative names: 'matching', 'where'
      condu.with({ name: "xyz", kind: "package" }).addManagedDependency("abc");

      // only available in the root package
      condu.root.setDependencyResolutions({
        abc: "1.0.0",
      });

      // example usage of `mergePackageJson`
      condu.root.mergePackageJson((pkg) => ({
        scripts: {
          ...pkg.scripts,
          test: "jest",
        },
      }));

      // only update the release-prepared version of the package.json only:
      condu.with({ kind: "package" }).mergeReleasePackageJson((pkg) => ({
        scripts: {
          ...pkg.scripts,
          test: "jest",
        },
      }));

      // etc. other features and methods are available under the `condu` namespace
      // to cover all remaining functionality in the old API
    },
  });
```

After configuring the features:

- we sort the features in topological order
- run their `mergePeerContext` to collect a final reducer of each peer context
- we execute the peer context reducers in topological order with `config` (`ConduConfigWithInferredValuesAndProject`)
- run their `apply` with both `config` and `peerContext` (scoped down to only this particular feature's `peerContext`)
  - `apply`'s function is to collects all the "changes to be made", i.e. `createManagedFile` and other methods only create a "change to be made" object with the correct context
- once collected, we create a reducer pipeline for creating/updating files from each of these changes. These pipelines are created from grouping all "changes to be made" based on their absolute filepath.
  - a final "content" reducer is created by combining all matching `createManagedFile` and `modifyManagedFile` (order must be respected)
  - similarly for `modifyUserEditableFile`
- finally, we can interface with the FS, parse, run content reducers, stringify and commit the changes to the file system

Notes: it's important to distinguish between managed files, and user-modifiable files:

- The managed kind is created and edited by condu
- The user-modifiable file can be created by the user (or by condu), but the user or other tools can modify that task manually. This can be useful for things like vscode settings, where we want individual end users to still be able to either override certain settings or add their own custom settings on top of the ones suggested by the repository configuration.

# The existing implementation (old API)

## `configTypes.ts`

```ts
export interface DependencyDef {
  packageAlias: string;
  versionOrTag?: string;
  target?: "dependencies" | "devDependencies" | "optionalDependencies";
  skipIfExists?: boolean;
  /** to what extent should this dependency be managed by condu? */
  managed?: ManagedDependencyConfig | false;
}

export interface Task {
  // TODO: allow matching which package the task belongs to, like with Files (matchPackage)
  name: string;
  // format is any transformation in-place
  type: "test" | "build" | "publish" | "format" | "start";
  definition: PartialTaskConfig;
}

export type GetExistingContentFn = <T extends string | object>(
  defaultFallback?: T | undefined,
) => Promise<T | undefined> | T | undefined;

export class SymlinkTarget {
  toString() {
    return `symlink:${this.target}`;
  }
  constructor(public readonly target: string) {}
}

export type FileContent = string | AnyObject | Array<object> | SymlinkTarget;

export interface FileDef {
  /**
   * should this file be ephemeral and is always regenerated by the apply tool (default),
   * or should it be committed?
   * will affect the behavior for features like gitignore
   **/
  type?: "ephemeral" | "committed" | "ignore-only";
  /**
   * always overwrite the file, even if it was changed by the user
   * CAREFUL: this *will* overwrite user changes without warning
   */
  alwaysOverwrite?: boolean;
  /** should this file be published when making a distributable package */
  publish?: boolean;
  /**
   * if you need to access 'state' (e.g. to list all files or tasks),
   * using a function is preferable, as it will be executed *after* all the state had been collected,
   * rather than during its collection, as is the case with pure string or object.
   *
   * if returned an object, the correct stringifier is chosen based on the file extension
   * if a string is returned, it will be written as-is
   **/
  content?:
    | FileContent
    | ((opts: {
        pkg: WorkspacePackage;
        getExistingContentAndMarkAsUserEditable: GetExistingContentFn;
      }) => Promise<FileContent> | FileContent);
  path: string;
}

export type ManagedDependencyConfig = "presence" | "version";

export interface PackageJsonConduSection
  extends Pick<
    PartialProjectConfig,
    "language" | "platform" | "tags" | "type" | "stack"
  > {
  initialDevelopment?: boolean;
  managedDependencies?: Record<string, ManagedDependencyConfig>;
  defaultScope?: string;
}

export interface ConduPackageJson extends PackageJson {
  // name is mandatory
  name: string;
  condu?: PackageJsonConduSection;

  bolt?: { workspaces?: string[] };
  pnpm?: ProjectManifest["pnpm"];
  resolutions?: Record<string, string>;
  overrides?: Record<string, string>;
}

export interface CollectedTaskDef extends Task {
  featureName: string;
  target: ConduPackageJson;
}

export interface CollectedFileDef extends FileDef {
  featureName: string;
  /**
   * set to true if the file should not be ignored,
   * or list the feature names by which it should be ignored
   *
   * prefer to use type: 'committed' instead, this is used internally
   **/
  skipIgnore?: boolean | string[];
  targetDir: string;
  targetPackage: WorkspacePackage;
}

export interface Hooks {
  modifyPublishPackageJson: (
    packageJson: PackageJson,
  ) => PackageJson | Promise<PackageJson>;
}

export interface CollectedState {
  /** these files will be created during execution */
  files: CollectedFileDef[];
  /** we'll ensure these dependencies are installed during execution */
  devDependencies: (string | DependencyDef)[];
  resolutions: Record<string, string>;
  tasks: CollectedTaskDef[];
  hooksByPackage: {
    [packageName: string]: Partial<Hooks>;
  };
  autolinkIgnore: string[];
}

export interface StateFlags {
  preventAdditionalTasks?: boolean;
}

export type Effects = {
  /** these files will be created during execution */
  files?: ReadonlyArray<FileDef | false | undefined>;
  tasks?: ReadonlyArray<Task | false | undefined>;
  hooks?: Partial<Hooks>;

  /** we'll ensure these dependencies are installed during execution */
  devDependencies?: (string | DependencyDef)[];

  /** we'll ensure these dependency resolutions are applied */
  resolutions?: Record<string, string>;

  /**
   * ts-pattern for package.jsons that the state applies to. Defaults to workspace.
   * @default { kind: "workspace" }
   * */
  matchPackage?: Pattern.Pattern<WorkspacePackage> | Partial<WorkspacePackage>;
};

export interface FeatureResult {
  effects?: (Effects | null | undefined | false)[];
  flags?: ReadonlyArray<keyof StateFlags>;
  /**
   * a list of filenames that should not be autolinked,
   * as they are handled directly by the feature
   **/
  autolinkIgnore?: string[];
}

export type FeatureActionFn = (
  config: ConduConfigWithInferredValuesAndProject,
  /**
   * TODO: consider lifting 'state' argument to 'content' function of files
   * since the state here is only "collected till now"
   **/
  state: CollectedState,
) => FeatureResult | Promise<FeatureResult | void> | void;

export interface FeatureDefinition {
  actionFn: FeatureActionFn;
  name: string;
  order?: {
    after?: Array<string>;
    priority?: "beginning" | "end";
  };
}

export interface Conventions {
  /** @default '.' */
  sourceDir?: string;
  sourceExtensions?: string[];
  buildDir?: string;
  /** @default ['.gen', '.generated'] */
  generatedSourceFileNameSuffixes?: string[];
}

export interface ResolvedConventionsWithWorkspace
  extends Required<Conventions> {
  projectConventions?: WorkspaceProjectDefined[];
}

export interface AutoLinkConfig {
  /** remap file names, key is the filename in .config/, value is the target name */
  mapping?: Record<string, string>;
  ignore?: (string | RegExp)[];
}

export interface ConduConfig {
  /** primary engine used to run the tool */
  engine?: Engine;
  node?: NodeConfig;
  publish?: {
    registry?: string;
    access?: "public" | "restricted";
  };
  git?: GitConfig;
  features: FeatureDefinition[];
  /** automatically links any config file inside .config/ folder to the root directory and makes it invisible */
  autolink?: boolean | AutoLinkConfig;
  /** when present, assumes monorepo */
  projects?: WorkspaceProjectsConvention[];
  conventions?: Conventions;
}

export interface ConfiguredConduConfig extends ConduConfig {
  [CONFIGURED]: true;
}

export interface ConduConfigWithInferredValues extends ConfiguredConduConfig {
  /** absolute path to the workspace */
  workspaceDir: string;
  /** absolute path to the config directory */
  configDir: string;
  conventions: ResolvedConventionsWithWorkspace;
  git: Required<GitConfig>;
  node: Required<NodeConfig>;
  engine: Engine;
}

export interface Project extends WorkspaceRootPackage {
  projectConventions?: WorkspaceProjectDefined[];
  config: ConduConfigWithInferredValues;
  getWorkspacePackages: () => Promise<readonly WorkspaceSubPackage[]>;
}

export interface WorkspacePackage extends IPackageEntry {
  kind: "workspace" | "package";
}

export interface WorkspaceRootPackage extends WorkspacePackage {
  kind: "workspace";
}

export interface WorkspaceSubPackage extends WorkspacePackage {
  kind: "package";
}

export interface IPackageEntry {
  /** shortcut to manifest.name */
  name: string;
  scope?: string;
  scopedName?: string;
  manifest: ConduPackageJson;
  manifestRelPath: string;
  manifestAbsPath: string;
  /** relative directory of the package from the workspace path */
  relPath: string;
  /** absolute directory of the package */
  absPath: string;
  writeProjectManifest: WriteManifestFn;
}

export interface ConduConfigWithInferredValuesAndProject
  extends ConduConfigWithInferredValues {
  project: Project;
}
```

## `apply.ts` file

```ts
import {
  FILE_STATE_PATH,
  readPreviouslyWrittenFileCache,
  writeFiles,
  type FilesJsonCacheFileVersion1,
  type WrittenFile,
} from "./readWrite.js";
import { autolink } from "../../builtin-features/autolink.js";

export const getApplyHook =
  <TOut>(...fns: ((arg: TOut) => TOut | Promise<TOut>)[]) =>
  async (arg: TOut): Promise<TOut> => {
    for (const fn of fns) {
      arg = await fn(arg);
    }
    return arg;
  };

export async function collectState(
  config: ConduConfigWithInferredValuesAndProject,
  state: CollectedState = {
    files: [],
    devDependencies: [],
    tasks: [],
    hooksByPackage: {},
    resolutions: {},
    autolinkIgnore: [],
  },
): Promise<CollectedState> {
  const hooksByPackage: {
    [packageName: string]: {
      [P in keyof Hooks]?: Hooks[P][];
    };
  } = {};

  const { project, features } = config;

  const workspacePackages = await project.getWorkspacePackages();
  const packages = [project, ...workspacePackages];

  // TODO: topo-sort features by `order` config, or support soft dependencies between features
  const flags: { [K in keyof StateFlags]?: string } = {};

  for (const feature of features) {
    // const featureOrder = feature.order;
    const featureConfig = await feature.actionFn(config, state);
    if (!featureConfig) continue;

    for (const featureEffect of featureConfig.effects ?? []) {
      if (!featureEffect) continue;

      const matchPackageFn = isMatching(featureEffect.matchPackage);
      const matchAllPackages =
        featureEffect.matchPackage &&
        Object.keys(featureEffect.matchPackage).length === 1 &&
        "kind" in featureEffect.matchPackage &&
        featureEffect.matchPackage.kind === "package";

      // TODO: check if any packages matched and maybe add a warning if zero matches?
      const matchedPackages = featureEffect.matchPackage
        ? matchAllPackages
          ? workspacePackages
          : packages.filter((pkg) => matchPackageFn(pkg))
        : [project];

      if (featureEffect.files) {
        const flattenedFiles = featureEffect.files.flatMap(
          (file): CollectedFileDef[] => {
            if (!file) return [];

            const matches = matchedPackages.map(
              (pkg): CollectedFileDef => ({
                ...file,
                targetDir: pkg.relPath,
                targetPackage: pkg,
                featureName: feature.name,
                skipIgnore: matchAllPackages,
              }),
            );

            return matchAllPackages
              ? ([
                  ...matches,
                  // this one is used by the gitignore-like features, as it doesn't contain 'content'
                  ...(project.projectConventions?.map((convention) => ({
                    path: file.path,
                    publish: file.publish,
                    type: file.type,
                    featureName: feature.name,
                    targetDir: convention.glob,
                    targetPackage: project,
                  })) ?? []),
                ] satisfies CollectedFileDef[])
              : matches;
          },
        );
        state.files.push(...flattenedFiles);
      }
      if (featureEffect.tasks) {
        if (flags.preventAdditionalTasks) {
          console.warn(
            `Feature ${feature.name} adds tasks, but the previously evaluated ${flags.preventAdditionalTasks} feature set the 'preventAdditionalTasks' flag already. This is likely due to the order of features being incorrect.`,
          );
        }
        for (const taskDef of featureEffect.tasks) {
          if (!taskDef) continue;
          state.tasks.push(
            ...matchedPackages.map((pkg) => ({
              ...taskDef,
              target: pkg.manifest,
              featureName: feature.name,
            })),
          );
        }
      }

      // TODO: support per-package dependencies, right now all dependencies are repo-global
      if (featureEffect.devDependencies) {
        state.devDependencies.push(
          ...featureEffect.devDependencies.filter(nonEmpty),
        );
      }

      if (featureEffect.resolutions) {
        Object.assign(state.resolutions, featureEffect.resolutions);
      }

      if (featureEffect.hooks) {
        for (const [_hookName, hookFn] of Object.entries(featureEffect.hooks)) {
          const hookName = _hookName as keyof Hooks;
          for (const pkg of matchedPackages) {
            const hooks = (hooksByPackage[pkg.manifest.name] ||= {});
            const hook = (hooks[hookName] ||= []);
            hook.push(hookFn);
          }
        }
      }
    }

    // map hooks into functions:
    state.hooksByPackage = Object.fromEntries(
      Object.entries(hooksByPackage).map(([packageName, hooks]) => [
        packageName,
        Object.fromEntries(
          Object.entries(hooks).map(([hookName, hookFns]) => [
            hookName,
            getApplyHook(...hookFns),
          ]),
        ),
      ]),
    );

    // flags are global
    if (featureConfig.flags) {
      for (const key of featureConfig.flags) {
        // first feature to set a flag wins
        flags[key] ||= feature.name;
      }
    }

    if (featureConfig.autolinkIgnore) {
      state.autolinkIgnore.push(...featureConfig.autolinkIgnore);
    }
  }

  return state;
}

export async function apply(options: LoadConfigOptions = {}) {
  // TODO: add a mutex file lock to prevent concurrent runs of apply
  const { throwOnManualChanges } = options;
  const project = await loadConduProject(options);
  if (!project) {
    return;
  }

  const {
    manifest,
    writeProjectManifest,
    absPath: workspaceDirAbs,
    config,
    projectConventions,
  } = project;

  let didChangeManifest = false;

  const projectGlobs = projectConventions
    ?.map((project) => project.glob)
    .sort();

  // sync defined workspaces to package.json
  // TODO: maybe this could live in pnpm/yarn feature instead?
  if (
    projectGlobs &&
    (!Array.isArray(manifest.workspaces) ||
      !isDeepEqual((manifest.workspaces ?? []).sort(), projectGlobs))
  ) {
    manifest.workspaces = projectGlobs;
    didChangeManifest = true;
  }

  // add autolink built-in feature if not disabled
  const features =
    config.autolink || !("autolink" in config)
      ? [
          ...config.features,
          autolink(
            typeof config.autolink === "object" ? config.autolink : undefined,
          ),
        ]
      : config.features;

  const collectedState = await collectState({ ...config, features, project });

  const writableFiles = collectedState.files.filter(
    ({ targetDir, content, type }) =>
      Boolean(targetDir && content && type !== "ignore-only"),
  );
  const filesByPackageDir = groupBy(writableFiles, (file) => file.targetDir);

  // TODO: provide the manually changed previouslyWrittenFiles to respective features
  // TODO: would need to add feature name to each cache entry
  const { cache: previouslyWrittenFiles, rawCacheFile } =
    await readPreviouslyWrittenFileCache(workspaceDirAbs);

  const writtenFiles: WrittenFile[] = [];
  for (const [targetPackageDir, files] of Object.entries(filesByPackageDir)) {
    const [{ targetPackage }] = files;
    if (!targetPackage) continue;

    const written = await writeFiles({
      files,
      workspaceDirAbs,
      targetPackageDir,
      targetPackage,
      previouslyWrittenFiles,
      throwOnManualChanges,
    });

    writtenFiles.push(...written);
  }

  // anything that's left in 'previouslyWrittenFiles' is no longer being generated, and should be deleted:
  await Promise.all(
    [...previouslyWrittenFiles.entries()].map(async ([filePath, file]) => {
      if (file.fsState) return;
      const fullPath = path.join(workspaceDirAbs, filePath);
      console.log(`Deleting, no longer needed: ${fullPath}`);
      await fs.rm(fullPath).catch((reason) => {
        console.error(`Failed to delete ${filePath}: ${reason}`);
      });
    }),
  );

  // write the cache file:
  await writeFiles({
    files: [
      {
        path: FILE_STATE_PATH,
        content: {
          cacheVersion: 1,
          files: writtenFiles.filter((f) => !f.ignoreCache),
        } satisfies FilesJsonCacheFileVersion1,
      },
    ],
    targetPackage: project,
    workspaceDirAbs,
    targetPackageDir: ".",
    previouslyWrittenFiles: new Map(
      rawCacheFile
        ? [[FILE_STATE_PATH, { lastApply: rawCacheFile, fsState: "unchanged" }]]
        : undefined,
    ),
    throwOnManualChanges,
  });

  const previouslyManagedDependencies = new Set(
    Object.keys(manifest.condu?.managedDependencies ?? {}),
  );
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
    previouslyManagedDependencies.delete(dependencyDef.packageAlias);
    // TODO parallelize?
    didChangeManifest ||= await ensureDependency({
      manifest,
      target: "devDependencies",
      ...dependencyDef,
    });
  }

  // remove any managed dependencies that are no longer needed:
  for (const packageName of previouslyManagedDependencies) {
    if (manifest.devDependencies?.[packageName]) {
      delete manifest.devDependencies[packageName];
      didChangeManifest = true;
    }
    if (manifest.condu?.managedDependencies?.[packageName]) {
      delete manifest.condu.managedDependencies[packageName];
      didChangeManifest = true;
    }
  }

  const resolutionsEntries = Object.entries(collectedState.resolutions);
  const packageManager = project.config.node.packageManager.name;
  if (resolutionsEntries.length > 0) {
    const manifestResolutions =
      manifest.resolutions ?? manifest["pnpm"]?.overrides ?? manifest.overrides;
    if (manifestResolutions) {
      for (const [packageName, version] of resolutionsEntries) {
        if (manifestResolutions[packageName] !== version) {
          manifestResolutions[packageName] = version;
          didChangeManifest = true;
        }
      }
    } else {
      if (packageManager === "pnpm") {
        manifest["pnpm"] ??= {};
        manifest["pnpm"].overrides = collectedState.resolutions;
      } else if (packageManager === "yarn") {
        manifest.resolutions = collectedState.resolutions;
      } else {
        manifest.overrides = collectedState.resolutions;
      }
      didChangeManifest = true;
    }
  }

  if (didChangeManifest) {
    await writeProjectManifest(manifest);
    // TODO: run 'yarn/npm/pnpm install' if manifest changed
  }

  return {
    project,
    collectedState,
  };
}
```

# Task

Write a the next generation version of the `apply.ts` file that would be compatible with the new API format, based on the new proposal.
