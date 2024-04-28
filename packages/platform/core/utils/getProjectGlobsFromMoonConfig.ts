import type {
  PartialWorkspaceProjects,
  PartialWorkspaceProjectsConfig,
} from "@moonrepo/types";

interface ProjectConventionConfig {
  private?: boolean
}

interface ParentDirectoryProjectConvention extends ProjectConventionConfig {
  /**
   * defines how the name should be created from the project directory name.
   * '*' in the string refers to the project directory name
   * @example when '@condu/*' will name the project '@condu/utils' if the project folder is 'utils'
   * @default '*'
   **/
  nameConvention?: string;
  /**
   * defines the path to the project directory
   * @example when set to 'packages/tools' will expect that packages will live in the 'packages/tools' directory
   **/
  parentPath: string;
}

interface ExplicitPathProjectConvention extends ProjectConventionConfig {
  path: string;
  name?: string;
}

export type WorkspaceProjectsConvention =
  | ExplicitPathProjectConvention
  | ParentDirectoryProjectConvention
  | string;

export type WorkspaceProjectDefined =
  | ({
      readonly glob: string;
      readonly type: "explicit";
    } & Partial<ExplicitPathProjectConvention>)
  | ({
      readonly glob: string;
      readonly type: "glob";
    } & Partial<ParentDirectoryProjectConvention>);

export const getProjectDefinitionsFromConventionConfig = (
  projects?: WorkspaceProjectsConvention[],
): WorkspaceProjectDefined[] => {
  if (!projects) {
    return [];
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
