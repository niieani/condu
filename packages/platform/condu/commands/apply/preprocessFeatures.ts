import type { ConfiguredConduConfig } from "../../api/configTypes.js";
import { autolink } from "../../builtin-features/autolink.js";
import type { RecipeFunction, FeatureDefinition } from "./conduApiTypes.js";
import { topologicalSortFeatures } from "./topologicalSortFeatures.js";

/**
 * Converts recipe functions to feature definitions
 *
 * @param feature A feature definition or recipe function
 * @returns A feature definition
 */
function mapInlineRecipeToFeature(
  feature: RecipeFunction,
): FeatureDefinition<string> {
  // TODO: maybe fallback to sha of the recipe function.toString()?
  const name =
    feature.name || `recipe-${Math.random().toString(36).slice(2, 10)}`;
  return {
    name,
    defineRecipe: feature,
    stack:
      new Error().stack?.split("\n").slice(2).join("\n") ?? import.meta.url,
  };
}
/**
 * Preprocesses features from configuration, handling inline recipes,
 * autolinking, deduplication, and dependency sorting.
 *
 * This function performs several important transformations:
 * 1. Normalizes inline recipe functions to feature definitions
 * 2. Adds the built-in autolink feature if not explicitly disabled
 * 3. Deduplicates features by name (later definitions are prioritized)
 * 4. Sorts features topologically based on their dependencies
 *
 * @param config - The Condu configuration with inferred values
 * @returns An array of feature definitions, sorted topologically by dependencies
 */
export function preprocessFeatures(config: ConfiguredConduConfig) {
  // Process recipe functions into feature definitions
  const processedFeatures = config.features.map((feature) =>
    typeof feature === "function" ? mapInlineRecipeToFeature(feature) : feature,
  );

  // add autolink built-in feature if not disabled
  const features =
    config.autolink || !("autolink" in config)
      ? [
          ...processedFeatures,
          autolink(
            typeof config.autolink === "object" ? config.autolink : undefined,
          ),
        ]
      : processedFeatures;

  // Deduplicate features by name, ensuring later features override earlier ones
  const deduplicatedFeaturesMap = new Map<string, FeatureDefinition<any>>();

  for (const feature of features) {
    if (deduplicatedFeaturesMap.has(feature.name)) {
      console.warn(
        `Duplicate feature found: ${feature.name}. The first definition will be used.`,
      );
    } else {
      deduplicatedFeaturesMap.set(feature.name, feature);
    }
  }

  const deduplicatedFeatures = Array.from(deduplicatedFeaturesMap.values());

  // Topologically sort the deduplicated features
  const sortedFeatures = topologicalSortFeatures(deduplicatedFeatures);
  return sortedFeatures;
}
