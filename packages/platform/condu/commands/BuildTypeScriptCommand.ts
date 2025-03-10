import type { TypeScriptPipelinePreset } from "@condu/update-specifiers/main.js";
import { Command, Option } from "clipanion";
import childProcess from "node:child_process";
import { apply } from "./apply/apply.js";
import fs from "node:fs/promises";
import path from "node:path";

export class BuildTypeScriptCommand extends Command {
  static override paths = [["tsc"]];

  static override usage = Command.Usage({
    description:
      "Build the project using TypeScript, additionally creating mts/cts versions of the code.",
  });

  opts = Option.Proxy();

  async execute() {
    let tsProject: string | undefined;
    let preset: TypeScriptPipelinePreset | undefined;
    let next: "project" | "preset" | undefined;
    const tscOpts = [];

    for (const opt of this.opts) {
      if (opt === "--preset") {
        next = "preset";
        continue;
      }
      if (next === "preset") {
        preset = opt === "ts-to-mts" ? "ts-to-mts" : "ts-to-cts";
        next = undefined;
        continue;
      }

      tscOpts.push(opt);

      if (opt === "--project" || opt === "-p") {
        next = "project";
        continue;
      }
      if (next === "project") {
        tsProject = opt;
        next = undefined;
        continue;
      }
    }

    const applyResult = await apply({ throwOnManualChanges: true });
    if (!applyResult) {
      throw new Error(
        `Unable to find a condu project in the current directory`,
      );
    }

    const { project } = applyResult;
    await fs.mkdir(
      path.join(project.absPath, project.config.conventions.buildDir),
      { recursive: true },
    );

    const tsc = childProcess.spawnSync(`tsc ${tscOpts.join(" ")}`, {
      stdio: "inherit",
      shell: true,
    });

    if (tsc.status && tsc.status !== 0) {
      console.error(new Error(`tsc exited with status code ${tsc.status}`));
      return tsc.status;
    }
    console.log("tsc built");
    const { buildTypeScriptPipeline } = await import("./buildTypeScript.js");
    await buildTypeScriptPipeline({
      tsConfigFilePath: tsProject,
      preset,
      project: project,
    });
    return 0;
  }
}
