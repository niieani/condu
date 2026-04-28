import type { Oxlintrc } from "@condu/schema-types/schemas/oxlint.gen.js";

export interface OxlintRootOptions {
  reportUnusedDisableDirectives?: "off" | "warn" | "error";
  typeAware?: boolean;
  typeCheck?: boolean;
}

export type OxlintConfig = Partial<Oxlintrc> & {
  options?: OxlintRootOptions;
};

export interface OxlintFeatureInput {
  config?: OxlintConfig;
  ignore?: string[];
}

export interface OxlintFeaturePeerContext {
  config: OxlintConfig;
  ignore: string[];
}

declare module "condu" {
  interface PeerContext {
    oxlint: OxlintFeaturePeerContext;
  }
}
