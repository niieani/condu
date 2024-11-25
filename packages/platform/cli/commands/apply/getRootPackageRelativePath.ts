import type {
  WorkspaceRootPackage,
  WorkspaceSubPackage,
} from "./ConduPackageEntry.js";
import type { ConduPackageEntry } from "./ConduPackageEntry.js";

export function getRootPackageRelativePath({
  rootRelativePath,
  rootPackage,
  packages,
}: RootRelativePackageResolutionOptions): {
  targetPackage: ConduPackageEntry;
  packageRelativePath: string;
} {
  for (const pkg of packages) {
    if (rootRelativePath.startsWith(pkg.relPath)) {
      const packageRelativePath = rootRelativePath.slice(pkg.relPath.length);
      return {
        targetPackage: pkg,
        packageRelativePath,
      };
    }
  }

  return {
    targetPackage: rootPackage,
    packageRelativePath: rootRelativePath,
  };
}

export interface RootRelativePackageResolutionOptions {
  rootRelativePath: string;
  rootPackage: WorkspaceRootPackage;
  packages: readonly WorkspaceSubPackage[];
}
