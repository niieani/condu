/**
 * Escapes special characters in a string to be used in a regular expression.
 *
 * @param str - The string to escape.
 * @returns The escaped string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Converts a gitignore pattern to a corresponding regular expression.
 *
 * @param pattern - The gitignore pattern to convert.
 * @param isDirectoryPattern - Indicates if the pattern is meant to match directories only.
 * @param basePath - The base path to which the pattern is anchored.
 * @returns A RegExp object representing the pattern.
 */
function patternToRegex(pattern: string, isDirectoryPattern: boolean): RegExp {
  const regexTokens: string[] = [];
  let i = 0;

  // Patterns starting with '/' are anchored to the base path
  let anchored = false;
  if (pattern.startsWith("/")) {
    anchored = true;
    pattern = pattern.slice(1);
  }

  const hasMiddleSlash = pattern.includes("/");

  while (i < pattern.length) {
    let char = pattern[i]!;
    let escaped = false;

    if (char === "\\") {
      // Next character is escaped
      i++;
      if (i >= pattern.length) {
        // Trailing backslash, treat it as literal backslash
        regexTokens.push("\\\\");
        break;
      }
      char = pattern[i]!;
      escaped = true;
    }

    if (escaped) {
      // Escaped character, treat it as literal
      regexTokens.push(escapeRegex(char));
    } else {
      if (char === "*") {
        if (pattern[i + 1] === "*") {
          // Handle '**'
          i++;
          if (pattern[i + 1] === "/") {
            // '**/' matches zero or more directories
            regexTokens.push("(?:.*/)?");
            i++;
          } else {
            // '**' matches any character including '/'
            regexTokens.push(".*");
          }
        } else {
          // '*' matches any sequence of characters except '/'
          regexTokens.push("[^/]*");
        }
      } else if (char === "?") {
        // '?' matches any single character except '/'
        regexTokens.push("[^/]");
      } else if (char === "[") {
        // Character class
        let classContent = "";
        i++; // Move past '['
        let closed = false;
        let firstChar = true;
        while (i < pattern.length) {
          let c = pattern[i];
          if (firstChar && c === "!") {
            classContent += "^";
          } else if (c === "\\") {
            // Escape next character
            i++;
            if (i < pattern.length) {
              c = pattern[i];
              classContent += "\\" + c;
            } else {
              // Pattern ends with a backslash, treat it as literal '\'
              classContent += "\\\\";
              break;
            }
          } else if (c === "]") {
            closed = true;
            break;
          } else {
            // Append character as is
            classContent += c;
          }
          firstChar = false;
          i++;
        }
        if (closed) {
          regexTokens.push(`[${classContent}]`);
        } else {
          // Unclosed '[', treat '[' as literal
          regexTokens.push("\\[");
        }
      } else if (char === "/") {
        // Directory separator
        regexTokens.push("/");
      } else {
        // Escape regex special characters
        regexTokens.push(escapeRegex(char));
      }
    }
    i++;
  }

  let regexStr = regexTokens.join("");

  if (anchored) {
    // Pattern starts with '/', match from basePath
    regexStr = "^" + regexStr;
  } else {
    // Pattern does not start with '/', may match at any level
    if (hasMiddleSlash) {
      // Pattern contains '/', match relative to basePath
      regexStr = "^(?:.*/)?" + regexStr;
    } else {
      // Pattern does not contain '/', match at any level
      regexStr = "(^|.*/)" + regexStr;
    }
  }

  if (isDirectoryPattern) {
    regexStr += "/(?:$|.*)";
  } else {
    regexStr += "(?:$|/)";
  }

  return new RegExp(regexStr);
}

/**
 * Represents a single gitignore pattern.
 */
export class GitIgnorePattern {
  /** The regular expression derived from the gitignore pattern. */
  regex: RegExp;

  /** Indicates if the pattern is negated (i.e., starts with '!'). */
  isNegated: boolean;

  /** The gitignore pattern string (after processing). */
  pattern: string;

  /** Indicates if the pattern is meant to match directories only. */
  isDirectoryPattern: boolean;

  /** The line number in the gitignore file where this pattern is defined. */
  lineNumber: number;

  /** The line content from the gitignore file (trimmed from whitespace). */
  line: string;

  /**
   * Creates an instance of GitIgnorePattern.
   *
   * @param trimmedLine - The line from the gitignore file, trimmed of leading whitespace.
   * @param lineNumber - The line number in the gitignore file.
   * @param basePath - The base path to which the pattern is anchored.
   */
  constructor(trimmedLine: string, lineNumber: number) {
    // Handle trailing spaces that are not escaped
    let pattern = trimmedLine.replace(/(?<!\\)\s+$/, "");

    // Determine if the pattern is negated
    let isNegated = false;
    if (pattern.startsWith("!")) {
      isNegated = true;
      pattern = pattern.slice(1);
    }

    // Patterns ending with '/' only match directories
    let isDirectoryPattern = false;
    if (pattern.endsWith("/")) {
      isDirectoryPattern = true;
      pattern = pattern.slice(0, -1);
    }

    // Convert the pattern to a regular expression
    const regex = patternToRegex(pattern, isDirectoryPattern);

    this.pattern = pattern;
    this.isNegated = isNegated;
    this.isDirectoryPattern = isDirectoryPattern;
    this.regex = regex;
    this.lineNumber = lineNumber;
    this.line = trimmedLine;
  }

