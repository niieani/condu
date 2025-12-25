import type {
  DefinedWorkspaceProjectConvention,
  ConduConfigWithInferredValues,
} from "../../api/configTypes.js";
import type { ConduPackageEntry } from "./ConduPackageEntry.js";

export class ConduProject {
  #workspacePackage: ConduPackageEntry<"workspace">;
  readonly workspacePackages: readonly ConduPackageEntry<"package">[];
  readonly projectConventions: DefinedWorkspaceProjectConvention[] | undefined;
  readonly config: ConduConfigWithInferredValues;
  /** all packages in the project, including the workspace package and all workspace packages */
  readonly allPackages: readonly ConduPackageEntry[];

  constructor({
    workspacePackage,
    workspacePackages,
    projectConventions,
    config,
  }: {
    workspacePackage: ConduPackageEntry<"workspace">;
    workspacePackages: readonly ConduPackageEntry<"package">[];
    projectConventions: DefinedWorkspaceProjectConvention[] | undefined;
    config: ConduConfigWithInferredValues;
  }) {
    this.#workspacePackage = workspacePackage;
    this.workspacePackages = workspacePackages;
    this.projectConventions = projectConventions;
    this.config = config;
    // if there are no projectConventions, that means we are not in a monorepo
    // in which case 'workspacePackages' will already contain the workspace package
    this.allPackages = projectConventions
      ? [workspacePackage, ...workspacePackages]
      : workspacePackages;
  }

  hasFeature(name: string) {
    return this.config.features.some((feature) => feature.name === name);
  }

  get workspace(): ConduPackageEntry<"workspace"> {
    return this.#workspacePackage;
  }

  // proxy the most important workspace package properties:
  get manifest() {
    return this.#workspacePackage.manifest;
  }

  get kind() {
    return this.#workspacePackage.kind;
  }

  get name() {
    return this.#workspacePackage.name;
  }

  get scope() {
    return this.#workspacePackage.scope;
  }

  get scopedName() {
    return this.#workspacePackage.scopedName;
  }

  get manifestRelPath() {
    return this.#workspacePackage.manifestRelPath;
  }

  get manifestAbsPath() {
    return this.#workspacePackage.manifestAbsPath;
  }

  get relPath() {
    return this.#workspacePackage.relPath;
  }

  get absPath() {
    return this.#workspacePackage.absPath;
  }

  async applyAndCommit(): Promise<void> {
    await this.#workspacePackage.applyAndCommit();
  }
}
