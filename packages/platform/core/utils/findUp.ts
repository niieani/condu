import * as path from "node:path";
import * as fs from "node:fs";

export type SyncFileTestFunction = (file: fs.Dirent) => boolean;

export type FileTestFunction =
  | SyncFileTestFunction
  | ((file: fs.Dirent) => Promise<boolean>);
export type PossibleNameTypes = string | string[] | RegExp | FileTestFunction;
export type SyncPossibleNameTypes =
  | string
  | string[]
  | RegExp
  | SyncFileTestFunction;

export interface Options {
  cwd?: string;
  type?: "file" | "directory" | "any";
  allowSymlinks?: boolean;
  stopAt?: string;
}

async function* findUpGenerator(
  test: FileTestFunction,
  cwd: string,
  stopAt?: string,
): AsyncGenerator<string, undefined, undefined> {
  try {
    const files = await fs.promises.readdir(cwd, { withFileTypes: true });
    let match = false;
    for (const file of files) {
      const testResultMaybePromise = test(file);
      const testResult =
        testResultMaybePromise instanceof Promise
          ? await testResultMaybePromise
          : testResultMaybePromise;
      if (testResult) {
        yield path.join(cwd, file.name);
        match = true;
      }
    }
    if (match) return;
  } catch (err) {
    // Ignore error and continue walking up
  }
  const parentDir = path.dirname(cwd);
  if (parentDir === cwd || parentDir === stopAt) {
    return;
  }
  yield* findUpGenerator(test, parentDir);
}

// sync version:
function* findUpGeneratorSync(
  test: SyncFileTestFunction,
  cwd: string,
  stopAt?: string,
): Generator<string, undefined, undefined> {
  try {
    const files = fs.readdirSync(cwd, { withFileTypes: true });
    let match = false;
    for (const file of files) {
      const testResult = test(file);
      if (testResult) {
        yield path.join(cwd, file.name);
        match = true;
      }
    }
    if (match) return;
  } catch (err) {
    // Ignore error and continue walking up
  }
  const parentDir = path.dirname(cwd);
  if (parentDir === cwd || parentDir === stopAt) {
    return;
  }
  yield* findUpGeneratorSync(test, parentDir);
}

export function getFindUpGenerator(
  name: PossibleNameTypes,
  {
    cwd = process.cwd(),
    type = "file",
    allowSymlinks = true,
    stopAt,
  }: Options = {},
): AsyncGenerator<string, undefined, undefined> {
  const testType =
    type === "any"
      ? () => true
      : type === "file"
        ? (file: fs.Dirent) => file.isFile()
        : (file: fs.Dirent) => file.isDirectory();
  const testSymlink = allowSymlinks
    ? () => true
    : (file: fs.Dirent) => !file.isSymbolicLink();
  const test =
    typeof name === "function"
      ? name
      : typeof name === "string"
        ? (file: fs.Dirent) =>
            file.name === name && testType(file) && testSymlink(file)
        : Array.isArray(name)
          ? (file: fs.Dirent) =>
              name.includes(file.name) && testType(file) && testSymlink(file)
          : (file: fs.Dirent) =>
              name.test(file.name) && testType(file) && testSymlink(file);

  return findUpGenerator(test, cwd, stopAt);
}

// sync version:
export function getFindUpGeneratorSync(
  name: SyncPossibleNameTypes,
  {
    cwd = process.cwd(),
    type = "file",
    allowSymlinks = true,
    stopAt,
  }: Options = {},
): Generator<string, undefined, undefined> {
  const testType =
    type === "any"
      ? () => true
      : type === "file"
        ? (file: fs.Dirent) => file.isFile()
        : (file: fs.Dirent) => file.isDirectory();
  const testSymlink = allowSymlinks
    ? () => true
    : (file: fs.Dirent) => !file.isSymbolicLink();
  const test =
    typeof name === "function"
      ? name
      : typeof name === "string"
        ? (file: fs.Dirent) =>
            file.name === name && testType(file) && testSymlink(file)
        : Array.isArray(name)
          ? (file: fs.Dirent) =>
              name.includes(file.name) && testType(file) && testSymlink(file)
          : (file: fs.Dirent) =>
              name.test(file.name) && testType(file) && testSymlink(file);
  return findUpGeneratorSync(test, cwd, stopAt);
}

export async function findUp(
  name: PossibleNameTypes,
  options: Options = {},
): Promise<string | undefined> {
  const generator = getFindUpGenerator(name, options);
  const result = await generator.next();
  return result.value;
}

// sync version:
export function findUpSync(
  name: SyncPossibleNameTypes,
  options: Options = {},
): string | undefined {
  const generator = getFindUpGeneratorSync(name, options);
  const result = generator.next();
  return result.value;
}

export async function findUpMultiple(
  name: PossibleNameTypes,
  options: Options & { limit?: number } = {},
): Promise<string[]> {
  const generator = getFindUpGenerator(name, options);
  const files: string[] = [];
  for await (const file of generator) {
    files.push(file);
    if (options.limit && files.length >= options.limit) {
      break;
    }
  }
  return files;
}

// sync version:
export function findUpMultipleSync(
  name: SyncPossibleNameTypes,
  options: Options & { limit?: number } = {},
): string[] {
  const generator = getFindUpGeneratorSync(name, options);
  const files: string[] = [];
  for (const file of generator) {
    files.push(file);
    if (options.limit && files.length >= options.limit) {
      break;
    }
  }
  return files;
}
