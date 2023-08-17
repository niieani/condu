#!/usr/bin/env bun
import { Cli, Builtins } from "clipanion";
import { ApplyCommand } from "./ApplyCommand.js";
import path from "node:path";

const { version, description, name } = require("../package.json");

const [node, app, ...args] = process.argv;

const cli = new Cli({
  binaryLabel: name,
  binaryName: `${path.basename(node)} ${path.basename(app)}`,
  binaryVersion: version,
});

cli.register(Builtins.VersionCommand);
cli.register(Builtins.HelpCommand);
cli.register(ApplyCommand);
cli.runExit(args);
