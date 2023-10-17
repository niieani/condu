import { defineFeature } from "@repo/core/defineFeature.js";
import type tsconfig from "@repo/schema-types/schemas/tsconfig.js";
import path from "node:path";
import type { satisfies } from "semver";

const commonJsFirstPreset = {
  module: "CommonJS",
  moduleResolution: "Node",
  verbatimModuleSyntax: false,
  esModuleInterop: true,
} satisfies tsconfig["compilerOptions"];

const esmFirstPreset = {
  module: "NodeNext",
  // most recommended way, because it's compatible with most tools (requires .js imports)
  moduleResolution: "NodeNext",
  verbatimModuleSyntax: true,
  esModuleInterop: false,
} satisfies tsconfig["compilerOptions"];

const presets = {
  "commonjs-first": commonJsFirstPreset,
  "esm-first": esmFirstPreset,
};

export const typescript = ({
  tsconfig,
  preset,
}: { tsconfig?: tsconfig; preset?: "commonjs-first" | "esm-first" } = {}) =>
  defineFeature({
    name: "typescript",
    order: { priority: "beginning" },
    actionFn: (config, state) => {
      const selectedPreset = presets[preset ?? "esm-first"];
      return {
        tasks: [
          {
            type: "build",
            name: "tsc-esm",
            definition: {
              command: "tsc --project tsconfig.json",
            },
          },
        ],
        files: [
          {
            path: config.projects ? "tsconfig.options.json" : "tsconfig.json",
            content: {
              ...tsconfig,
              compilerOptions: {
                target: "ESNext",
                ...selectedPreset,
                module: "NodeNext",
                strict: true,
                // we don't need to emit 'use strict' in the files
                alwaysStrict: false,
                noImplicitOverride: true,
                noImplicitReturns: true,
                noPropertyAccessFromIndexSignature: true,
                noUncheckedIndexedAccess: true,
                // noUnusedLocals: true,
                // noUnusedParameters: true,
                resolveJsonModule: true,
                rootDir: config.conventions.sourceDir,

                // sourceRoot is overriden because the directory that we publish
                // is not the same as the directory that we compile to
                // we publish all the sources next to the compiled output for simplicity of consumption
                sourceRoot: config.conventions.sourceDir,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                verbatimModuleSyntax: true,
                forceConsistentCasingInFileNames: true,
                isolatedModules: true,
                ...(config.projects
                  ? {
                      composite: true,
                      // performance:
                      // disableReferencedProjectLoad: true,
                    }
                  : {}),
                // this should be overridden by the compile-time setting
                // we set it here, in case someone accidentally runs tsc directly
                // outDir: "dist",
                // TODO depends on the project?
                // emitDeclarationOnly: true,
                // strongly encourage importHelpers: true
                // TODO: add lib based on project target (web, node, electron, etc.): ["ESNext", "DOM"]
                // TODO: incremental: true
                // perf optimization:
                // assumeChangesOnlyAffectDirectDependencies: true,
                ...tsconfig?.compilerOptions,
              },
              ...(config.projects
                ? {}
                : {
                    include: tsconfig?.include ?? [
                      config.conventions.sourceDir,
                    ],
                  }),
            } satisfies tsconfig,
          },
          config.projects && {
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
            } satisfies tsconfig,
          },
          config.projects && {
            path: "tsconfig.json",
            matchPackage: { kind: "package" },
            content: (manifest) => {
              const pathToWorkspaceDir = //config.workspaceDir;
                path.relative(manifest.path, config.workspaceDir);

              return {
                extends: path.join(pathToWorkspaceDir, "tsconfig.options.json"),
                compilerOptions: {
                  outDir: path.join(
                    pathToWorkspaceDir,
                    "dist",
                    path.relative(config.project.dir, manifest.path),
                  ),
                  // required so that when using tsc --build it doesn't create nested dist directories
                  rootDir: config.conventions.sourceDir,
                },
                // TODO add references; for now, they are generated by moon which we depend on
              } satisfies tsconfig;
            },
          },
        ],
      };
    },
  });
