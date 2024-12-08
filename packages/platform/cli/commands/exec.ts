import type { BaseContext } from "clipanion";
import { createCommandContext } from "../createCommandContext.js";
import { loadConduProject } from "../loadProject.js";
import type { ConduPackageEntry } from "./apply/ConduPackageEntry.js";
import type {
  IPackageEntry,
  WorkspaceSubPackage,
} from "@condu/workspace-utils/packageJsonTypes.js";
import { getSingleMatch } from "../matchPackage.js";
import { match } from "ts-pattern";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { filter, find } from "remeda";
import { safeFn } from "@condu/core/utils/safeFn.js";
import { spawn } from "node:child_process";
import which from "which";
import { getPackage } from "@condu/workspace-utils/topo.js";
import type { ConduProject } from "./apply/ConduProject.js";

export async function execCommand(input: {
  cwd?: string;
  package?: string;
  exec: string;
  args: string[];
  context: BaseContext;
}) {
  const project = await loadConduProject();
  if (!project) {
    throw new Error(`Unable to load project`);
  }
  if (!project.projectConventions) {
    throw new Error(
      `Project not configured as a monorepo. Specify 'projects' in .config/condu.ts first.`,
    );
  }
  const { package: packageNamePart, exec, args, cwd } = input;
  const pkg = packageNamePart
    ? await findExistingPackage({
        partialPackage: packageNamePart,
        project,
      })
    : project;

  const executableTryPaths = async function* () {
    if (pkg) {
      yield path.join(pkg.absPath, "node_modules", ".bin", exec);
    }
    yield path.join(project.absPath, "node_modules", ".bin", exec);
    const globalPath = await which(exec, { nothrow: true });
    if (globalPath) {
      yield globalPath;
    }
    throw new Error(`Unable to find executable: ${exec}`);
  };
  let executable: string;
  for await (const tryPath of executableTryPaths()) {
    if (
      await fs
        .access(tryPath, fs.constants.F_OK | fs.constants.X_OK)
        .then(() => true)
        .catch(() => false)
    ) {
      executable = tryPath;
      break;
    }
  }

  const context = createCommandContext(input.context);
  const statusCode = await new Promise<number>((resolve) => {
    const currentDirectory = cwd
      ? path.isAbsolute(cwd)
        ? cwd
        : path.normalize(path.join(process.cwd(), cwd))
      : packageNamePart
        ? path.join(project.absPath, pkg.relPath)
        : process.cwd();
    context.log(
      `${
        pkg.manifest.name
      }: \ncd ${currentDirectory}\n${executable} ${args.join(" ")}`,
    );
    const subProcess = spawn(executable, args, {
      cwd: currentDirectory,
      stdio: "inherit",
      shell: true,
    });
    subProcess.on("exit", resolve);
  });

  return statusCode;
}

export async function findExistingPackage({
  partialPackage,
  project,
}: {
  partialPackage: string;
  project: ConduProject;
}): Promise<ConduPackageEntry> {
  const {
    projectConventions,
    absPath: workspaceDirAbs,
    workspacePackages,
  } = project;

  if (projectConventions) {
    const matchBox = safeFn(getSingleMatch)({
      projectConventions,
      partialPath: partialPackage,
    });
    const matched = await match(matchBox)
      .with({ status: "rejected" }, () => undefined)
      .otherwise(async ({ value: matched }) => {
        const modulePath = path.join(workspaceDirAbs, matched.path);
        return workspacePackages.find((pkg) => pkg.absPath === modulePath);
      });
    if (matched) {
      return matched;
    }
  }

  const packages = [project.workspace, ...project.workspacePackages];
  const matched = find(
    packages,
    ({ manifest }) => manifest.name === partialPackage,
  );
  if (matched) {
    return matched;
  }
  const matches = filter(
    packages,
    ({ relPath, manifest }) =>
      manifest.name?.includes(partialPackage) ||
      relPath.includes(partialPackage),
  );
  if (matches.length > 1) {
    throw new Error(
      `Ambiguous matches found for ${partialPackage}:\n- ${matches
        .map(({ manifest }) => manifest.name)
        .join("\n- ")}`,
    );
  }
  if (matches[0]) {
    return matches[0];
  }

  throw new Error(`Unable to find a package by "${partialPackage}"`);
}
