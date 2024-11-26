import type { FeatureDefinition } from "@condu/cli/commands/apply/conduApi.js";
import type { PeerContext } from "@condu/types/extendable.js";

export const defineFeature = <NameT extends keyof PeerContext | (string & {})>(
  definition: FeatureDefinition<NameT>,
): FeatureDefinition<NameT> => definition;
