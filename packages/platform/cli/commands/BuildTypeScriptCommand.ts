import { Command, Option } from "clipanion";
import { buildRemappedProject } from "@condu/update-specifiers/main.js";

export class BuildTypeScriptCommand extends Command {
  static override paths = [["build-ts"]];

  project = Option.String("--project,-p");
  preset = Option.String("--preset");

  async execute() {
    await buildRemappedProject({
      tsConfigFilePath: this.project ?? "tsconfig.json",
      mappingPreset: this.preset === "ts-to-mts" ? "to-to-mts" : "ts-to-cts",
    });
  }
}
