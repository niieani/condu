import type { FeatureDefinition } from "@condu/cli/commands/apply/conduApi.js";
import type { PeerContext } from "@condu/cli/commands/apply/PeerContext.js";

export const defineFeature = <NameT extends keyof PeerContext | (string & {})>(
  definition: FeatureDefinition<NameT>,
): FeatureDefinition<NameT> => definition;
