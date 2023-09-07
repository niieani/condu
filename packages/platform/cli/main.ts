#!/usr/bin/env bun
import { Cli, Builtins } from "clipanion";
import { ApplyCommand } from "./ApplyCommand.js";
import { CreateCommand } from "./CreateCommand.js";
import path from "node:path";
import { initialize } from "../core/initialize.js";

const { version, description, name } = require("../../../package.json");

const [node, app, ...args] = process.argv;

const cli = new Cli({
  binaryLabel: name,
  binaryName: `${path.basename(node)} ${path.basename(app)}`,
  binaryVersion: version,
});

initialize();
cli.register(Builtins.VersionCommand);
cli.register(Builtins.HelpCommand);
cli.register(ApplyCommand);
cli.register(CreateCommand);
cli.runExit(args);
