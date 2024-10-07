import {
  CORE_NAME,
  CONDU_WORKSPACE_PACKAGE_NAME,
} from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import type TSConfig from "@condu/schema-types/schemas/tsconfig.gen.js";
import * as path from "node:path";

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
  tsconfig,
  preset = "esm-first",
}: {
  tsconfig?: TSConfig;
  preset?: "commonjs-first" | "esm-first";
} = {}) =>
  defineFeature({
    name: "typescript",
    order: { priority: "beginning" },
    actionFn: (config, state) => {
      // TODO: explain pros and cons of composite projects
      // cons: slower, more memory, no incremental builds
      // pros: more responsive to changes in other projects, auto-import suggestions from other projects
      const isComposite =
        config.projects && tsconfig?.compilerOptions?.composite !== false;
      const selectedPreset = presets[preset];
      const includeDir =
        config.projects && !isComposite ? "." : config.conventions.sourceDir;
      return {
        effects: [
          {
            devDependencies: ["typescript"],
            tasks: [
              {
                type: "build",
                name: "build-typescript",
                definition: {
                  inputs: ["@group(sources)"],
                  command: `${config.node.packageManager.name} ${config.node.packageManager.name === "pnpm" ? "exec" : "run"} ${CORE_NAME} tsc --preset ${
                    preset === "esm-first" ? "ts-to-cts" : "ts-to-mts"
                  }`,
                },
              },
              {
                type: "test",
                name: "typecheck-typescript",
                definition: {
                  inputs: ["@group(sources)"],
                  command: `${config.node.packageManager.name} ${config.node.packageManager.name === "pnpm" ? "exec" : "run"} tsc --noEmit`,
                },
              },
            ],
            files: [
              {
                path: isComposite ? "tsconfig.options.json" : "tsconfig.json",
                content: {
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
                } satisfies TSConfig,
              },
              isComposite && {
                path: "tsconfig.json",
                content: {
                  extends: "./tsconfig.options.json",
                  // files must be empty when using project references
                  // https://www.typescriptlang.org/docs/handbook/project-references.html#overall-structure
                  files: [],
                  // "ts-node": {
                  //   esm: true,
                  //   experimentalResolver: true,
                  // },
                } satisfies TSConfig,
              },
            ],
          },
          isComposite && {
            // each package's individual `tsconfig`s:
            matchPackage: { kind: "package" },
            files: [
              {
                path: "tsconfig.json",
                matchPackage: { kind: "package" },
                content: ({ pkg }) => {
                  const pathToWorkspaceDir = path.relative(
                    pkg.absPath,
                    config.workspaceDir,
                  );

                  return {
                    extends: path.join(
                      pathToWorkspaceDir,
                      "tsconfig.options.json",
                    ),
                    compilerOptions: {
                      outDir: path.join(
                        pathToWorkspaceDir,
                        config.conventions.buildDir,
                        pkg.relPath,
                      ),
                      // required so that when using tsc --build it doesn't create nested dist directories
                      rootDir: config.conventions.sourceDir,
                    },
                    // TODO add references; for now, they are generated by moon which we depend on
                  } satisfies TSConfig;
                },
              },
            ],
          },
        ],
      };
    },
  });
