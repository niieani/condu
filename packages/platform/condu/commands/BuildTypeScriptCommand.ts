import type { TypeScriptPipelinePreset } from "@condu/update-specifiers/main.js";
import { Command, Option } from "clipanion";
import childProcess from "node:child_process";

export class BuildTypeScriptCommand extends Command {
  static override paths = [["tsc"]];

  static override usage = Command.Usage({
    description:
      "Build the project using TypeScript, additionally creating mts/cts versions of the code.",
  });

  opts = Option.Proxy();

  async execute() {
    let project: string | undefined;
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
        project = opt;
        next = undefined;
        continue;
      }
    }

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
    await buildTypeScriptPipeline({ project, preset });
    return 0;
  }
}
