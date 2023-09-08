import { BaseContext, Command, Option } from "clipanion";
import { equals } from "remeda";
import { WorkspaceProjectDefined } from "./getProjectGlobsFromMoonConfig.js";
import { container } from "../di/di.js";

export async function createCommand({
  partialPath,
  name,
  context,
}: {
  partialPath: string;
  name?: string;
  context: {
    log: (message: string) => void;
    error: (message: string) => void;
  };
}) {
  const project = await loadProject();
  if (!project) {
    context.error(`Unable to load project`);
    return 1;
  }
  const { projectConventions } = project;

  const conventionMatches = partialPath.startsWith("./")
    ? [{ path: partialPath, name: name ?? partialPath }]
    : getMatches({
        projectConventions,
        partialPath,
        name,
      });

  if (conventionMatches.length === 0) {
    context.error(
      `Full path for the new package could not be inferred from the workspace config and the provided partial path.`,
    );
    context.error(
      `If you want to provide the full path relative to the workspace, prefix it with './', e.g. ./${partialPath}`,
    );
    return 1;
  }

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
  context.log(`Will create package ${match.name} at ${match.path}`);
}

const createCommandContext = (context: BaseContext) => ({
  log: (message: string) => context.stdout.write(message + "\n"),
  error: (message: string) => context.stderr.write(message + "\n"),
});

export class CreateCommand extends Command {
  static paths = [["create"]];

  partialPath = Option.String({ required: true });
  name = Option.String("--as");

  async execute() {
    return await createCommand({
      partialPath: this.partialPath,
      name: this.name,
      context: createCommandContext(this.context),
    });
    // console.log({ matches: conventionMatches });

    // context.log(conventionMatches.join("\n"));
    // context.log(`Hello ${this.name}!`);
  }
}

interface ConventionMatch {
  convention: WorkspaceProjectDefined;
  path: string;
  name: string;
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
      if (conventionParts.length !== 2) {
        throw new Error(`Invalid nameConvention: ${convention.nameConvention}`);
      }
      const [left, right] = conventionParts;
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
