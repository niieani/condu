import type { BaseContext } from "clipanion";
import { createCommandContext } from "../createCommandContext.js";
import { getWorkspacePackages, loadRepoProject } from "../loadProject.js";
import type { Project } from "@condu/core/configTypes.js";
import { getSingleMatch } from "../matchPackage.js";
import { match } from "ts-pattern";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";
import { filter, find } from "remeda";
import { safeFn } from "@condu/core/utils/safeFn.js";
import { spawn } from "node:child_process";
import which from "which";

export async function execCommand(input: {
  cwd?: string;
  package?: string;
  exec: string;
  args: string[];
  context: BaseContext;
}) {
  const project = await loadRepoProject();
  if (!project) {
    throw new Error(`Unable to load project`);
  }
  const { package: packageNamePart, exec, args, cwd } = input;
  const pkg = packageNamePart
    ? await findExistingPackage({
        partialPackage: packageNamePart,
        project,
      })
    : {
        relPath: project.relPath,
        absPath: project.absPath,
        manifest: project.manifest,
      };

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
  project: Project;
}) {
  const { projectConventions, manifest, absPath: workspaceDirAbs } = project;
  const matchBox = safeFn(getSingleMatch)({
    projectConventions,
    partialPath: partialPackage,
  });
  let matched = await match(matchBox)
    .with({ status: "rejected" }, () => undefined)
    .otherwise(async ({ value: matched }) => {
      const modulePath = path.join(workspaceDirAbs, matched.path);
      const packageJsonPath = path.join(modulePath, "package.json");
      const existingPackageJson = await fs
        .readFile(packageJsonPath)
        .then((buffer): PackageJson => JSON.parse(buffer.toString()))
        .catch(() => undefined);
      return (
        existingPackageJson && {
          absPath: modulePath,
          relPath: path.relative(workspaceDirAbs, modulePath),
          manifest: existingPackageJson,
        }
      );
    });

  if (!matched) {
    const packages = [project, ...(await project.getWorkspacePackages())];
    matched = find(
      packages,
      ({ manifest }) => manifest.name === partialPackage,
    );
    if (!matched) {
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
      matched = matches[0];
    }
  }

  if (!matched) {
    throw new Error(`Unable to find a package by "${partialPackage}"`);
  }

  return matched;
}
