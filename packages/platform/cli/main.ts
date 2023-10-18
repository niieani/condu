#!/usr/bin/env bun
import { Cli, Builtins } from "clipanion";
import { ApplyCommand } from "./ApplyCommand.js";
import { CreateCommand } from "./CreateCommand.js";
import { ExecCommand } from "./ExecCommand.js";
import * as path from "node:path";
import { BuildTypeScriptCommand } from "./BuildTypeScript.js";

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
cli.register(Builtins.VersionCommand);
cli.register(Builtins.HelpCommand);
cli.runExit(args);
