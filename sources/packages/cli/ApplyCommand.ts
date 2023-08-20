import { Command, Option } from "clipanion";
import { apply } from "./apply.js";

export class ApplyCommand extends Command {
  static paths = [["apply"]];

  // name = Option.String();

  async execute() {
    await apply();
    // this.context.stdout.write(`Hello ${this.name}!\n`);
  }
}
