import type { WorkspaceProjectDefined } from "../../../core/utils/getProjectGlobsFromMoonConfig.js";
import { loadRepoProject } from "../../loadProject.js";
import * as fs from "node:fs/promises";
import type PackageJson from "@condu/schema-types/schemas/packageJson.gen.js";
import sortPackageJson from "sort-package-json";
import * as path from "node:path";
import { cd } from "zx";
import { getSingleMatch, type MatchOptions } from "../../matchPackage.js";
import type { CommandContext } from "./CreateCommand.js";
import childProcess from "node:child_process";

// const gitUser = (await $`git config user.name`).stdout.trim();
// const gitEmail = (await $`git config user.email`).stdout.trim();

export interface CreateOptions extends MatchOptions {
  description?: string;
  context: CommandContext;
}

export async function createCommand({
  partialPath,
  description,
  name,
  context,
}: CreateOptions) {
  const project = await loadRepoProject();
  if (!project) {
    throw new Error(`Unable to load project`);
  }
  const { projectConventions, manifest, dir: projectDir } = project;

  const match = getSingleMatch({
    projectConventions,
    partialPath,
    name,
  });

  context.log(`Will create package ${match.name} at ${match.path}`);

  // TODO: do I want to add prompts for description with inquirer package?
  // maybe not, since the workflow should be as simple as possible
  // and the user can always edit the package.json after creation
  await createPackage({ match, manifest, description, projectDir, context });
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
  manifest,
  description,
  projectDir,
  context,
}: {
  match: Match;
  manifest: PackageJson;
  description: string | undefined;
  projectDir: string;
  context: CommandContext;
}) {
  const modulePath = path.normalize(path.join(projectDir, match.path));
  const packageJsonPath = path.join(modulePath, "package.json");
  const existingPackageJson = await fs
    .readFile(packageJsonPath)
    .then((buffer): PackageJson => JSON.parse(buffer.toString()))
    .catch(() => false as const);

  if (existingPackageJson) {
    context.log(
      `Package ${match.name} already exists. Filling in missing fields only.`,
    );
  } else {
    // might need to create the directory
    await fs.mkdir(modulePath, { recursive: true });
  }

  const convention = "convention" in match ? match.convention : undefined;
  const isPrivate = convention?.private;

  const packageJson: PackageJson = sortPackageJson({
    name: match.name,
    description,
    version: "0.0.0",
    type: "module",
    // copy author from workspace package.json
    author: manifest.author,
    license: manifest.license,
    contributors: manifest.contributors,
    ...(isPrivate
      ? { private: isPrivate }
      : { publishConfig: { access: "public" } }),
    ...existingPackageJson,
  });

  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(packageJson, undefined, 2),
  );

  if (!existingPackageJson) {
    // run yarn to link the new package
    cd(projectDir);
    // TODO: use correct package manager

    const yarn = childProcess.spawnSync(`yarn install`, {
      stdio: "inherit",
      shell: true,
    });
    if (yarn.status !== 0) {
      context.error(`yarn exited with status code ${yarn.status}`);
    }
  }

  context.log(
    `${existingPackageJson ? "Updated" : "Created"} package ${match.name}`,
  );
}
