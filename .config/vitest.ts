/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import type { PluginOption } from "vite";
import { swc, defineRollupSwcOption } from "rollup-plugin-swc3";

const promock = {
  ...swc(
    defineRollupSwcOption({
      swcrc: false,
      configFile: false,
      tsconfig: false,
      minify: false,
      sourceMaps: true,
      module: {
        type: "nodenext",
      },
      jsc: {
        target: "esnext",
        preserveAllComments: true,
        keepClassNames: true,
        experimental: {
          // plugins: [
          //   [
          //     "swc-mockify",
          //     {
          //       basePath: __dirname,
          //       importFrom: "swc-mockify/src/mockify.ts",
          //     },
          //   ],
          // ],
          disableBuiltinTransformsForInternalTesting: true,
        },
      },
    }),
  ),
  name: "promock",
} as PluginOption;

export default defineConfig({
  test: {
    exclude: [
      "**/node_modules/**",
      // default uses /dist/
      "**/build/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
    // ...
  },
  plugins: [promock],
});
