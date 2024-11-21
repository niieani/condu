import type {
  FeatureDefinition,
  PeerContext,
} from "../cli/commands/apply/applyTypes.js";

export const defineFeature = <NameT extends keyof PeerContext | (string & {})>(
  definition: FeatureDefinition<NameT>,
): FeatureDefinition<NameT> => definition;
