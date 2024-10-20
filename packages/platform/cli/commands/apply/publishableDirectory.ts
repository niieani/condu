import type { Project, WorkspaceSubPackage } from "@condu/types/configTypes.js";
import path from "node:path";

export function getPublishablePackageDirectory(
  project: Project,
  pkg: Pick<WorkspaceSubPackage, "relPath" | "manifest">,
): string {
  return path.join(
    project.absPath,
    project.config.conventions.buildDir,
    pkg.relPath,
  );
}

export function getRelativePublishConfigDirectory(
  project: Project,
  pkg: Pick<WorkspaceSubPackage, "relPath" | "manifest">,
): string {
  // see https://pnpm.io/package_json#publishconfigdirectory
  const originalPackageDir = path.join(project.absPath, pkg.relPath);
  const publishablePackageDir = getPublishablePackageDirectory(project, pkg);
  const relativePath = path.relative(originalPackageDir, publishablePackageDir);
  return relativePath;
}

async function ensurePublishConfigDirectorySetInManifestFiles(
  project: Project,
) {
  for (const pkg of await project.getWorkspacePackages()) {
    // ensure there's a publishConfig.directory set for each package
    const relativePath = getRelativePublishConfigDirectory(project, pkg);
    const publishableDirectory = pkg.manifest.publishConfig?.["directory"];
    // if (publishableDirectory) {
    //   delete pkg.manifest.publishConfig;
    //   await pkg.writeProjectManifest(pkg.manifest);
    // }
    if (publishableDirectory !== relativePath) {
      pkg.manifest.publishConfig ??= {};
      pkg.manifest.publishConfig["directory"] = relativePath;
      await pkg.writeProjectManifest(pkg.manifest);
    }
  }
}
