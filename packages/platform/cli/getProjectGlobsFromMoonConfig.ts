import type {
  WorkspaceProjectsConvention,
  DefinedWorkspaceProjectConvention,
} from "./api/configTypes.js";
import type {
  PartialWorkspaceProjects,
  PartialWorkspaceProjectsConfig,
} from "@moonrepo/types";

export const getProjectDefinitionsFromConventionConfig = (
  projects?: WorkspaceProjectsConvention[],
): DefinedWorkspaceProjectConvention[] | undefined => {
  if (!projects) {
    return undefined;
  }
  return projects.map((project) => {
    if (typeof project === "object") {
      if ("path" in project) {
        return { ...project, glob: project.path, type: "explicit" } as const;
      }
      if ("parentPath" in project) {
        return {
          ...project,
          glob: `${project.parentPath}/*`,
          type: "glob",
        } as const;
      }
    }
    return project.includes("*")
      ? ({ glob: project, type: "glob" } as const)
      : ({ glob: project, type: "explicit" } as const);
  });
};

export const getMoonWorkspaceProjectsFromConventionConfig = (
  projects?: WorkspaceProjectsConvention[],
): PartialWorkspaceProjectsConfig => {
  if (!projects) {
    return {
      globs: [],
      sources: {},
    };
  }
  const globs: string[] = [];
  const sources: Record<string, string> = {};
  for (const project of projects) {
    if (typeof project === "object") {
      if ("path" in project) {
        if (project.name) {
          sources[project.name] = project.path;
        } else {
          globs.push(project.path);
        }
      }
      if ("parentPath" in project) {
        globs.push(`${project.parentPath}/*`);
      }
    } else {
      globs.push(project);
    }
  }
  return {
    globs,
    sources,
  };
};

export const getProjectGlobsFromMoonConfig = (
  projects?: PartialWorkspaceProjects,
): readonly string[] => {
  if (!projects) {
    return [];
  }
  if (Array.isArray(projects)) {
    return projects;
  }
  const globsOrPaths = [];
  if (typeof projects === "object") {
    if (projects.globs) {
      globsOrPaths.push(
        ...(typeof projects.globs === "string"
          ? [projects.globs]
          : projects.globs),
      );
    }
    if (projects.sources) {
      globsOrPaths.push(...Object.values(projects.sources));
    }
  }
  return globsOrPaths;
};
