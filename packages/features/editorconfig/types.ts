/**
 * Defines the structure and supported properties for an `.editorconfig` file.
 */
export interface EditorConfig {
  /**
   * Must be specified in the preamble. Set to true to tell the core not to check any higher directory for EditorConfig settings for the current filename.
   * The value is case-insensitive.
   */
  root?: boolean;

  /**
   * A record of sections, each containing a file pattern (e.g., `*`, `*.md`, `[Makefile]`) and its corresponding settings.
   */
  sections: Record<string, EditorConfigSection>;
}

/**
 * Defines the supported settings within a `.editorconfig` section.
 */
export interface EditorConfigSection {
  /**
   * Set to `tab` or `space` to use hard tabs or soft tabs respectively. The values are case insensitive.
   */
  indent_style?: IndentStyle;

  /**
   * Set to a whole number defining the number of columns used for each indentation level and the width of soft tabs (when supported).
   * If this equals `tab`, the `indent_size` shall be set to the `tab_width` (if specified); else, the tab size set by the editor.
   * The values are case insensitive.
   */
  indent_size?: number | "tab";

  /**
   * Set to a whole number defining the number of columns used to represent a tab character.
   * This defaults to the value of `indent_size` and should not usually need to be specified.
   */
  tab_width?: number;

  /**
   * Set to `lf`, `cr`, or `crlf` to control how line breaks are represented. The values are case insensitive.
   */
  end_of_line?: EndOfLine;

  /**
   * Set to `latin1`, `utf-8`, `utf-8-bom`, `utf-16be` or `utf-16le` to control the character set.
   * Use of `utf-8-bom` is discouraged.
   */
  charset?: Charset;

  /**
   * Sets the natural language that should be used for spell checking. Only one language can be specified.
   * There is no default value.
   *
   * The format is `ss` or `ss-TT`, where `ss` is an ISO 639 two-letter language code and `TT` is an ISO 3166 two-letter territory identifier.
   * (Therefore `spelling_language` must be either two or five characters long.)
   *
   * **Note:** This property does not specify the charset to be used. The charset is specified in the separate property `charset`.
   */
  spelling_language?: string;

  /**
   * Set to `true` to remove all whitespace characters preceding newline characters in the file and `false` to ensure it doesn’t.
   */
  trim_trailing_whitespace?: boolean;

  /**
   * Set to `true` to ensure the file ends with a newline when saving and `false` to ensure it doesn’t.
   * Editors must not insert newlines in empty files when saving those files, even if `insert_final_newline = true`.
   */
  insert_final_newline?: boolean;

  /**
   * Forces hard line wrapping after the amount of characters specified.
   * 'off' to turn off this feature (use the editor settings).
   */
  max_line_length?: number | "off";

  [key: string]: boolean | number | string | undefined;
}
/**
 * Supported values for the `indent_style` property.
 */
export type IndentStyle = "space" | "tab";
/**
 * Supported values for the `end_of_line` property.
 */
export type EndOfLine = "lf" | "crlf" | "cr";
/**
 * Supported values for the `charset` property.
 */
export type Charset =
  | "utf-8"
  | "utf-16be"
  | "utf-16le"
  | "latin1"
  | "utf-8-bom";
