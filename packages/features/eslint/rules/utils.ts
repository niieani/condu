import fs from "node:fs";
import type { RuleFixer } from "@typescript-eslint/utils/ts-eslint";

type AutofixFn = (fixer: RuleFixer) => void;

// because autofixes are evaluated eagerly, it's not possible to do this correctly using eslint
// this is a nasty hack that depends on the fact that eslint's SourceCodeFixer passes the text as is
// the code hasn't changed for the past 5 years, so it should be safe for the time being
// there's a call to startsWith(BOM) on the autofix text, which we can use to trigger the autofix
// see https://github.com/eslint/eslint/blob/13d0bd371eb8eb4aa1601c8727212a62ab923d0e/lib/linter/source-code-fixer.js#L98

// TODO: we could try to create a typescript language service plugin that does this,
// and make it into a TS autofix instead

export class LazyAutofix extends String {
  applied = false;
  constructor(
    public autofixFn: AutofixFn,
    public fixer: RuleFixer,
  ) {
    super("");
  }
  override startsWith() {
    if (!this.applied) {
      this.autofixFn(this.fixer);
      this.applied = true;
    }
    return false;
  }
  override valueOf() {
    return "";
  }
}

export const makeLazyAutofix =
  (autofixFn: AutofixFn) => (fixer: RuleFixer) => ({
    range: [0, 0] as const,
    // pretend that LazyAutofix is a string
    text: new LazyAutofix(autofixFn, fixer) as unknown as string,
  });

export const batchSaveMap = new Map<string, object>();
let batchTimeout: ReturnType<typeof setTimeout> | undefined = undefined;

export const writeJSONLater = (jsonFilePath: string, content: object) => {
  batchSaveMap.set(jsonFilePath, content);
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }
  batchTimeout = setTimeout(() => {
    for (const [jsonPath, content] of batchSaveMap.entries()) {
      fs.writeFile(
        jsonPath,
        JSON.stringify(content, undefined, 2) + "\n",
        () => {
          batchSaveMap.delete(jsonPath);
        },
      );
    }
    batchTimeout = undefined;
  }, 50);
};

export const dependencyJsonCache = new Map();
const semVerPrefixes = ["", "=", "^", "~", ">=", "<=", "*"] as const;
export type SemVerPrefix = (typeof semVerPrefixes)[number];
export const allowedSemVerPrefixes: Array<string> = [...semVerPrefixes];

// TODO: import { matchWildcard } from "@condu/core/utils/matchWildcard.js";
export function matchWildcard(pattern: string, str: string): boolean {
  // Escape special characters in pattern and replace '*' with '.*' for regex
  const regexPattern = pattern
    .replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")
    .replace(/\*/g, ".*");

  // Create a regular expression from the pattern
  const regex = new RegExp(`^${regexPattern}$`);

  // Test if the string matches the regular expression
  return regex.test(str);
}