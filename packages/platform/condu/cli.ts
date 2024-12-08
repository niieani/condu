#!/usr/bin/env bun
const IS_RUNNING_SOURCE = import.meta.url.endsWith(".ts");

import(IS_RUNNING_SOURCE ? "./main.js" : "./main.bundle.js").then(
  ({ runCli }: typeof import("./main.js")) => runCli(),
);
