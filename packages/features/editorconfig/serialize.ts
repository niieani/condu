import type { EditorConfig } from "./types.js";

/**
 * Serializes an `EditorConfig` object into a string suitable for an `.editorconfig` file.
 *
 * @param config - The EditorConfig configuration object to serialize.
 * @returns A string representation of the EditorConfig suitable for writing to a file.
 */
export function serializeEditorConfig(config: EditorConfig): string {
  let result = "";

  // Handle the root key
  if (config.root !== undefined) {
    result += `root = ${config.root}\n\n`;
  }

  // Serialize each section
  for (const [pattern, settings] of Object.entries(config.sections)) {
    result += `[${pattern}]\n`;

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined) {
        result += `${key} = ${typeof value === "boolean" ? (value ? "true" : "false") : value}\n`;
      }
    }

    result += `\n`;
  }

  return result.trim(); // Remove any trailing new lines
}
