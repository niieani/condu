import { runServer as _runServer } from "verdaccio";
import type { AuthHtpasswd, Config } from "@verdaccio/types";
import type { Application } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

const runServer = _runServer as any as (
  config: Omit<Config, "security" | "secret" | "server_id">,
) => Promise<Application>;
const __dirname = new URL(".", import.meta.url).pathname;
const fullStoragePath = path.resolve(path.join(__dirname, ".cache"));
const configPath = path.resolve(path.join(fullStoragePath, ".config"));

const cleanupStorage = async () => {
  try {
    await fs.rm(fullStoragePath, { recursive: true, force: true });
  } catch (error) {
    // Directory might not exist yet, which is fine
  }

  // Ensure the storage directory exists
  await fs.mkdir(fullStoragePath, { recursive: true });
  await fs.mkdir(configPath, { recursive: true });
};

export const runVerdaccio = async ({
  port,
  proxyNpm = false,
}: {
  port: number;
  proxyNpm?: boolean;
}) => {
  // Clean up storage before starting
  await cleanupStorage();

  const app = await runServer({
    configPath: configPath,
    self_path: configPath,
    storage: fullStoragePath,
    web: {
      enable: true,
      title: "Verdaccio",
      primaryColor: "#4b5e40",
    },
    auth: {
      htpasswd: {
        file: "./htpasswd",
        algorithm: "bcrypt",
      } satisfies Partial<AuthHtpasswd> & {
        algorithm?: "bcrypt" | "md5" | "sha1" | "crypt";
      },
    },
    ...(proxyNpm
      ? {
          uplinks: {
            npmjs: { url: "https://registry.npmjs.org/" },
          },
        }
      : {}),
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
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // Clean up storage after closing server
      await cleanupStorage();
    },
  };
};
