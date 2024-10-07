import { Command, Option } from "clipanion";
import { createCommandContext } from "../../createCommandContext.js";

export type CommandContext = {
  log: (message: string) => void;
  error: (message: string) => void;
};

export class CreateCommand extends Command {
  static override paths = [["create"]];

  static override usage = Command.Usage({
    description:
      "Create new packages using the conventions defined in the project configuration.",
  });

  partialPath = Option.String({ required: true });
  name = Option.String("--as");

  async execute() {
    const { createCommand } = await import("./create.js");

    return await createCommand({
      partialPath: this.partialPath,
      name: this.name,
      context: createCommandContext(this.context),
    });
  }
}
