import type {
  ManagedDependencyConfig,
  ConduPackageEntry,
  PackageJsonModification,
  ReadonlyConduPackageEntry,
} from "./ConduPackageEntry.js";
import type { FileManager, ReadonlyFile } from "./FileManager.js";
import type { GlobalFileAttributes } from "@condu/types/extendable.js";
import type { Immutable } from "@condu/types/tsUtils.js";
import type { PartialTaskConfig } from "@moonrepo/types";

export interface CollectedState {
  fileManager: FileManager;
  tasks: CollectedTask[];
  /** we'll ensure these dependencies are installed during execution */
  dependencies: CollectedDependency[];
  /** we'll ensure these dependency resolutions are applied */
  resolutions: Record<string, string>;
  packageJsonModifications: PackageJsonModificationWithPackage[];
  releasePackageJsonModifications: PackageJsonModificationWithPackage[];
}

export interface CollectionContext {
  featureName: string;
}

export interface CollectedDependency {
  readonly targetPackage: ConduPackageEntry;
  readonly dependencyDefinition: DependencyDefinition;
  readonly context: CollectionContext;
}

export interface CollectedTask {
  readonly targetPackage: ConduPackageEntry;
  readonly taskDefinition: Task;
  readonly context: CollectionContext;
}

export interface PackageJsonModificationWithPackage
  extends PackageJsonModification {
  targetPackage: ConduPackageEntry;
}

// this is the public API that exposes access to all collected changes
// allowing generators to use that state to generate files
// making them available via content: (..., publicApi) => ...

export class ConduCollectedStatePublicApi {
  #changes: CollectedState;

  constructor(changes: CollectedState) {
    this.#changes = changes;
  }

  get files(): MapIterator<
    readonly [workspaceRelPath: string, file: ReadonlyFile]
  > {
    return this.#changes.fileManager.files.entries();
  }

  get tasks(): ReadonlyArray<CollectedTask> {
    return this.#changes.tasks;
  }

  *getTasksMatchingPackage(
    packageEntry: ReadonlyConduPackageEntry,
  ): Generator<CollectedTask, void, undefined> {
    for (const task of this.#changes.tasks) {
      if (task.targetPackage.absPath === packageEntry.absPath) {
        yield task;
      }
    }
  }

  get dependencies(): ReadonlyArray<CollectedDependency> {
    return this.#changes.dependencies;
  }

  // TODO: allow specifying fallback attributes in order of preference, e.g. ['hidden', 'gitignore']
  // so that if 'hidden' is set (to anything) it will be used for matching with value,
  // otherwise 'gitignore' would be used
  *getFilesMatchingAttribute<FlagT extends keyof GlobalFileAttributes>(
    attribute: FlagT,
    {
      value,
      includeUnflagged = false,
    }: {
      /**
       * if left undefined, will return all files with the attribute
       * property set to any value that is truthy
       */
      value?: GlobalFileAttributes[FlagT];
      includeUnflagged?: boolean;
    } = {},
  ): Generator<
    [workspaceRelPath: string, file: ReadonlyFile],
    void,
    undefined
  > {
    for (const kv of this.#changes.fileManager.files.entries()) {
      const file = kv[1];
      if (
        (attribute in file.attributes &&
          ((value === undefined && file.attributes[attribute]) ||
            (value !== undefined && file.attributes[attribute] === value))) ||
        (includeUnflagged && file.attributes[attribute] === undefined)
      ) {
        yield kv;
      }
    }
  }
}

export type DependencyTargetList =
  | "dependencies"
  | "devDependencies"
  | "optionalDependencies"
  | "peerDependencies";

export type DependencyDefinitionInput = {
  readonly installAsAlias?: string;
  /** @default 'devDependencies' */
  readonly list?: DependencyTargetList;
  /**
   * do not resolve or install if the dependency is already present
   * @default true
   */
  readonly skipIfExists?: boolean;
  readonly rangePrefix?: "^" | "~" | "";
  /** to what extent should this dependency be managed by condu? */
  readonly managed?: ManagedDependencyConfig | false;
} & (
  | {
      /** explicit version string to be saved in package json */
      readonly version: string;
      readonly tag?: never;
    }
  | {
      /**
       * tag or a semver range to resolve the version from the npm registry
       * @default 'latest'
       **/
      readonly tag?: string | undefined;
      readonly version?: never;
    }
);

export type DependencyDefinition = DependencyDefinitionInput & {
  readonly name: string;
};

export interface Task {
  // TODO: allow matching which package the task belongs to, like with Files (matchPackage)
  readonly name: string;
  // format is any transformation in-place
  readonly type: "test" | "build" | "publish" | "format" | "start";
  readonly definition: Immutable<PartialTaskConfig>;
}
