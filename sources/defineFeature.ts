import type { FeatureDefinition } from "./configTypes.js";

// export const featureConfigProperty = "config"; // Symbol("config");
export const defineFeature = (
  definition: FeatureDefinition,
): FeatureDefinition => definition;
// Object.assign(actionFn, { [featureConfigProperty]: config });
