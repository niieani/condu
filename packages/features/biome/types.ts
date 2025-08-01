import type { Configuration } from "@condu/schema-types/schemas/biome.gen.js";

export interface BiomeFeatureInput {
  config?: Partial<Configuration>;
  ignore?: string[];
  useAsDefaultFormatter?: boolean;
}

export type BiomeFeaturePeerContext = Required<BiomeFeatureInput>;

declare module "condu" {
  interface PeerContext {
    biome: BiomeFeaturePeerContext;
  }
}
