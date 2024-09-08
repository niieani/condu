// declare module "eslint-plugin-import-x" {
//   import type { ESLint } from "eslint";
//   const plugin: ESLint.Plugin;
//   export default plugin;
// }

declare module "eslint-plugin-unicorn" {
  import type { ESLint } from "eslint";
  const plugin: ESLint.Plugin;
  export default plugin;
}

declare module "eslint-plugin-unicorn/configs/recommended.js" {
  import type { Linter } from "eslint";
  const file: { rules: Linter.RulesRecord };
  export = file;
}
