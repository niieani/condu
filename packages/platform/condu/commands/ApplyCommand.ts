import { Command, Option } from "clipanion";
import { ConduReporter } from "../reporter/ConduReporter.js";
import { detectColorSupport, detectMode } from "../reporter/detection.js";
import type { ReporterTheme, VerbosityLevel } from "../reporter/types.js";

export class ApplyCommand extends Command {
  static override paths = [["apply"]];

  static override usage = Command.Usage({
    description:
      "Apply the latest changes to the project by creating or modifying configuration files.",
  });

  quiet = Option.Boolean("--quiet,-q", false, {
    description: "Minimal output, single line summary only",
  });

  verbose = Option.Boolean("--verbose,-v", false, {
    description: "Show detailed output including debug information",
  });

  theme = Option.String("--theme", {
    description: "Output theme: modern, retro, minimal",
  });

  noColor = Option.Boolean("--no-color", false, {
    description: "Disable colored output",
  });

  async execute() {
    // Reset any existing reporter instance
    ConduReporter.reset();

    const verbosity: VerbosityLevel = this.quiet
      ? "quiet"
      : this.verbose
        ? "verbose"
        : "normal";

    // Initialize reporter with CLI options
    ConduReporter.initialize({
      mode: this.quiet ? "quiet" : detectMode(),
      theme: (this.theme as ReporterTheme) ?? "minimal",
      verbosity,
      supportsColor: !this.noColor && detectColorSupport(),
      isInteractiveTTY: process.stdout.isTTY ?? false,
    });

    // TODO: also run: ./node_modules/.bin/moon sync projects
    const { apply } = await import("./apply/apply.js");
    await apply();
    // await $`./node_modules/.bin/moon sync projects`;
  }
}
