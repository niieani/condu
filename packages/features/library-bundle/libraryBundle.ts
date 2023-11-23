import { defineFeature } from "@repo/core/defineFeature.js";
import type { LibraryBundleConfig } from "./types.js";
import path from "node:path";

export const libraryBundle = ({
  id,
  package: pkgName,
  entry,
  moduleTarget,
  codeTarget,
  engineTarget,
  export: exportName,
  name,
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
        return {};
      }

      const entryPath = path.join(matchingPackage.dir, entry);
      const entryDir = path.join(matchingPackage.dir, path.dirname(entry));
      const builtEntryName = `${path.basename(
        entry,
        path.extname(entry),
      )}.bundle.js`;
      const outDir = path.join(config.conventions.buildDir, entryDir);
      const outDirRelativeToPackage = path.relative(
        matchingPackage.dir,
        outDir,
      );
      const configExtension =
        config.project.manifest.name === "toolchain" ? "ts" : "js";
      const configPathRelativeToPackage = `./.config/generated/webpack.config.cjs`;
      // const configPathRelativeToPackage = path.relative(
      //   matchingPackage.dir,
      //   path.join(config.project.dir, configPath),
      // );

      // TODO: check if entry exists

      return {
        // TODO: do we want these dependencies to be repo-global or per-package?
        devDependencies: ["webpack", "webpack-cli", "@swc/core", "swc-loader"],
        files: [
          {
            // TODO: use unique filename for each library bundle, need $id to be filename-safe
            path: configPathRelativeToPackage,
            content: `module.exports = require('@repo-feature/library-bundle/webpack.config.cjs');`,
            matchPackage: { name: matchingPackage.manifest.name },
          },
        ],
        tasks: [
          {
            type: "build",
            name: `build-library-bundle-${id}`,
            matchPackage: { name: matchingPackage.manifest.name },
            definition: {
              command: "webpack",
              // TODO: source dir and config only?
              inputs: [
                "**/*",
                "$workspaceRoot/yarn.lock",
                "$workspaceRoot/features/library-bundle/webpack.config.cjs",
              ],
              options: {
                cache: false,
              },
              // TODO: add inputs and outputs
              args: [
                "build",
                "--config",
                configPathRelativeToPackage,
                "--mode",
                "production",
                "--entry",
                `./${entry}`,
                ...(moduleTarget
                  ? ["--env", `moduleTarget=${moduleTarget}`]
                  : []),
                ...(codeTarget ? ["--env", `codeTarget=${codeTarget}`] : []),
                ...(engineTarget
                  ? ["--env", `engineTarget=${engineTarget}`]
                  : []),
                ...(exportName ? ["--env", `export=${exportName}`] : []),
                ...(name ? ["--env", `name=${name}`] : []),
                "--env",
                `filename=${builtEntryName}`,
                "--env",
                `outDir=${outDirRelativeToPackage}`,
              ],
            },
          },
        ],
      };
    },
  });
