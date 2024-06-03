#!/usr/bin/env bun
import { Cli, Builtins } from "clipanion";
import { ApplyCommand } from "./commands/apply/ApplyCommand.js";
import { CreateCommand } from "./commands/create/CreateCommand.js";
import { ExecCommand } from "./commands/ExecCommand.js";
import { BuildTypeScriptCommand } from "./commands/BuildTypeScriptCommand.js";
import { ReleaseCommand } from "./commands/ReleaseCommand.js";
import * as path from "node:path";
import { CORE_NAME } from "@condu/core/constants.js";

// export { apply } from "./commands/apply/apply.js";

declare global {
  var __yarnPlugin__: boolean;
}

if (!globalThis.__yarnPlugin__) {
  const [node, app, ...args] = process.argv;
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
  cli.register(Builtins.VersionCommand);
  cli.register(Builtins.HelpCommand);
  cli.runExit(args);
}
