// @ts-check
// call like: yarn webpack build --mode production --entry ./lib/hashids.ts --env moduleTarget=[umd|esm] --env engineTarget=web --env name=MyLibrary --env outDir=dist/umd

// this is a config for compiling libraries
// for compiling websites, use vite

const path = require("node:path");
// import type { Configuration } from "webpack";
// import type { LibraryBundleConfig } from "./types.js";
const webpack = require("webpack");
const builtin = require("node:module").builtinModules;

// NOTE: if this changes structure to anything other than a non-Promise-returning function
// the feature definition needs to be updated to accommodate that, as that's the expectation
module.exports = (
  /** @type {import('@condu-feature/library-bundle/types').LibraryBundleConfig} */
  {
    moduleTarget,
    codeTarget = "es2022",
    engineTarget,
    binName: name = "Library",
    export: exportName = "default",
    filename = "main.js",
    outDir = moduleTarget,
  },
) => {
  const env = process.env.NODE_ENV || "development";
  /** @type {import('webpack').Configuration} */
  const config = {
    resolve: {
      conditionNames: ["node", "import"],
    },
    plugins: [
      new webpack.BannerPlugin({
        // bun should be recommended, but node can work with 'tsx' installed
        // banner: "#!/usr/bin/env node --import tsx/esm",
        banner: "#!/usr/bin/env bun",
        raw: true,
      }),
      // new webpack.IgnorePlugin({
      //   // resourceRegExp: ,
      //   // contextRegExp: /@pnpm\//i,
      //   checkResource: (resource, context) => {
      //     if (context.includes("@pnpm/")) {
      //       console.log(resource, context);
      //     }
      //     if (context.startsWith("@pnpm/")) {
      //       return true;
      //     }
      //   },
      // }),
    ],
    // externalsPresets: {
    //   // TODO: manually externalize node and import it as ESM, not require, so that deno might work?
    //   // use: import { builtinModules } from 'module';
    //   node: true,
    // },

    // ...Object.fromEntries(
    //   builtin.map((name) => [`${name}$`, `external node:${name}`]),
    // ),
    externals: async (data) => {
      const { request, context, getResolve } = data;
      const externals = [
        /^@pnpm\/.*/,
        /^@condu\/.*/,
        /^node:/,
        "typescript",
        "@ts-morph/common",
        "ts-morph",
        "spdx-license-list",
        "graceful-fs",
        "fs-extra",
        // "zx" // required to get rid of Warning: async_hooks.createHook is not implemented in Bun.
      ];
      const isExternal = externals.some((external) => {
        if (typeof external === "string") {
          return request === external || request.startsWith(`${external}/`);
        } else if (external instanceof RegExp) {
          return external.test(request);
        }
      });
      if (isExternal) {
        return true;
      }
      const isBuiltin = builtin.some((name) => {
        if (request === name || request.startsWith(`${name}/`)) {
          return true;
        }
      });
      if (isBuiltin) {
        // rewrite all builtins to use node: prefix
        return `module node:${
          request.endsWith("/") ? request.slice(0, -1) : request
        }`;
      }
    },
    stats: { errorDetails: true },
  };
  return config;
};
