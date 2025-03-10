import * as path from "node:path";
import { correctSourceMaps } from "@condu/core/utils/correctSourceMaps.js";
import {
  buildRemappedProject,
  type TypeScriptPipelinePreset,
} from "@condu/update-specifiers/main.js";
import type { ConduProject } from "./apply/ConduProject.js";

export async function buildTypeScriptPipeline(input: {
  tsConfigFilePath?: string;
  project: ConduProject;
  preset?: TypeScriptPipelinePreset;
}) {
  const { project } = input;
  const { config } = project;
  // TODO: make conventions non-optional in a loaded project
  const buildDirName = config.conventions.buildDir;
  const absBuildDir = path.join(project.absPath, buildDirName);

  try {
    await correctSourceMaps({ buildDir: absBuildDir });
  } catch (error) {
    console.error(`Error correcting source maps in ${absBuildDir}:\n${error}`);
  }

  if (!input.preset) return;

  // TODO: just run the command in parallel during build?
  console.log(`Building remapped project (${input.preset})...`);
  await buildRemappedProject({
    tsConfigFilePath: input.tsConfigFilePath ?? "tsconfig.json",
    mappingPreset: input.preset === "ts-to-mts" ? "ts-to-mts" : "ts-to-cts",
  });
}
