import { defineFeature, CONDU_CONFIG_DIR_NAME } from "condu";
import type { LibraryBundleConfig } from "./types.js";
import * as path from "node:path";
import type { PackageExportsEntryObject } from "@condu/schema-types/schemas/packageJson.gen.js";

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
  defineFeature(`libraryBundle:${id}`, {
    defineRecipe(condu) {
      const matchingPackage = pkgName
        ? [condu.project, ...condu.project.workspacePackages].find(
            (p) => p.manifest.name === pkgName,
          )
        : condu.project;

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
      const outDir = path.join(
        condu.project.config.conventions.buildDir,
        entryDir,
      );
      // TODO: right now this is incorrect
      const outDirRelativeToPackageSource = path.relative(
        matchingPackage.relPath,
        outDir,
      );

      // TODO: consider using an esm transpiled webpack config with WEBPACK_CLI_FORCE_LOAD_ESM_CONFIG
      const configPathRelativeToPackage = `./${CONDU_CONFIG_DIR_NAME}/generated/webpack.config.cjs`;
      const userConfigPathRelativeToPackage = `./${CONDU_CONFIG_DIR_NAME}/webpack.config.cjs`;

      // TODO: check if entry exists
      const inMatchingPackage = condu.in({
        name: matchingPackage.manifest.name,
      });

      inMatchingPackage.generateFile(
        // TODO: use unique filename for each library bundle feature instance, need $id to be filename-safe
        configPathRelativeToPackage,
        {
          content: /* ts */ `
const sharedWebpackConfigFn = require('@condu-feature/library-bundle/webpack.config.cjs');
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
};\n`.trimStart(),
        },
      );

      // Add dependencies
      // TODO: do we want these global, or per package?
      inMatchingPackage
        .ensureDependency("webpack")
        .ensureDependency("webpack-cli")
        .ensureDependency("webpack-merge")
        .ensureDependency("@swc/core")
        .ensureDependency("swc-loader");

      // Define tasks
      inMatchingPackage.defineTask(`build-library-bundle-${id}`, {
        type: "build",
        definition: {
          command: "webpack",
          // TODO: source dir and config only as inputs? /yarn.lock?
          inputs: ["**/*"],
          outputs: [
            `/${condu.project.config.conventions.buildDir}/$projectSource/${builtEntryName}`,
            `/${condu.project.config.conventions.buildDir}/$projectSource/${builtEntryName}.map`,
            `/${condu.project.config.conventions.buildDir}/$projectSource/_build_/**/*`,
          ],
          args: [
            "build",
            "--config",
            configPathRelativeToPackage,
            "--entry",
            `./${entry}`,
            ...(moduleTarget ? ["--env", `moduleTarget=${moduleTarget}`] : []),
            ...(codeTarget ? ["--env", `codeTarget=${codeTarget}`] : []),
            ...(engineTarget ? ["--env", `engineTarget=${engineTarget}`] : []),
            ...(exportName ? ["--env", `export=${exportName}`] : []),
            ...(binName ? ["--env", `name=${binName}`] : []),
            "--env",
            `filename=${builtEntryName}`,
            "--env",
            `outDir=${outDirRelativeToPackageSource}`,
            // "--mode", "development", // "${NODE_ENV}"
          ],
        },
      });

      if (binName) {
        inMatchingPackage.modifyPublishedPackageJson((pkg) => ({
          ...pkg,
          bin: { [binName]: builtEntryName },
        }));
      }

      inMatchingPackage.modifyPublishedPackageJson((pkg) => {
        const exports =
          typeof pkg.exports === "object" && pkg.exports
            ? { ...pkg.exports }
            : { ".": pkg.exports };
        const rootEntryInput = exports && "." in exports ? exports : undefined;
        const dotEntry = rootEntryInput?.["."];
        const rootEntry: PackageExportsEntryObject | undefined = dotEntry
          ? ((typeof dotEntry === "object"
              ? { ...dotEntry }
              : { default: dotEntry }) as PackageExportsEntryObject)
          : undefined;
        const relativeToPath = `./${path.join(packageRelativePathToEntry, builtEntryName)}`;
        const types = `./${entry.replace(/\.[cm]?ts$/, ".d.ts")}`;

        if (rootEntry?.["source"] === `./${entry}`) {
          // override the source entry with the built entry
          rootEntry.import = relativeToPath;
          rootEntry["bun"] = relativeToPath;
          rootEntry.default = relativeToPath;
          rootEntry.types = types;
          delete rootEntry.require;
        }

        return {
          ...pkg,
          exports: {
            [relativeToPath]: {
              import: relativeToPath,
              bun: relativeToPath,
              default: relativeToPath,
              types,
            },
            ...exports,
            ".": rootEntry,
          },
        };
      });
    },
  });
