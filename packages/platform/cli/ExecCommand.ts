import { Command, Option } from "clipanion";
import { createCommandContext } from "./createCommandContext.js";
import {
  getWorkspacePackages,
  loadRepoProject,
  type Project,
} from "./loadProject.js";
import { getSingleMatch } from "./CreateCommand.js";
import { match } from "ts-pattern";
import path from "node:path";
import fs from "node:fs/promises";
import type PackageJson from "@repo/schema-types/schemas/packageJson.js";
import { filter, find } from "remeda";
import { safeFn } from "@repo/core/utils/safeFn.js";
import { which } from "zx";
import { spawn } from "node:child_process";

export class ExecCommand extends Command {
  static override paths = [["exec"]];

  cwd = Option.String("--cwd");
  package = Option.String("--pkg");
  exec = Option.String({ required: true });
  args = Option.Proxy();

  async execute() {
    const project = await loadRepoProject();
    if (!project) {
      throw new Error(`Unable to load project`);
    }
    const { package: packageNamePart, exec, args, cwd } = this;
    const { projectDir } = project;
    const pkg = packageNamePart
      ? await findExistingPackage({
          partialPackage: packageNamePart,
          project,
        })
      : {
          dir: projectDir,
          manifest: project.manifest,
        };

    const executableTryPaths = async function* () {
      if (pkg) {
        yield path.join(pkg.dir, "node_modules", ".bin", exec);
      }
      yield path.join(projectDir, "node_modules", ".bin", exec);
      yield await which(exec, { nothrow: true });
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

    const context = createCommandContext(this.context);
    const statusCode = await new Promise<number>((resolve) => {
      const currentDirectory = cwd
        ? path.isAbsolute(cwd)
          ? cwd
          : path.normalize(path.join(process.cwd(), cwd))
        : packageNamePart
        ? pkg.dir
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
}

export async function findExistingPackage({
  partialPackage,
  project,
}: {
  partialPackage: string;
  project: Project;
}) {
  const { projectConventions, manifest, projectDir } = project;
  const matchBox = safeFn(getSingleMatch)({
    projectConventions,
    partialPath: partialPackage,
  });
  let matched = await match(matchBox)
    .with({ status: "rejected" }, () => undefined)
    .otherwise(async ({ value: matched }) => {
      const modulePath = path.join(projectDir, matched.path);
      const packageJsonPath = path.join(modulePath, "package.json");
      const existingPackageJson = await fs
        .readFile(packageJsonPath)
        .then((buffer): PackageJson => JSON.parse(buffer.toString()))
        .catch(() => undefined);
      return (
        existingPackageJson && {
          dir: modulePath,
          manifest: existingPackageJson,
        }
      );
    });

  if (!matched) {
    const packages = [
      { manifest, dir: project.dir },
      ...(await getWorkspacePackages(project)),
    ];
    matched = find(
      packages,
      ({ manifest }) => manifest.name === partialPackage,
    );
    if (!matched) {
      const matches = filter(
        packages,
        ({ dir, manifest }) =>
          manifest.name?.includes(partialPackage) ||
          dir.includes(partialPackage),
      );
      if (matches.length > 1) {
        throw new Error(
          `Ambigious matches found for ${partialPackage}:\n- ${matches
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
