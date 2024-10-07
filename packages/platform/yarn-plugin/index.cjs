// @ts-check

const { spawn } = require("node:child_process");
const path = require("node:path");

const plugin = {
  name: `condu-yarn-plugin`,
  factory: (require) => {
    /**
     * @type {import("@yarnpkg/core").Plugin<import("@yarnpkg/core").Hooks>}}
     */
    const p = {
      hooks: {
        afterAllInstalled: async (project, options) => {
          const workspace = project.getWorkspaceByCwd(project.cwd);
          const isInternalCondu =
            workspace.manifest.name?.name === "condu-workspace";
          // bun packages/platform/cli/main.ts
          // TODO: should this use ts-node/tsx? or is shebang enough?
          const cmd = isInternalCondu ? "bun" : "condu";
          const args = isInternalCondu ? ["packages/platform/cli/main.ts"] : [];
          args.push("apply");

          const childProcess = spawn(cmd, args, {
            cwd: project.cwd,
            stdio: "inherit",
          });

          const processPromise = new Promise((resolve, reject) => {
            childProcess.on("error", reject);
            childProcess.on("exit", (code, signal) => {
              if (code === 0) {
                resolve();
              } else {
                reject(new Error(`Process exited with code ${code}`));
              }
            });
          });

          await processPromise;

          // await import("ts-node/esm/transpile-only");
          // const pkgCore = require("@yarnpkg/core");
          // options.report.reportInfo(pkgCore.MessageName.TIPS_NOTICE, "hello");
          // globalThis.__yarnPlugin__ = true;
          // const pathToConduCli = isInternalCondu
          //   ? path.join(
          //       project.cwd,
          //       "build/packages/platform/cli/main.bundle.js",
          //     )
          //   : "@condu/cli";
          // const { apply } = await import(pathToConduCli);
          // await apply();
        },
      },
    };
    return p;
  },
};

module.exports = plugin;
