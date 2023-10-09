import { Command, Option } from "clipanion";
import { equals } from "remeda";
import type { WorkspaceProjectDefined } from "./getProjectGlobsFromMoonConfig.js";
import { loadRepoProject } from "./loadProject.js";
import fs from "node:fs/promises";
// import { PackageManifest } from "@pnpm/types";
import type PackageJson from "@repo/schema-types/schemas/packageJson.js";
import sortPackageJson from "sort-package-json";
import path from "node:path";
import { createCommandContext } from "./createCommandContext.js";

type CommandContext = {
  log: (message: string) => void;
  error: (message: string) => void;
};

// import { $ } from "zx";

// const gitUser = (await $`git config user.name`).stdout.trim();
// const gitEmail = (await $`git config user.email`).stdout.trim();

export function getSingleMatch({
  partialPath,
  name,
  projectConventions,
}: MatchOptions & {
  projectConventions: WorkspaceProjectDefined[];
}): Match {
  const conventionMatches = partialPath.startsWith("./")
    ? [{ path: partialPath.slice(2), name: name ?? partialPath.slice(2) }]
    : getConventionMatches({
        projectConventions,
        partialPath,
        name,
      });

  if (conventionMatches.length > 1) {
    throw new Error(
      `Multiple possible paths for the package were inferred from the workspace config:\n` +
        `- ${conventionMatches
          .map(({ path, name }) => `${path} (as ${name})`)
          .join("\n- ")}\n\n` +
        `Please prefix your package name with its parent directory to disambiguate.`,
    );
  }

  const [match] = conventionMatches;

  if (!match) {
    throw new Error(
      `Full path for the new package could not be inferred from the workspace config and the provided partial path.\n` +
        `If you're trying to provide the full path relative to the workspace, prefix it with './', e.g. ./${partialPath}`,
    );
  }

  return match;
}

export interface MatchOptions {
  partialPath: string;
  name?: string;
}

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

interface ConventionMatch {
  convention: WorkspaceProjectDefined;
  path: string;
  name: string;
}

type Match =
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

  await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));

  context.log(
    `${existingPackageJson ? "Updated" : "Created"} package ${match.name}`,
  );
}

function getConventionMatches({
  projectConventions,
  partialPath,
  name,
}: {
  projectConventions: WorkspaceProjectDefined[];
  /** the partial path or full package name */
  partialPath: string;
  name?: string;
}): ConventionMatch[] {
  const pathParts = partialPath.split("/");
  return projectConventions.flatMap((convention) => {
    const { glob: projectGlob, type } = convention;
    if (type !== "glob" || !projectGlob.endsWith("/*")) return [];
    // support the case where you specify a package name as partialPath
    if (
      !name &&
      convention.nameConvention &&
      convention.nameConvention !== "*"
    ) {
      const conventionParts = convention.nameConvention.split("*");
      const [left, right, ...rest] = conventionParts;
      if (left === undefined || right === undefined || rest.length > 0) {
        throw new Error(
          `Invalid nameConvention: ${convention.nameConvention}.`,
        );
      }
      if (partialPath.startsWith(left) && partialPath.endsWith(right)) {
        const dirName = partialPath.slice(
          left.length,
          right !== "" ? -right.length : undefined,
        );
        if (!dirName.includes("/")) {
          return [
            {
              convention,
              path: [convention.parentPath, dirName].join("/"),
              name: partialPath,
            },
          ];
        }
      }
    }
    const globParts = projectGlob.split("/");
    const dirName = pathParts.at(-1) ?? partialPath;
    const conventionalName = convention.nameConvention
      ? convention.nameConvention.replace("*", dirName)
      : dirName;

    if (pathParts.length === 1) {
      return [
        {
          convention,
          path: [...globParts.slice(0, -1), partialPath].join("/"),
          name: conventionalName,
        },
      ];
    }

    const pathPartsToMatch = pathParts.slice(0, -1);
    const globPartsToMatch = globParts.slice(-pathPartsToMatch.length - 1, -1);

    if (equals(pathPartsToMatch, globPartsToMatch)) {
      return [
        {
          convention,
          path: [...globParts.slice(0, -pathParts.length), partialPath].join(
            "/",
          ),
          name: conventionalName,
        },
      ];
    }

    return [];
  });
}
