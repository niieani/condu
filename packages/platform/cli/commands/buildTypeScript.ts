import * as path from "node:path";
import { correctSourceMaps } from "@condu/core/utils/correctSourceMaps.js";
import {
  buildRemappedProject,
  type TypeScriptPipelinePreset,
} from "@condu/update-specifiers/main.js";
import { apply } from "./apply/apply.js";

export async function buildTypeScriptPipeline(input: {
  project?: string;
  preset?: TypeScriptPipelinePreset;
}) {
  const applyResult = await apply({ throwOnManualChanges: true });
  if (!applyResult) {
    throw new Error(`Unable to find a condu project in the current directory`);
  }
  const { project } = applyResult;
  const { projectDir, config } = project;
  // TODO: make conventions non-optional in a loaded project
  const buildDirName = config.conventions.buildDir;
  const absBuildDir = path.join(projectDir, buildDirName);

  await correctSourceMaps({ buildDir: absBuildDir });

  if (!input.preset) return;

  // TODO: just run the command in parallel during build?
  console.log(`Building remapped project (${input.preset})...`);
  await buildRemappedProject({
    tsConfigFilePath: input.project ?? "tsconfig.json",
    mappingPreset: input.preset === "ts-to-mts" ? "ts-to-mts" : "ts-to-cts",
  });
}
