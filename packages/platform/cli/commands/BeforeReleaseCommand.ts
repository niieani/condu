import { Command, Option } from "clipanion";

export class BeforeReleaseCommand extends Command {
  static override paths = [["before-release"]];

  static override usage = Command.Usage({
    description:
      "Prepare the packages for release by generating their respective package.json files.",
  });

  ci = Option.Boolean("--ci", {
    description: `All packages that are not requested to be published will be marked as private.`,
  });
  packages = Option.Rest({ name: "packages" });

  async execute() {
    const { beforeReleasePipeline } = await import("./beforeRelease.js");
    await beforeReleasePipeline(this);
  }
}
