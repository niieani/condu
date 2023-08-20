import * as path from "node:path";
import * as fs from "node:fs";

async function* findUpGenerator(
  test: (file: fs.Dirent) => boolean,
  cwd: string,
  stopAt?: string,
): AsyncGenerator<string, undefined, undefined> {
  try {
    const files = await fs.promises.readdir(cwd, { withFileTypes: true });
    let match = false;
    for (const file of files) {
      if (test(file)) {
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

export interface Options {
  cwd?: string;
  type?: "file" | "directory" | "any";
  allowSymlinks?: boolean;
  stopAt?: string;
}

export function getFindUpGenerator(
  name: string | string[] | RegExp | ((file: fs.Dirent) => boolean),
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

export async function findUp(
  name: string | string[] | RegExp | ((file: fs.Dirent) => boolean),
  options: Options = {},
): Promise<string | undefined> {
  const generator = getFindUpGenerator(name, options);
  const result = await generator.next();
  return result.value;
}

export async function findUpMultiple(
  name: string | string[] | RegExp | ((file: fs.Dirent) => boolean),
  options: Options = {},
): Promise<string[]> {
  const generator = getFindUpGenerator(name, options);
  const files: string[] = [];
  for await (const file of generator) {
    files.push(file);
  }
  return files;
}
