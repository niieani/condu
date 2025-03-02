import { runServer as _runServer } from "verdaccio";
import type { AuthHtpasswd, Config } from "@verdaccio/types";
import type { Application } from "express";
import path from "node:path";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

const runServer = _runServer as any as (
  config: Omit<Config, "security" | "secret" | "server_id">,
) => Promise<Application>;
const __dirname = new URL(".", import.meta.url).pathname;
const selfPath = path.join(__dirname, ".cache");

export const runVerdaccio = async ({ port }: { port: number }) => {
  const app = await runServer({
    self_path: selfPath,
    storage: "./storage",
    web: {
      enable: true,
      title: "Verdaccio",
      primaryColor: "#4b5e40",
    },
    auth: {
      htpasswd: { file: "./htpasswd" } satisfies Partial<AuthHtpasswd>,
    },
    uplinks: {
      npmjs: { url: "https://registry.npmjs.org/" },
    },
    packages: {
      "@*/*": {
        access: ["$all"],
        publish: ["$all"],
        proxy: ["npmjs"],
      },
      "**": {
        // allow all users (including non-authenticated users) to read and
        // publish all packages
        //
        // you can specify usernames/groupnames (depending on your auth plugin)
        // and three keywords: "$all", "$anonymous", "$authenticated"
        access: ["$all"],
        publish: ["$all"],
        proxy: ["npmjs"],
      },
    },
    logs: {
      type: "stdout",
      format: "pretty",
      level: "http",
    },
    server_id: "verdaccio",
    secret: "test",
  });

  const server = await new Promise<
    Server<typeof IncomingMessage, typeof ServerResponse>
  >((resolve) => {
    const srv = app.listen(port, () => {
      resolve(srv);
    });
  });

  return {
    app,
    server,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      }),
  };
};
