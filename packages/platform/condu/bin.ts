#!/usr/bin/env bun
const IS_RUNNING_SOURCE = import.meta.url.endsWith(".ts");

import(IS_RUNNING_SOURCE ? "./index.js" : "./index.bundle.js").then(
  ({ runCli }: typeof import("./index.js")) => runCli(),
);
