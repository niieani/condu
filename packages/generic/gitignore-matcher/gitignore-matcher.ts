// gitignore-matcher.ts

export class GitIgnorePattern {
  regex: RegExp;
  isNegated: boolean;
  originalPattern: string;
  isDirectoryPattern: boolean;
  lineNumber: number;

  constructor(
    pattern: string,
    isNegated: boolean,
    isDirectoryPattern: boolean,
    regex: RegExp,
    lineNumber: number,
  ) {
    this.originalPattern = pattern;
    this.isNegated = isNegated;
    this.isDirectoryPattern = isDirectoryPattern;
    this.regex = regex;
    this.lineNumber = lineNumber;
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
    line = line.trimStart();

    // Skip empty lines and comments unless the hash is escaped
    if (line.length === 0 || line[0] === "#") {
      return undefined;
    }

    // Handle trailing spaces that are not escaped
    line = line.replace(/(?<!\\)\s+$/, "");

    // Determine if the pattern is negated
    let isNegated = false;
    if (line.startsWith("!")) {
      isNegated = true;
      line = line.slice(1);
    }

    // Patterns ending with '/' only match directories
    let isDirectoryPattern = false;
    if (line.endsWith("/")) {
      isDirectoryPattern = true;
      line = line.slice(0, -1);
    }

    // Convert the pattern to a regular expression
    const regex = this.patternToRegex(line, isDirectoryPattern);
    return new GitIgnorePattern(
      line,
      isNegated,
      isDirectoryPattern,
      regex,
      lineNumber,
    );
  }

  private patternToRegex(pattern: string, isDirectoryPattern: boolean): RegExp {
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
        regexTokens.push(this.escapeRegex(char));
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
          regexTokens.push(this.escapeRegex(char));
        }
      }
      i++;
    }

    let regexStr = regexTokens.join("");

    if (anchored) {
      // Pattern starts with '/', match from basePath
      regexStr = "^" + this.escapeRegex(this.basePath) + regexStr;
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

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  accepts(path: string): boolean {
    return !this.isIgnored(path);
  }

  isIgnored(path: string): boolean {
    path = path.startsWith("/") ? path.slice(1) : path;

    const pathSegments = path.split("/");

    const excludedDirectories = new Map<string, GitIgnorePattern>();
    // Check if any parent directory is excluded
    const excludedByParent = isParentDirectoryExcluded(
      pathSegments,
      excludedDirectories,
    );
    if (excludedByParent) {
      return true;
    }

    let isIgnored = false;

    for (const pattern of this.patterns) {
      if (pattern.matches(path)) {
        if (pattern.isNegated) {
          // Cannot re-include files from excluded directories
          if (isParentDirectoryExcluded(pathSegments, excludedDirectories)) {
            continue;
          }
          isIgnored = false;
        } else {
          isIgnored = true;
          // If the pattern is a directory pattern, exclude the directory specified by the pattern
          if (pattern.isDirectoryPattern) {
            // Remove trailing slashes
            const dirToExclude = pattern.originalPattern.replace(/\/+$/, "");
            excludedDirectories.set(dirToExclude, pattern);
          }
        }
      }
    }
    return isIgnored;
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

    for (const pattern of this.patterns) {
      if (pattern.matches(path)) {
        if (pattern.isNegated) {
          // Cannot re-include files from excluded directories
          if (isParentDirectoryExcluded(pathSegments, excludedDirectories)) {
            continue;
          }
          if (result.outcome === "ignored") {
            result = {
              outcome: "accepted",
              reason: pattern,
            };
          }
        } else {
          result = {
            outcome: "ignored",
            reason: pattern,
          };
          // If the pattern is a directory pattern, exclude the directory specified by the pattern
          if (pattern.isDirectoryPattern) {
            // Remove trailing slashes
            const dirToExclude = pattern.originalPattern.replace(/\/+$/, "");
            excludedDirectories.set(dirToExclude, pattern);
          }
        }
      }
    }
    return result;

    // path = path.startsWith("/") ? path.slice(1) : path;

    // let reason: GitIgnorePattern | undefined;
    // for (const pattern of this.patterns) {
    //   if (pattern.matches(path)) {
    //     reason = pattern;
    //     return true;
    //   }
    // }
    // return false;
  }
}
