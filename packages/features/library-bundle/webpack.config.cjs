// @ts-check
// call like: yarn webpack build --mode production --entry ./lib/hashids.ts --env moduleTarget=[umd|esm] --env engineTarget=web --env name=MyLibrary --env outDir=dist/umd

// this is a config for compiling libraries
// for compiling websites, use vite

const path = require("node:path");
// import type { Configuration } from "webpack";
// import type { LibraryBundleConfig } from "./types.js";
const webpack = require("webpack");

module.exports = (
  /** @type {import('./types').LibraryBundleConfig} */
  {
    moduleTarget,
    codeTarget = "es2022",
    engineTarget,
    name = "Library",
    export: exportName = "default",
    filename = "main.js",
    outDir = moduleTarget,
  },
) => {
  /** @type {import('webpack').Configuration} */
  const esmConfig = {
    target: [codeTarget, engineTarget].filter(Boolean),
    output: {
      module: true,
      library: {
        type: "module",
      },
      chunkFormat: "module",
    },
    experiments: {
      outputModule: true,
      topLevelAwait: true,
    },
  };
  /** @type {import('webpack').Configuration} */
  const umdConfig = {
    target: [codeTarget, engineTarget ?? "web"].filter(Boolean),
    output: {
      library: {
        type: "umd2",
        export: exportName,
        name,
        umdNamedDefine: true,
      },
      chunkFormat: "array-push",
    },
    experiments: {
      topLevelAwait: true,
    },
  };
  const selectedConfig = moduleTarget === "esm" ? esmConfig : umdConfig;

  /** @type {import('webpack').Configuration} */
  const config = {
    resolve: {
      extensions: [".ts", ".tsx", "..."],
      extensionAlias: {
        // support TypeScript style resolution of extensions (i.e. import .js actually imports .ts)
        ".js": [".ts", ".js"],
        ".mjs": [".mts", ".mjs"],
      },
      alias: {
        "clipanion/platform": path.join(
          process.cwd(),
          "../../..",
          "node_modules/clipanion/lib/platform/node.mjs",
        ),
        clipanion$: path.join(
          process.cwd(),
          "../../..",
          "node_modules/clipanion/lib/advanced/index.mjs",
        ),
        "#ansi-styles": path.join(
          process.cwd(),
          "../../..",
          "node_modules/zx/node_modules/chalk/source/vendor/ansi-styles/index.js",
        ),
        "#supports-color": path.join(
          process.cwd(),
          "../../..",
          "node_modules/zx/node_modules/chalk/source/vendor/supports-color/index.js",
        ),
      },
      importsFields: ["node"],
      exportsFields: ["node", "import"],
    },
    plugins: [
      new webpack.BannerPlugin({
        // bun should be recommended, but node can work with 'tsx' installed
        banner: "#!/usr/bin/env node --import tsx/esm",
        // banner: "#!/usr/bin/env bun",
        raw: true,
      }),
    ],
    mode: "production",
    optimization: {
      concatenateModules: true,
    },
    ...selectedConfig,
    output: {
      ...selectedConfig.output,
      filename,
      path: path.join(process.cwd(), outDir),
    },
    devtool: false, //"source-map",
    externalsPresets: {
      node: true,
    },
    externals: ["typescript", "@ts-morph/common", /^@pnpm\/.*/],
    stats: {
      errorDetails: true,
    },
    module: {
      rules: [
        {
          test: /\.[cm]?tsx?$/i,
          exclude: /(node_modules)/,
          use: [
            {
              // `.swcrc` can be used to configure swc
              loader: "swc-loader",
              options: {
                jsc: {
                  parser: {
                    syntax: "typescript",
                    // jsx: false,
                    decorators: true,
                    dynamicImport: true,
                    // privateMethod: true,
                    // functionBind: true,
                    // exportDefaultFrom: true,
                    // exportNamespaceFrom: true,
                    // decoratorsBeforeExport: true,
                    // topLevelAwait: true,
                    // importMeta: true,
                    // preserveAllComments: false,
                  },
                  target: codeTarget,
                  experimental: {
                    keepImportAssertions: true,
                  },
                },
              },
            },
            // {
            //   loader: "ts-loader",
            //   options: {
            //     transpileOnly: true,
            //     compilerOptions: {
            //       module: "esnext",
            //       target: codeTarget,
            //       esModuleInterop: false,
            //       sourceMap: true,
            //     },
            //   },
            // },
          ],
        },
      ],
    },
  };
  return config;
};