import type { Oxlintrc } from "@condu/schema-types/schemas/oxlint.gen.js";

export interface OxlintFeatureInput {
  config?: Partial<Oxlintrc>;
  ignore?: string[];
}

export interface OxlintFeaturePeerContext {
  config: Partial<Oxlintrc>;
  ignore: string[];
}

declare module "condu" {
  interface PeerContext {
    oxlint: OxlintFeaturePeerContext;
  }
}
