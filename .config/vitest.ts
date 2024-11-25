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
    // ...
  },
  plugins: [promock],
});
