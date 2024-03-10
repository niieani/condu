import { Command, Option } from "clipanion";

export class BuildTypeScriptCommand extends Command {
  static override paths = [["build-ts"]];

  project = Option.String("--project,-p");
  preset = Option.String("--preset");

  async execute() {
    const { buildRemappedProject } = await import(
      "@condu/update-specifiers/main.js"
    );
    await buildRemappedProject({
      tsConfigFilePath: this.project ?? "tsconfig.json",
      mappingPreset: this.preset === "ts-to-mts" ? "to-to-mts" : "ts-to-cts",
    });
  }
}
