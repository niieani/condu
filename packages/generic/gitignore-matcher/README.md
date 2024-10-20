# `gitignore-matcher`

`gitignore-matcher` is a fully-featured TypeScript library that allows you to parse and evaluate `.gitignore` patterns to determine if files or directories should be ignored (or accepted) based on your ignore rules. It's compatible with the `.gitignore` format used by Git and provides additional tools for detailed pattern matching and debugging.

## Key Features

- **Full `.gitignore` Syntax Support**: Supports the [complete feature-set of gitignore](https://git-scm.com/docs/gitignore), including `*`, `?`, character ranges (including negated ranges), and the special `**` wildcard behavior.
  - **Negated Patterns**: Handles `!` negation rules to re-include files that were previously ignored.
  - **Escaped Characters**: Properly interprets escaped characters like `\#`, ensuring patterns that start with special characters are parsed correctly.
  - **Parent Directory Exclusion**: Handles cases where excluding a directory affects files within it.
- **Detailed Explanations**: The unique `explain` method helps you understand exactly why a path is accepted or ignored, down to the specific `.gitignore` line and pattern that caused the result.
- **Lightweight and Fast**: Perfect for handling `.gitignore` logic in TypeScript projects without extra dependencies.

## Installation

Install via npm/pnpm/yarn/bun:

```bash
npm install gitignore-matcher
```

## Usage

### Basic Example

To distinguish between files and directories, use a trailing `/` when testing paths.
For example, `temp/` matches the directory `temp/`, but not a file named `temp`.

```ts
import { GitIgnore } from "gitignore-matcher";

const gitignoreContent = `
*.log
!important.log
/temp/
`;

const gitIgnore = new GitIgnore(gitignoreContent);

console.log(gitIgnore.isIgnored("error.log")); // true
console.log(gitIgnore.isAccepted("important.log")); // true
console.log(gitIgnore.isIgnored("temp/data.txt")); // true
console.log(gitIgnore.isIgnored("temp/")); // true (directory)
console.log(gitIgnore.isAccepted("docs/readme.txt")); // true
```

### Pattern Explanation

With the `explain` method, you can get a detailed explanation of why a path is ignored or accepted.

```ts
const explanation = gitIgnore.explain("error.log");
console.log(explanation.outcome); // "ignored"
console.log(explanation.reason?.lineNumber); // Line number in the .gitignore file (1)
console.log(explanation.reason?.line); // The line content that matched ('*.log')
```

## API Reference

### `new GitIgnore(gitignoreContent: string)`

Creates a new instance of `GitIgnore` by parsing the provided `.gitignore` file content.

#### Parameters

- `gitignoreContent` (string): The content of your `.gitignore` file.

### `isAccepted(path: string): boolean`

Checks if the given file or directory path is **accepted** (not ignored).

#### Parameters

- `path` (string): The file or directory path to test.

#### Returns

- `boolean`: `true` if the path is accepted, `false` if ignored.

### `isIgnored(path: string): boolean`

Checks if the given file or directory path is **ignored**.

#### Parameters

- `path` (string): The file or directory path to test.

#### Returns

- `boolean`: `true` if the path is ignored, `false` if accepted.

### `explain(path: string): Explanation`

Provides detailed information on why a path was accepted or ignored, including the specific `.gitignore` pattern and line number.

#### Parameters

- `path` (string): The file or directory path to evaluate.

#### Returns

- `Explanation`: An object containing the `outcome` (either `"accepted"` or `"ignored"`) and the `reason` (`GitIgnorePattern` object) responsible for the outcome, if any.

## License

MIT License.
