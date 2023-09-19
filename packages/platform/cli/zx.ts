import { $ as $$ } from "zx";

export const $ = (pieces: TemplateStringsArray, ...args: unknown[]) =>
  $$(pieces, ...args).stdio("inherit", "inherit", "inherit");
