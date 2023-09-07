import { defineFeature } from "../../platform/core/defineFeature.js";
import type tsconfig from "../../platform/schema-types/schemas/tsconfig.js";

export const typescript = ({ tsconfig }: { tsconfig?: tsconfig } = {}) =>
  defineFeature({
    name: "typescript",
    order: { priority: "beginning" },
    actionFn: (config, state) => ({
      files: [
        {
          path: "tsconfig.json",
          content: JSON.stringify(
            {
              compilerOptions: {
                target: "ESNext",
                module: "ESNext",
                // most recommended way, because it's compatible with most tools (requires .js imports)
                moduleResolution: "NodeNext",
                strict: true,
                noImplicitOverride: true,
                noImplicitReturns: true,
                noPropertyAccessFromIndexSignature: true,
                noUncheckedIndexedAccess: true,
                // noUnusedLocals: true,
                // noUnusedParameters: true,
                resolveJsonModule: true,
                rootDir: config.conventions.sourceDir,
                declaration: true,
                declarationMap: true,
                sourceMap: true,
                verbatimModuleSyntax: true,
                forceConsistentCasingInFileNames: true,
                isolatedModules: true,
                // this should be overridden by the compile-time setting
                // we set it here, in case someone accidentally runs tsc directly
                outDir: "dist",
                // TODO depends on the project?
                // emitDeclarationOnly: true,
                // strongly encourage importHelpers: true
                // TODO: add lib based on project target (web, node, electron, etc.): ["ESNext", "DOM"]
                // TODO: incremental: true
                // perf optimization:
                // assumeChangesOnlyAffectDirectDependencies: true,
                ...tsconfig?.compilerOptions,
              },
              include: [config.conventions.sourceDir],
              ...tsconfig,
            } satisfies tsconfig,
            null,
            2,
          ),
        },
      ],
    }),
  });
