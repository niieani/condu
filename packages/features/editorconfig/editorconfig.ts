import { defineFeature } from "condu/defineFeature.js";
import { serializeEditorConfig } from "./serialize.js";
import type { EditorConfig } from "./types.js";

const defaultConfig: EditorConfig = {
  root: true,
  sections: {
    "*": {
      indent_style: "space",
      indent_size: 2,
      end_of_line: "lf",
      charset: "utf-8",
      trim_trailing_whitespace: true,
      insert_final_newline: true,
      max_line_length: 80,
    },
  },
};

export const editorconfig = (config: EditorConfig = defaultConfig) =>
  defineFeature({
    name: "editorconfig",
    actionFn: (_config, state) => ({
      effects: [
        {
          files: [
            {
              path: ".editorconfig",
              content: serializeEditorConfig(config),
            },
          ],
        },
      ],
    }),
  });
