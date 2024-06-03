import { Command, Option } from "clipanion";

export class ReleaseCommand extends Command {
  static override paths = [["release"]];

  static override usage = Command.Usage({
    description:
      "Prepare the packages for release by generating their respective package.json files.",
  });

  ci = Option.Boolean("--ci", {
    description: `All packages that are not requested to be published will be marked as private.`,
  });
  npmTag = Option.String("--npm-tag", {
    description: `The tag to use when publishing packages.`,
  });
  dryRun = Option.Boolean("--dry-run", {
    description: `Do not actually publish anything.`,
  });
  packages = Option.Rest({ name: "packages" });

  async execute() {
    const { releasePipeline } = await import("./release.js");
    await releasePipeline(this);
  }
}
