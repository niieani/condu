import type {
  FeatureDefinition,
  FeatureDefinitionInput,
} from "@condu/cli/commands/apply/conduApi.js";
import type { PeerContext } from "@condu/types/extendable.js";

export const defineFeature = <NameT extends keyof PeerContext | (string & {})>(
  name: NameT,
  definition: FeatureDefinitionInput<NameT>,
): FeatureDefinition<NameT> => ({
  name,
  ...definition,
  stack: new Error().stack?.split("\n").slice(2).join("\n"),
});
