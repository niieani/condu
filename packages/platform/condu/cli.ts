#!/usr/bin/env bun
import { Cli, Builtins } from "clipanion";
import { ApplyCommand } from "./commands/ApplyCommand.js";
import { CreateCommand } from "./commands/create/CreateCommand.js";
import { ExecCommand } from "./commands/ExecCommand.js";
import { BuildTypeScriptCommand } from "./commands/BuildTypeScriptCommand.js";
import { ReleaseCommand } from "./commands/ReleaseCommand.js";
import { CORE_NAME } from "./constants.js";
import { InitCommand } from "./commands/init.js";
import * as path from "node:path";

export const runCli = (argv: string[] = process.argv) => {
  const [node, app, ...args] = argv;
  if (!node || !app) {
    throw new Error(`Unable to determine binary name`);
  }

  const cli = new Cli({
    binaryLabel: CORE_NAME,
    binaryName: `${path.basename(node)} ${CORE_NAME}`,
    // binaryVersion: version,
  });

  cli.register(ApplyCommand);
  cli.register(CreateCommand);
  cli.register(ExecCommand);
  cli.register(BuildTypeScriptCommand);
  cli.register(ReleaseCommand);
  cli.register(InitCommand);
  cli.register(Builtins.VersionCommand);
  cli.register(Builtins.HelpCommand);
  return cli.runExit(args);
};
