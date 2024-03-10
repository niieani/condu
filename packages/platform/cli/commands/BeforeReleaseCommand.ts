import { Command, Option } from "clipanion";

export class BeforeReleaseCommand extends Command {
  static override paths = [["before-release"]];

  // partialPath = Option.String({ required: true });
  // name = Option.String("--as");
  target = Option.String("--target");
  project = Option.String("--project,-p");
  preset = Option.String("--preset");
  packages = Option.Rest();

  async execute() {
    const { beforeReleasePipeline } = await import("./beforeRelease.js");
    await beforeReleasePipeline(this);
  }
}
