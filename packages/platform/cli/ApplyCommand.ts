import { Command, Option } from "clipanion";
import { apply } from "./apply.js";
import { $ } from "./zx.js";

export class ApplyCommand extends Command {
  static override paths = [["apply"]];

  // name = Option.String();

  async execute() {
    // TODO: also run: ./node_modules/@moonrepo/cli/moon sync projects
    await apply();
    await $`./node_modules/@moonrepo/cli/moon sync projects`;

    // this.context.stdout.write(`Hello ${this.name}!\n`);
  }
}
