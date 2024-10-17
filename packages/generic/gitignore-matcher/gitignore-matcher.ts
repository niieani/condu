// gitignore-matcher.ts

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternToRegex(
  pattern: string,
  isDirectoryPattern: boolean,
  basePath: string,
): RegExp {
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
        const endIndex = pattern.indexOf("]", i);
        if (endIndex > -1) {
          const classContent = pattern.slice(i, endIndex + 1);
          regexTokens.push(classContent);
          i = endIndex;
        } else {
          // Invalid pattern, treat '[' as literal
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
    regexStr = "^" + escapeRegex(basePath) + regexStr;
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

export class GitIgnorePattern {
  regex: RegExp;
  isNegated: boolean;
  pattern: string;
  isDirectoryPattern: boolean;
  lineNumber: number;
  line: string;

  constructor(trimmedLine: string, lineNumber: number, basePath: string) {
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
    const regex = patternToRegex(pattern, isDirectoryPattern, basePath);

    this.pattern = pattern;
    this.isNegated = isNegated;
    this.isDirectoryPattern = isDirectoryPattern;
    this.regex = regex;
    this.lineNumber = lineNumber;
    this.line = trimmedLine;
  }

  matches(path: string): boolean {
    return this.regex.test(path);
  }
}

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

export interface Explanation {
  outcome: "ignored" | "accepted";
  reason?: GitIgnorePattern;
}

export class GitIgnore {
  private patterns: GitIgnorePattern[] = [];
  private basePath: string;

  constructor(gitignoreContent: string, basePath: string = "") {
    this.basePath = basePath.replace(/\\/g, "/");
    if (this.basePath && !this.basePath.endsWith("/")) {
      this.basePath += "/";
    }
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

    return new GitIgnorePattern(trimmedLine, lineNumber, this.basePath);
  }

  isAccepted(path: string): boolean {
    return this.explain(path).outcome === "accepted";
  }

  isIgnored(path: string): boolean {
    return this.explain(path).outcome === "ignored";
  }

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
