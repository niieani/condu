import { type BaseContext } from "clipanion";

export const createCommandContext = (context: BaseContext) => ({
  log: (message: string) => context.stdout.write(message + "\n"),
  error: (message: string) => context.stderr.write(message + "\n"),
});
