import { CONDU_CONFIG_DIR_NAME } from "@condu/types/constants.js";
import { defineFeature } from "condu/defineFeature.js";
import * as path from "node:path";
import { groupBy } from "remeda";

declare module "@condu/types/applyTypes.js" {
  interface PeerContext {
    gitignore: {
      ignore: string[];
    };
  }
}

export const gitignore = ({ ignore = [] }: { ignore?: string[] } = {}) =>
  defineFeature({
    name: "gitignore",
    after: "*",
    initialPeerContext: {
      ignore: [],
    },
    mergePeerContext: (config) => ({
      condu: (peerContext) => ({ ...peerContext }),
    }),
    defineRecipe(condu, peerContext) {
      condu.root.generateFile(".gitignore", {
        content: ".DS_Store",
      });
    },
  });
