import { Command, Option } from "clipanion";
import { apply } from "./apply.js";

export class ApplyCommand extends Command {
  static paths = [["apply"]];

  // name = Option.String();

  async execute() {
    // TODO: also run: ./node_modules/@moonrepo/cli/moon sync projects
    await apply();
    // this.context.stdout.write(`Hello ${this.name}!\n`);
  }
}
