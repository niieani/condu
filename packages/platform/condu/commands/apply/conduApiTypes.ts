import type {
  Task,
  DependencyDefinitionInput,
  ConduReadonlyCollectedStateView,
} from "./CollectedState.js";
import type {
  PackageJsonModifier,
  ReadonlyConduPackageEntry,
  MatchPackage,
  PackageJsonPublishModifier,
} from "./ConduPackageEntry.js";
import type { PeerContext } from "../../extendable.js";
import type {
  DefinedFileNames,
  FallbackFileNames,
  FallbackFileNameToDeserializedTypeMapping,
  GenerateFileOptionsForPath,
  ModifyGeneratedFileOptions,
  ModifyUserEditableFileOptions,
  PartialGlobalFileAttributes,
  ResolvedSerializedType,
} from "./FileManager.js";
import type { ConduProject } from "./ConduProject.js";

export interface ConduApi {
  // TODO: add error / warning collection functions
  readonly project: ReadonlyConduProject;
  readonly root: ScopedRecipeApi;
  readonly in: (criteria: MatchPackage) => ScopedRecipeApi;
}

export interface PostRecipeState {
  readonly globalRegistry: ConduReadonlyCollectedStateView;
}

export interface ConduGarnishApi extends PostRecipeState {
  readonly project: ReadonlyConduProject;
  readonly root: ScopedRecipeApiCore;
  readonly in: (criteria: MatchPackage) => ScopedRecipeApiCore;
}

export type ReadonlyConduProject = Omit<
  ConduProject,
  "applyAndCommit" | "allPackages" | "workspace" | "workspacePackages"
> & {
  // override with narrowed-down readonly types for the workspace and packages
  readonly allPackages: readonly ReadonlyConduPackageEntry[];
  readonly workspace: ReadonlyConduPackageEntry<"workspace">;
  readonly workspacePackages: readonly ReadonlyConduPackageEntry<"package">[];
};

export interface ScopedRecipeApiCore {
  generateFile<PathT extends string>(
    path: PathT,
    options: GenerateFileOptionsForPath<PathT>,
  ): ScopedRecipeApi;
  modifyGeneratedFile<PathT extends string>(
    path: PathT,
    options: ModifyGeneratedFileOptions<ResolvedSerializedType<PathT>>,
  ): ScopedRecipeApi;
  modifyUserEditableFile<
    PathT extends string,
    DeserializedT = PathT extends FallbackFileNames
      ? FallbackFileNameToDeserializedTypeMapping[PathT]
      : // if no deserializer is defined, we just pass the raw content
        string,
  >(
    path: PathT,
    options: (PathT extends DefinedFileNames
      ? "Error: This file is being generated by condu. Use modifyGeneratedFile instead."
      : {}) &
      ModifyUserEditableFileOptions<DeserializedT>,
  ): ScopedRecipeApi;
  ensureDependency(
    name: string,
    dependency?: DependencyDefinitionInput,
  ): ScopedRecipeApi;
  setDependencyResolutions(
    resolutions: Record<string, string>,
  ): ScopedRecipeApi;
  modifyPackageJson(modifier: PackageJsonModifier): ScopedRecipeApi;
  modifyPublishedPackageJson(
    modifier: PackageJsonPublishModifier,
  ): ScopedRecipeApi;
}

export interface ScopedRecipeApi extends ScopedRecipeApiCore {
  ignoreFile(
    path: string,
    options?: Omit<PartialGlobalFileAttributes, "inAllPackages">,
  ): ScopedRecipeApi;
  defineTask(name: string, taskDefinition: Omit<Task, "name">): ScopedRecipeApi;
}

export type PeerContextReducer = {
  readonly [K in keyof PeerContext]?: (
    current: PeerContext[K],
  ) => PeerContext[K] | Promise<PeerContext[K]>;
};

export type PossibleFeatureNames = keyof PeerContext | (string & {});

export type GetPeerContext<NameT extends PossibleFeatureNames> =
  NameT extends keyof PeerContext ? PeerContext[NameT] : never;

interface FeatureDefinitionSharedProps {
  // todo should this allow regex for dynamically created features?
  after?: Array<string> | string;
}

type FeatureDefinitionPeerContextDependentProps<
  NameT extends PossibleFeatureNames,
> = NameT extends keyof PeerContext
  ? {
      initialPeerContext:
        | GetPeerContext<NameT>
        | ((
            project: ReadonlyConduProject,
          ) => GetPeerContext<NameT> | Promise<GetPeerContext<NameT>>);
      modifyPeerContexts?: (
        project: ReadonlyConduProject,
        initialPeerContext: GetPeerContext<NameT>,
      ) => Promise<PeerContextReducer> | PeerContextReducer;
      defineRecipe?: (
        condu: ConduApi,
        peerContext: GetPeerContext<NameT>,
      ) => void | Promise<void>;
      defineGarnish?: (
        condu: ConduGarnishApi,
        peerContext: GetPeerContext<NameT>,
      ) => void | Promise<void>;
    }
  : {
      defineRecipe?: (condu: ConduApi) => void | Promise<void>;
      /**
       * Defines a finalization recipe that runs *after each*  enabled feature's
       * `defineRecipe` calls have completed.
       * This is primarily intended for "last-minute" modifications, such as adjusting
       * `package.json` scripts, that depend on the complete configuration state (such as tasks).
       */
      defineGarnish?: (condu: ConduGarnishApi) => void | Promise<void>;
      modifyPeerContexts?: (
        project: ReadonlyConduProject,
      ) => Promise<PeerContextReducer> | PeerContextReducer;
    };

export type FeatureDefinitionInput<
  NameT extends PossibleFeatureNames = PossibleFeatureNames,
> = FeatureDefinitionSharedProps &
  FeatureDefinitionPeerContextDependentProps<NameT>;

export interface FeatureDefinitionMeta<
  NameT extends PossibleFeatureNames = PossibleFeatureNames,
> {
  name: NameT;
  // TODO: maybe instead of stack just the file path of the feature definition from import.meta.url?
  stack: string;
  anonymous?: boolean;
}

export type FeatureDefinition<
  NameT extends PossibleFeatureNames = PossibleFeatureNames,
> = FeatureDefinitionInput<NameT> & FeatureDefinitionMeta<NameT>;

export type RecipeFunction = (condu: ConduApi) => void | Promise<void>;

export type FeatureActionFn = <NameT extends PossibleFeatureNames>(
  name: NameT,
  definition: FeatureDefinitionInput<NameT>,
) => FeatureDefinition<NameT>;
