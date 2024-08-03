export function matchWildcard(pattern: string, str: string) {
  // Escape special characters in pattern and replace '*' with '.*' for regex
  const regexPattern = pattern
    .replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")
    .replace(/\*/g, ".*");

  // Create a regular expression from the pattern
  const regex = new RegExp(`^${regexPattern}$`);

  // Test if the string matches the regular expression
  return regex.test(str);
}
