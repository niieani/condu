/**
 * Attempts to parse a JSON string or find the last valid JSON object/array within a string.
 * First tries to parse the entire string as JSON. If that fails, it searches for the last
 * valid JSON object or array in the string by tracking opening and closing braces/brackets.
 *
 * @param str - The input string that may contain JSON
 * @returns {object | number | string | undefined} The parsed JSON object/array, or undefined if no valid JSON is found
 *
 * @example // Returns parsed JSON if entire string is valid JSON
 * safelyParseLastJsonFromString('"value"') // returns "value"
 *
 * @example // Returns last valid JSON object in string with other content
 * safelyParseLastJsonFromString('some text {"key": "value"}') // returns {key: "value"}
 *
 * @example // Returns undefined if no valid JSON is found
 * safelyParseLastJsonFromString('invalid json') // returns undefined
 */
export function safelyParseLastJsonFromString(
  str: string,
): object | number | string | undefined {
  // Attempt to parse the whole string as JSON
  try {
    return JSON.parse(str);
  } catch {
    let lastJson: object | undefined = undefined;
    let jsonStartIndex = -1;
    let braceStack: string[] = [];

    for (let i = 0; i < str.length; i++) {
      if (str[i] === "{" || str[i] === "[") {
        if (braceStack.length === 0) {
          jsonStartIndex = i;
        }
        braceStack.push(str[i]!);
      } else if (str[i] === "}" || str[i] === "]") {
        const lastBrace = braceStack.pop();
        if (
          (str[i] === "}" && lastBrace !== "{") ||
          (str[i] === "]" && lastBrace !== "[")
        ) {
          braceStack = [];
          jsonStartIndex = -1;
          continue;
        }
        if (braceStack.length === 0 && jsonStartIndex !== -1) {
          const jsonString = str.slice(jsonStartIndex, i + 1);
          try {
            lastJson = JSON.parse(jsonString);
          } catch {
            // Ignore parsing errors and continue
          }
          jsonStartIndex = -1;
        }
      }
    }

    return lastJson;
  }
}
