import type {
  ConduPackageEntry,
  WorkspaceRootPackage,
  WorkspaceSubPackage,
} from "./ConduPackageEntry.js";

export interface RootRelativePackageResolutionOptions {
  rootRelativePath: string;
  rootPackage: WorkspaceRootPackage;
  packages: readonly WorkspaceSubPackage[];
}

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
