import { Command, Option } from "clipanion";

export class ExecCommand extends Command {
  static override paths = [["exec"]];

  static override usage = Command.Usage({
    description: "Execute a command in the context of the selected package.",
  });

  cwd = Option.String("--cwd");
  package = Option.String("--pkg");
  exec = Option.String({ required: true });
  args = Option.Proxy();

  async execute() {
    const { execCommand } = await import("./exec.js");
    return await execCommand(this);
  }
}
