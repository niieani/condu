// @ts-check
// call like: yarn webpack build --mode production --entry ./lib/hashids.ts --env moduleTarget=[umd|esm] --env engineTarget=web --env name=MyLibrary --env outDir=dist/umd

// this is a config for compiling libraries
// for compiling websites, use vite

const path = require("node:path");

// NOTE: if this changes structure to anything other than a non-Promise-returning function
// the feature definition needs to be updated to accommodate that, as that's the expectation
module.exports = (
  /** @type {import('./types').LibraryBundleConfig} */
  {
    moduleTarget,
    codeTarget = "es2022",
    engineTarget,
    binName: name = "library",
    export: exportName = "default",
    filename = "main.js",
    outDir = moduleTarget,
  },
) => {
  const env = process.env.NODE_ENV || "development";
  /** @type {import('webpack').Configuration} */
  const esmConfig = {
    target: [codeTarget, engineTarget].filter(Boolean),
    output: {
      module: true,
      library: { type: "module" },
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
        // support TypeScript style resolution of extensions (i.e. import .js actually imports .ts if it exists)
        ".js": [".ts", ".js"],
        ".mjs": [".mts", ".mjs"],
      },
    },
    mode: env === "production" ? "production" : "development",
    optimization: {
      concatenateModules: true,
      removeEmptyChunks: true,
    },
    ...selectedConfig,
    output: {
      ...selectedConfig.output,
      filename: (pathData) =>
        pathData.chunk.name === "main" ? filename : "_build_/entries/[name].js",
      chunkFilename: `_build_/chunks/[id].js`,
      cssFilename: `_build_/css/[id].css`,
      cssChunkFilename: `_build_/css/[id].css`,
      assetModuleFilename: `_build_/assets/[hash][ext][query]`,
      webassemblyModuleFilename: `_build_/wasm/[hash].module.wasm`,
      path: path.join(process.cwd(), outDir),
    },
    devtool: "source-map",
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
          ],
        },
      ],
    },
  };
  return config;
};
