import { defineFeature } from "condu";
import { serializeEditorConfig } from "./serialize.js";
import type { EditorConfig, EditorConfigSection } from "./types.js";

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

declare module "condu" {
  interface PeerContext {
    editorconfig: {
      sections: Record<string, EditorConfigSection>;
    };
  }
  interface FileNameToSerializedTypeMapping {
    ".editorconfig": EditorConfig;
  }
}

export const editorconfig = (config?: EditorConfig) =>
  defineFeature("editorconfig", {
    initialPeerContext: {
      // TODO: perhaps add some basic properties to GlobalPeerContext
      //       and derive the section defaults from there
      sections: config?.sections ?? defaultConfig.sections,
    },
    defineRecipe(condu, { sections }) {
      condu.root.generateFile(".editorconfig", {
        content: {
          ...defaultConfig,
          sections,
        },
        stringify: serializeEditorConfig,
      });
    },
  });
