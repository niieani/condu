import { Command } from "clipanion";

export class ApplyCommand extends Command {
  static override paths = [["apply"]];

  static override usage = Command.Usage({
    description:
      "Apply the latest changes to the project by creating or modifying configuration files.",
  });

  // name = Option.String();

  async execute() {
    // TODO: also run: ./node_modules/.bin/moon sync projects
    const { apply } = await import("./apply/apply.js");
    await apply();
    // await $`./node_modules/.bin/moon sync projects`;

    // this.context.stdout.write(`Hello ${this.name}!\n`);
  }
}
