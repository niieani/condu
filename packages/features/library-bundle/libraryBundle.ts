import { defineFeature } from "condu/defineFeature.js";
import type { LibraryBundleConfig } from "./types.js";
import * as path from "node:path";

export const libraryBundle = ({
  id,
  package: pkgName,
  entry,
  moduleTarget,
  codeTarget,
  engineTarget,
  export: exportName,
  binName,
}: {
  id: string;
  // TODO: make entrypoint optional and default using the same logic as in BeforeRelease for main
  /** relative path to the entrypoint to be built */
  entry: string;
  package?: string;
} & Omit<LibraryBundleConfig, "filename" | "outDir">) =>
  defineFeature({
    name: `library-bundle:${id}`,
    actionFn: async (config, state) => {
      const packages = await config.project.getWorkspacePackages();
      const matchingPackage = pkgName
        ? [config.project, ...packages].find((p) => p.manifest.name === pkgName)
        : config.project;

      if (!matchingPackage) {
        console.error(new Error(`Could not find package ${pkgName}`));
        return;
      }

      const entryPath = path.join(matchingPackage.relPath, entry);
      const packageRelativePathToEntry = path.dirname(entry);
      const entryDir = path.join(
        matchingPackage.relPath,
        packageRelativePathToEntry,
      );
      const builtEntryName = `${path.basename(
        entry,
        path.extname(entry),
      )}.bundle.js`;
      const outDir = path.join(config.conventions.buildDir, entryDir);
      // TODO: right now this is incorrect
      const outDirRelativeToPackageSource = path.relative(
        matchingPackage.relPath,
        outDir,
      );

      // TODO: consider using an esm transpiled webpack config with WEBPACK_CLI_FORCE_LOAD_ESM_CONFIG
      const configPathRelativeToPackage = `./.config/generated/webpack.config.cjs`;
      const userConfigPathRelativeToPackage = `./.config/webpack.config.cjs`;
      // const configPathRelativeToPackage = path.relative(
      //   matchingPackage.dir,
      //   path.join(config.project.dir, configPath),
      // );

      // TODO: check if entry exists

      return {
        effects: [
          {
            matchPackage: { name: matchingPackage.manifest.name },
            hooks: {
              modifyEntrySourcesForRelease(entrySources) {
                const rootEntry = { ...entrySources["."]! };
                rootEntry.import = `./${path.join(
                  packageRelativePathToEntry,
                  builtEntryName,
                )}`;
                rootEntry.bun = rootEntry.import;
                rootEntry.default = rootEntry.import;
                rootEntry.types = rootEntry.source?.replace(
                  /\.[cm]?ts$/,
                  ".d.ts",
                );
                delete rootEntry.require;
                return {
                  ...entrySources,
                  ".": rootEntry,
                };
              },
              ...(binName
                ? {
                    modifyPublishPackageJson(packageJson) {
                      return {
                        ...packageJson,
                        bin: { [binName]: builtEntryName },
                      };
                    },
                  }
                : {}),
            },
            // TODO: do we want these dependencies to be condu-global or per-package?
            devDependencies: [
              "webpack",
              "webpack-cli",
              "webpack-merge",
              "@swc/core",
              "swc-loader",
            ],
            files: [
              {
                // TODO: use unique filename for each library bundle feature instance, need $id to be filename-safe
                path: configPathRelativeToPackage,
                content: `const sharedWebpackConfigFn = require('@condu-feature/library-bundle/webpack.config.cjs');
module.exports = async (env, argv) => {
  const sharedConfig = sharedWebpackConfigFn(env, argv);
  try {
    const userConfig = await Promise.resolve(require(${JSON.stringify(
      path.relative(
        path.dirname(configPathRelativeToPackage),
        userConfigPathRelativeToPackage,
      ),
    )})).then((m) => {
      return typeof m === 'function' ? m(env, argv) : m;
    });
    const { merge: webpackMerge } = require('webpack-merge');
    const merged = webpackMerge(sharedConfig, userConfig);
    return merged;
  } catch (e) {
    // ignore
  }
  return sharedConfig;
};
`,
              },
            ],
            tasks: [
              {
                type: "build",
                name: `build-library-bundle-${id}`,
                definition: {
                  command: "webpack",
                  // TODO: source dir and config only?
                  inputs: [
                    "**/*",
                    // "/yarn.lock",
                    // "/features/library-bundle/webpack.config.cjs",
                  ],
                  outputs: [
                    `/${config.conventions.buildDir}/$projectSource/${builtEntryName}`,
                    `/${config.conventions.buildDir}/$projectSource/${builtEntryName}.map`,
                    `/${config.conventions.buildDir}/$projectSource/_build_/**/*`,
                  ],
                  args: [
                    "build",
                    "--config",
                    configPathRelativeToPackage,
                    "--entry",
                    `./${entry}`,
                    ...(moduleTarget
                      ? ["--env", `moduleTarget=${moduleTarget}`]
                      : []),
                    ...(codeTarget
                      ? ["--env", `codeTarget=${codeTarget}`]
                      : []),
                    ...(engineTarget
                      ? ["--env", `engineTarget=${engineTarget}`]
                      : []),
                    ...(exportName ? ["--env", `export=${exportName}`] : []),
                    ...(binName ? ["--env", `name=${binName}`] : []),
                    "--env",
                    `filename=${builtEntryName}`,
                    "--env",
                    `outDir=${outDirRelativeToPackageSource}`,
                    // "--mode",
                    // // "development",
                    // "${NODE_ENV}",
                  ],
                },
              },
            ],
          },
        ],
      };
    },
  });
