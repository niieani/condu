import type {
  ManagedDependencyConfig,
  ConduPackageEntry,
  PackageJsonModification,
} from "./ConduPackageEntry.js";
import type { FileManager, ReadonlyFile } from "./FileManager.js";
import type { GlobalFileFlags } from "@condu/types/extendable.js";
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

  get dependencies(): ReadonlyArray<CollectedDependency> {
    return this.#changes.dependencies;
  }

  *getFilesWithFlag<FlagT extends keyof GlobalFileFlags>({
    flag,
    value,
    includeUnflagged = false,
  }: {
    flag: FlagT;
    value: GlobalFileFlags[FlagT];
    includeUnflagged?: boolean;
  }): Generator<
    [workspaceRelPath: string, file: ReadonlyFile],
    void,
    undefined
  > {
    for (const kv of this.#changes.fileManager.files.entries()) {
      const file = kv[1];
      if (
        file.flags[flag] === value ||
        (includeUnflagged && file.flags[flag] === undefined)
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

export type DependencyDefinition = {
  readonly name: string;
  readonly installAsAlias?: string;
  /** @default 'devDependencies' */
  readonly list?: DependencyTargetList;
  readonly skipIfExists?: boolean;
  readonly rangePrefix?: "^" | "~" | "";
  /** to what extent should this dependency be managed by condu? */
  readonly managed?: ManagedDependencyConfig | false;
} & (
  | {
      readonly version: string;
      readonly tag?: never;
    }
  | {
      /** @default 'latest' */
      readonly tag?: string | undefined;
      readonly version?: never;
    }
);
export interface Task {
  // TODO: allow matching which package the task belongs to, like with Files (matchPackage)
  readonly name: string;
  // format is any transformation in-place
  readonly type: "test" | "build" | "publish" | "format" | "start";
  readonly definition: Immutable<PartialTaskConfig>;
}
