export function safelyParseLastJsonFromString(str: string): object | undefined {
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
