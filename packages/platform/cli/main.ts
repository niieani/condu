#!/usr/bin/env bun
import { Cli, Builtins } from "clipanion";
import { ApplyCommand } from "./commands/apply/ApplyCommand.js";
import { CreateCommand } from "./commands/create/CreateCommand.js";
import { ExecCommand } from "./commands/ExecCommand.js";
import * as path from "node:path";
import { BuildTypeScriptCommand } from "./commands/BuildTypeScriptCommand.js";
import { BeforeReleaseCommand } from "./commands/BeforeReleaseCommand.js";

const { version, description, name } = require("../../../package.json");

const [node, app, ...args] = process.argv;
if (!node || !app) {
  throw new Error(`Unable to determine binary name`);
}

const cli = new Cli({
  binaryLabel: name,
  binaryName: `${path.basename(node)} ${path.basename(app)}`,
  binaryVersion: version,
});

cli.register(ApplyCommand);
cli.register(CreateCommand);
cli.register(ExecCommand);
cli.register(BuildTypeScriptCommand);
cli.register(BeforeReleaseCommand);
cli.register(Builtins.VersionCommand);
cli.register(Builtins.HelpCommand);
cli.runExit(args);
