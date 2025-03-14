import { isDeepEqual } from "remeda";
import type { DefinedWorkspaceProjectConvention } from "./api/configTypes.js";
import type { Match, ConventionMatch } from "./commands/create/create.js";

export interface MatchOptions {
  partialPath: string;
  name?: string | undefined;
}

export function getSingleMatch({
  partialPath,
  name,
  projectConventions,
}: MatchOptions & {
  projectConventions: DefinedWorkspaceProjectConvention[];
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

export function getConventionMatches({
  projectConventions,
  partialPath,
  name,
}: {
  projectConventions: DefinedWorkspaceProjectConvention[];
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

    if (isDeepEqual(pathPartsToMatch, globPartsToMatch)) {
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
