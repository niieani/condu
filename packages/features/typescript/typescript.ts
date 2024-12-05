import { CORE_NAME } from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import type TSConfig from "@condu/schema-types/schemas/tsconfig.gen.js";
import * as path from "node:path";
import { getJsonStringify } from "@condu/cli/commands/apply/defaultParseAndStringify.js";

declare module "@condu/types/extendable.js" {
  interface PeerContext {
    typescript: {
      tsconfig: TSConfig;
    };
  }
  interface FileNameToSerializedTypeMapping {
    "tsconfig.json": TSConfig;
    "tsconfig.options.json": TSConfig;
  }
}

const commonJsFirstPreset = {
  module: "CommonJS",
  moduleResolution: "Node",
  esModuleInterop: true,
} satisfies TSConfig["compilerOptions"];

const esmFirstPreset = {
  module: "NodeNext",
  // most recommended way, because it's compatible with most tools (requires .js imports)
  moduleResolution: "NodeNext",
  // esModuleInterop: false,
} satisfies TSConfig["compilerOptions"];

const presets = {
  "commonjs-first": commonJsFirstPreset,
  "esm-first": esmFirstPreset,
};

// TODO: make this feature contribute a to vscode feature to enable:
// "typescript.tsserver.experimental.enableProjectDiagnostics": true
// see https://github.com/microsoft/vscode/issues/13953

// TODO: reference https://www.totaltypescript.com/tsconfig-cheat-sheet
export const typescript = ({
  preset = "esm-first",
  ...opts
}: {
  tsconfig?: TSConfig;
  preset?: "commonjs-first" | "esm-first";
} = {}) =>
  defineFeature("typescript", {
    initialPeerContext: {
      tsconfig: opts.tsconfig ?? {},
    },

    defineRecipe(condu, { tsconfig }) {
      // TODO: explain pros and cons of composite projects
      // cons: slower, more memory, no incremental builds
      // pros: more responsive to changes in other projects, auto-import suggestions from other projects

      const config = condu.project.config;
      const isComposite =
        config.projects && tsconfig?.compilerOptions?.composite !== false;
      const selectedPreset = presets[preset];
      const includeDir =
        config.projects && !isComposite ? "." : config.conventions.sourceDir;

      condu.root.ensureDependency("typescript");

      condu.root.defineTask("build-typescript", {
        type: "build",
        definition: {
          inputs: ["@group(sources)"],
          command: `${config.node.packageManager.name} ${
            config.node.packageManager.name === "pnpm" ? "exec" : "run"
          } ${CORE_NAME} tsc --preset ${preset === "esm-first" ? "ts-to-cts" : "ts-to-mts"}`,
        },
      });

      condu.root.defineTask("typecheck-typescript", {
        type: "test",
        definition: {
          inputs: ["@group(sources)"],
          command: `${config.node.packageManager.name} ${
            config.node.packageManager.name === "pnpm" ? "exec" : "run"
          } tsc --noEmit`,
        },
      });

      const baseConfig = {
        ...tsconfig,
        compilerOptions: {
          target: "ESNext",
          ...selectedPreset,
          module: "NodeNext",
          moduleDetection: "force",
          strict: true,
          // we don't need to emit 'use strict' in the files
          alwaysStrict: false,
          noImplicitOverride: true,
          noImplicitReturns: true,
          noPropertyAccessFromIndexSignature: true,
          // this one is cool, but can be somewhat annoying:
          // exactOptionalPropertyTypes: true,
          noUncheckedIndexedAccess: true,
          // this is the realm of eslint:
          // noUnusedLocals: true,
          // noUnusedParameters: true,
          resolveJsonModule: true,
          rootDir: includeDir,
          outDir: config.conventions.buildDir,
          // mapRoot is overridden because the directory that we publish
          // is not the same as the directory that we compile to
          // we publish all the sources next to the compiled output for simplicity of consumption
          // TODO: does this interfere with local runners like ts-node / tsx?
          // mapRoot: ".",
          // sourceRoot: ".",
          // sourceRoot: config.conventions.sourceDir,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          // TODO: make 'importHelpers: true' default for applications, and false for libraries
          // recommended, because it allows using custom transpilers:
          verbatimModuleSyntax: true,
          forceConsistentCasingInFileNames: true,
          isolatedModules: true,
          ...(isComposite
            ? {
                composite: true,
                // performance:
                // disableReferencedProjectLoad: true,
                // TODO: incremental: true
                // optional perf optimization:
                // assumeChangesOnlyAffectDirectDependencies: true,
              }
            : config.projects
              ? {
                  // TODO: infer normalized project conventions from config.projects
                  paths: Object.fromEntries(
                    config.projects?.map((p) =>
                      typeof p === "object" && "parentPath" in p
                        ? [p.nameConvention, [`./${p.parentPath}/*`]]
                        : [],
                    ),
                  ),
                }
              : {}),
          // TODO: this should be true for projects that use external compilers
          // emitDeclarationOnly: true,
          // strongly encourage importHelpers: true
          // TODO: add lib based on project target (web, node, electron, etc.): ["ESNext", "DOM"]
          ...tsconfig?.compilerOptions,
        },
        ...(isComposite
          ? {}
          : {
              include: tsconfig?.include ?? [includeDir],
              exclude: [
                config.conventions.buildDir,
                ...(tsconfig?.exclude ?? []),
              ],
              // these are the defaults, so we don't need to specify them explicitly:
              // exclude: tsconfig?.exclude ?? [
              //   "node_modules",
              //   "bower_components",
              //   "jspm_packages",
              //   config.conventions.buildDir,
              // ],
            }),
      } satisfies TSConfig;

      condu.root.generateFile(
        isComposite ? "tsconfig.options.json" : "tsconfig.json",
        {
          stringify: getJsonStringify<TSConfig>(),
          content: baseConfig,
        },
      );

      if (isComposite) {
        condu.root.generateFile("tsconfig.json", {
          stringify: getJsonStringify<TSConfig>(),
          content: {
            extends: "./tsconfig.options.json",
            // files must be empty when using project references
            // https://www.typescriptlang.org/docs/handbook/project-references.html#overall-structure
            files: [],
            // "ts-node": {
            //   esm: true,
            //   experimentalResolver: true,
            // },
          },
        });

        // each package's individual `tsconfig`s:
        condu.in({ kind: "package" }).generateFile("tsconfig.json", {
          stringify: getJsonStringify<TSConfig>(),
          content: ({ targetPackage }) => {
            const pathToWorkspaceDir = path.relative(
              targetPackage.absPath,
              config.workspaceDir,
            );

            return {
              extends: path.join(pathToWorkspaceDir, "tsconfig.options.json"),
              compilerOptions: {
                outDir: path.join(
                  pathToWorkspaceDir,
                  config.conventions.buildDir,
                  targetPackage.relPath,
                ),
                // required so that when using tsc --build it doesn't create nested dist directories
                rootDir: config.conventions.sourceDir,
              },
            } satisfies TSConfig;
          },
        });
      }
    },
  });
