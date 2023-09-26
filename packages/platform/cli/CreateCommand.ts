import { type BaseContext, Command, Option } from "clipanion";
import { equals } from "remeda";
import type { WorkspaceProjectDefined } from "./getProjectGlobsFromMoonConfig.js";
import { loadProject } from "./loadProject.js";
import fs from "node:fs/promises";
import { satisfies } from "semver";
// import { PackageManifest } from "@pnpm/types";
import type PackageJson from "../schema-types/schemas/packageJson.js";
import sortPackageJson from "sort-package-json";
import path from "node:path";

type CommandContext = {
  log: (message: string) => void;
  error: (message: string) => void;
};

// import { $ } from "zx";

// const gitUser = (await $`git config user.name`).stdout.trim();
// const gitEmail = (await $`git config user.email`).stdout.trim();

export async function createCommand({
  partialPath,
  description,
  name,
  context,
}: {
  partialPath: string;
  description?: string;
  name?: string;
  context: CommandContext;
}) {
  const project = await loadProject();
  if (!project) {
    context.error(`Unable to load project`);
    return 1;
  }
  const { projectConventions, manifest, projectDir } = project;

  const conventionMatches = partialPath.startsWith("./")
    ? [{ path: partialPath, name: name ?? partialPath }]
    : getMatches({
        projectConventions,
        partialPath,
        name,
      });

  if (conventionMatches.length > 1) {
    context.error(
      `Multiple possible paths for the new package were inferred from the workspace config:`,
    );
    context.error(
      `- ${conventionMatches
        .map(({ path, name }) => `${path} (as ${name})`)
        .join("\n- ")}\n`,
    );
    context.error(
      `Please prefix your package name with its parent directory to disambiguate.`,
    );
    return 1;
  }

  const [match] = conventionMatches;

  if (!match) {
    context.error(
      `Full path for the new package could not be inferred from the workspace config and the provided partial path.`,
    );
    context.error(
      `If you're trying to provide the full path relative to the workspace, prefix it with './', e.g. ./${partialPath}`,
    );
    return 1;
  }

  context.log(`Will create package ${match.name} at ${match.path}`);

  // TODO: do I want to add prompts for description with inquirer package?
  // maybe not, since the workflow should be as simple as possible
  // and the user can always edit the package.json after creation
  await createPackage({ match, manifest, description, projectDir, context });
}

const createCommandContext = (context: BaseContext) => ({
  log: (message: string) => context.stdout.write(message + "\n"),
  error: (message: string) => context.stderr.write(message + "\n"),
});

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

export async function createPackage({
  match,
  manifest,
  description,
  projectDir,
  context,
}: {
  match: ConventionMatch | { path: string; name: string };
  manifest: PackageJson;
  description: string | undefined;
  projectDir: string;
  context: CommandContext;
}) {
  const modulePath = path.join(projectDir, match.path);
  await fs.mkdir(modulePath, { recursive: true });
  const packageJsonPath = path.join(modulePath, "package.json");
  const existingPackageJson = await fs
    .readFile(packageJsonPath)
    .then((buffer): PackageJson => JSON.parse(buffer.toString()))
    .catch(() => false as const);

  if (existingPackageJson) {
    context.log(
      `Package ${match.name} already exists. Filling in missing fields only.`,
    );
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

function getMatches({
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
      if (!left || !right || rest.length > 0) {
        throw new Error(`Invalid nameConvention: ${convention.nameConvention}`);
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