  /**
   * Tests if a given path matches this gitignore pattern.
   *
   * @param path - The file or directory path to test.
   * @returns `true` if the path matches the pattern, otherwise `false`.
   */
  matches(path: string): boolean {
    return this.regex.test(path);
  }
}

/**
 * Checks if any parent directory of the given path segments is excluded by a pattern.
 *
 * @param pathSegments - An array of path segments representing the file path.
 * @param excludedDirectories - A map of excluded directory paths to their corresponding patterns.
 * @returns The `GitIgnorePattern` that excludes a parent directory, or `false` if none are excluded.
 */
function isParentDirectoryExcluded(
  pathSegments: string[],
  excludedDirectories: Map<string, GitIgnorePattern>,
): GitIgnorePattern | false {
  for (let i = pathSegments.length - 1; i > 0; i--) {
    const parentPath = pathSegments.slice(0, i).join("/");
    const excludedByPattern = excludedDirectories.get(parentPath);
    if (excludedByPattern) {
      return excludedByPattern;
    }
  }
  return false;
}

/**
 * Represents the outcome of evaluating a path against gitignore patterns.
 */
export interface Explanation {
  /** The final outcome indicating whether the path is ignored or accepted. */
  outcome: "ignored" | "accepted";

  /** The `GitIgnorePattern` that caused the outcome, if applicable. */
  reason?: GitIgnorePattern;
}

/**
 * Parses and evaluates gitignore patterns to determine if paths are ignored or accepted.
 */
export class GitIgnore {
  /** An array of parsed gitignore patterns. */
  private patterns: GitIgnorePattern[] = [];

  /**
   * Creates an instance of GitIgnore.
   *
   * @param gitignoreContent - The content of a .gitignore file.
   * @param basePath - If provided, any match will be relative to this path (i.e. as if you changed directories to this subdirectory).
   */
  constructor(gitignoreContent: string) {
    const lines = gitignoreContent.split(/\r?\n/);
    let lineNumber = 0;
    for (const line of lines) {
      const pattern = this.parseLine(line, lineNumber);
      if (pattern) {
        this.patterns.push(pattern);
      }
      lineNumber++;
    }
  }

  /**
   * Parses a single line from the gitignore content into a `GitIgnorePattern`.
   *
   * @param line - The line from the gitignore file.
   * @param lineNumber - The line number in the gitignore file.
   * @returns A `GitIgnorePattern` object if the line contains a valid pattern, otherwise `undefined`.
   */
  private parseLine(
    line: string,
    lineNumber: number,
  ): GitIgnorePattern | undefined {
    // Trim whitespace
    let trimmedLine = line.trimStart();

    // Skip empty lines and comments
    if (trimmedLine.length === 0 || trimmedLine[0] === "#") {
      return undefined;
    }

    return new GitIgnorePattern(trimmedLine, lineNumber);
  }

  /**
   * Determines if a given path is accepted (not ignored) by the gitignore patterns.
   *
   * @param path - The file or directory path to check.
   * @returns `true` if the path is accepted, otherwise `false`.
   */
  isAccepted(path: string): boolean {
    return this.explain(path).outcome === "accepted";
  }

  /**
   * Determines if a given path is ignored by the gitignore patterns.
   *
   * @param path - The file or directory path to check.
   * @returns `true` if the path is ignored, otherwise `false`.
   */
  isIgnored(path: string): boolean {
    return this.explain(path).outcome === "ignored";
  }

  /**
   * Provides an explanation for whether a path is ignored or accepted based on the gitignore patterns.
   *
   * @param path - The file or directory path to evaluate.
   * @returns An `Explanation` object detailing the outcome and the responsible pattern, if any.
   */
  explain(path: string): Explanation {
    path = path.startsWith("/") ? path.slice(1) : path;

    const pathSegments = path.split("/");

    const excludedDirectories = new Map<string, GitIgnorePattern>();
    // Check if any parent directory is excluded
    const excludedByParent = isParentDirectoryExcluded(
      pathSegments,
      excludedDirectories,
    );
    if (excludedByParent) {
      return {
        outcome: "ignored",
        reason: excludedByParent,
      };
    }

    let result: Explanation = {
      outcome: "accepted",
    };

    for (const patternObj of this.patterns) {
      if (patternObj.matches(path)) {
        if (patternObj.isNegated) {
          // Cannot re-include files from excluded directories
          if (isParentDirectoryExcluded(pathSegments, excludedDirectories)) {
            continue;
          }
          if (result.outcome === "ignored") {
            result = {
              outcome: "accepted",
              reason: patternObj,
            };
          }
        } else {
          result = {
            outcome: "ignored",
            reason: patternObj,
          };
          // If the pattern is a directory pattern, exclude the directory specified by the pattern
          if (patternObj.isDirectoryPattern) {
            // Remove trailing slashes
            const dirToExclude = patternObj.pattern.replace(/\/+$/, "");
            excludedDirectories.set(dirToExclude, patternObj);
          }
        }
      }
    }
    return result;
  }
}
