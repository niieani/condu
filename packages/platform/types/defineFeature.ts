import type { FeatureDefinition, PeerContext } from "./applyTypes.js";

export const defineFeature = <NameT extends keyof PeerContext | (string & {})>(
  definition: FeatureDefinition<NameT>,
): FeatureDefinition<NameT> => definition;
