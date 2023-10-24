import { Command, Option } from "clipanion";
import type { WorkspaceProjectDefined } from "../../getProjectGlobsFromMoonConfig.js";
import { loadRepoProject } from "../../loadProject.js";
import * as fs from "node:fs/promises";
import type PackageJson from "@repo/schema-types/schemas/packageJson.gen.js";
import sortPackageJson from "sort-package-json";
import * as path from "node:path";
import { createCommandContext } from "../../createCommandContext.js";
import { $ } from "../../zx.js";
import { cd } from "zx";
import { getSingleMatch, type MatchOptions } from "../../matchPackage.js";

type CommandContext = {
  log: (message: string) => void;
  error: (message: string) => void;
};

export class CreateCommand extends Command {
  static override paths = [["create"]];

  partialPath = Option.String({ required: true });
  name = Option.String("--as");

  async execute() {
    return await createCommand({
      partialPath: this.partialPath,
      name: this.name,
      context: createCommandContext(this.context),
    });
  }
}

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

  const packageJson: PackageJson = sortPackageJson({
    name: match.name,
    // copy author from workspace package.json
    author: manifest.author,
    license: manifest.license,
    description,
    type: "module",
    contributors: manifest.contributors,
    main: "esm/main.js",
    publishConfig: {
      access: "public",
    },
    ...existingPackageJson,
  });

  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(packageJson, undefined, 2),
  );

  if (!existingPackageJson) {
    // run yarn to link the new package
    cd(projectDir);
    await $`yarn`;
  }

  context.log(
    `${existingPackageJson ? "Updated" : "Created"} package ${match.name}`,
  );
}
