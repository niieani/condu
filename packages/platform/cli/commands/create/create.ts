import type {
  Project,
  WorkspaceProjectDefined,
} from "@condu/types/configTypes.js";
import { loadConduProject } from "../../loadProject.js";
import * as fs from "node:fs/promises";
import type { PackageJson } from "@condu/schema-types/schemas/packageJson.gen.js";
import { sortPackageJson } from "sort-package-json";
import * as path from "node:path";
import { getSingleMatch, type MatchOptions } from "../../matchPackage.js";
import type { CommandContext } from "./CreateCommand.js";
import childProcess from "node:child_process";
import { copyFiles } from "@condu/core/utils/copy.js";
import { pick } from "remeda";

// const gitUser = (await $`git config user.name`).stdout.trim();
// const gitEmail = (await $`git config user.email`).stdout.trim();

export interface CreateOptions extends MatchOptions {
  description?: string;
  context: CommandContext;
  private?: boolean;
}

export async function createCommand({
  partialPath,
  description,
  name,
  context,
  ...rest
}: CreateOptions) {
  const project = await loadConduProject();
  if (!project) {
    throw new Error(`Unable to load project`);
  }
  const { projectConventions } = project;

  if (!projectConventions) {
    throw new Error(
      `Project not configured as a monorepo. Specify 'projects' in .config/condu.ts first.`,
    );
  }

  const match = getSingleMatch({
    projectConventions,
    partialPath,
    name,
  });

  context.log(`Will create package ${match.name} at ${match.path}`);

  // TODO: do I want to add prompts for description with inquirer package?
  // maybe not, since the workflow should be as simple as possible
  // and the user can always edit the package.json after creation
  await createPackage({ match, project, description, context, ...rest });
}

export interface ConventionMatch {
  convention: WorkspaceProjectDefined;
  path: string;
  name: string;
}

export type Match =
  | ConventionMatch
  | {
      path: string;
      name: string;
    };

export async function createPackage({
  match,
  project,
  description,
  context,
  private: privatePackage,
}: {
  match: Match;
  project: Project;
  description: string | undefined;
  private?: boolean;
  context: CommandContext;
}) {
  const modulePath = path.normalize(path.join(project.absPath, match.path));
  const packageJsonPath = path.join(modulePath, "package.json");
  const convention = "convention" in match ? match.convention : undefined;
  const isPrivate = privatePackage || convention?.private;
  const templatePath =
    convention?.templatePath && path.isAbsolute(convention.templatePath)
      ? path.join(project.absPath, convention.templatePath)
      : path.join(modulePath, convention?.templatePath ?? "@template");
  const templateExists = await fs
    .access(templatePath, fs.constants.F_OK | fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);

  const preexistingPackage = await fs
    .access(packageJsonPath, fs.constants.R_OK)
    .then(() => true)
    .catch(() => false);

  if (preexistingPackage) {
    context.log(
      `Package ${match.name} already exists. Adding missing fields/template files only.`,
    );
  }

  if (templateExists) {
    await copyFiles({
      sourceDir: templatePath,
      targetDir: modulePath,
      overwrite: false,
      keep: ({ entry }) =>
        (entry.isDirectory() && entry.name !== "node_modules") ||
        (entry.isFile() &&
          entry.name !== "package.json" &&
          entry.name !== "CHANGELOG.md"),
    });
  }

  const existingPackageJson = await fs
    .readFile(packageJsonPath)
    .then((buffer): PackageJson => JSON.parse(buffer.toString()))
    .catch(() => false as const);

  const templatePackageJsonPath = path.join(templatePath, "package.json");
  const templatePackageJson =
    templateExists &&
    (await fs
      .readFile(templatePackageJsonPath)
      .then((buffer): PackageJson => JSON.parse(buffer.toString()))
      .catch(() => false as const));

  if (!existingPackageJson && !templateExists) {
    // might need to create the directory
    await fs.mkdir(modulePath, { recursive: true });
  }

  const packageJson: PackageJson = sortPackageJson({
    name: match.name,
    description,
    version: "0.0.0",
    type: "module",
    // note: skip author, license, contributors, as these will be applied when running 'release'
    // the user can override them by specifying them though!
    // author: project.manifest.author,
    // license: project.manifest.license,
    // contributors: project.manifest.contributors,
    ...(isPrivate
      ? { private: isPrivate }
      : { publishConfig: { access: "public" } }),
    sideEffects: false,
    ...(templatePackageJson
      ? pick(templatePackageJson, [
          "dependencies",
          "devDependencies",
          "peerDependencies",
          "peerDependenciesMeta",
        ])
      : {}),
    ...existingPackageJson,
  });

  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(packageJson, undefined, 2),
  );

  if (!existingPackageJson) {
    const installShellCmd = `${project.config.node.packageManager.name} install`;
    const installProcess = childProcess.spawnSync(installShellCmd, {
      stdio: "inherit",
      shell: true,
      cwd: project.absPath,
    });
    if (installProcess.status !== 0) {
      context.error(
        `${installShellCmd} exited with status code ${installProcess.status}`,
      );
    }
  }

  context.log(
    `${existingPackageJson ? "Updated" : "Created"} package ${match.name}`,
  );
}
