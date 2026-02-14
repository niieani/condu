import type { Oxfmtrc } from "@condu/schema-types/schemas/oxfmt.gen.js";

export interface OxfmtFeatureInput {
  config?: Partial<Oxfmtrc>;
  ignore?: string[];
}

export type OxfmtFeaturePeerContext = Required<OxfmtFeatureInput>;

declare module "condu" {
  interface PeerContext {
    oxfmt: OxfmtFeaturePeerContext;
  }
}
