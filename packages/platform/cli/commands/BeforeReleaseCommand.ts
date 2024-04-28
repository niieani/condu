import { Command, Option } from "clipanion";

export class BeforeReleaseCommand extends Command {
  static override paths = [["before-release"]];

  static override usage = Command.Usage({
    description: "Prepare the packages for release by generating their respective package.json files.",
  });

  target = Option.String("--target");
  packages = Option.Rest();

  async execute() {
    const { beforeReleasePipeline } = await import("./beforeRelease.js");
    await beforeReleasePipeline(this);
  }
}
