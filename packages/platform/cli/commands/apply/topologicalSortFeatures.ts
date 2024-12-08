import { partition } from "remeda";
import type { FeatureDefinition } from "./conduApiTypes.js";

// Helper function to topologically sort features based on 'after' dependencies
export function topologicalSortFeatures(
  features: FeatureDefinition[],
): FeatureDefinition[] {
  const [featuresToRunAtTheEnd, remainingFeatures] = partition(
    features,
    (f) => f.after === "*",
  );

  const sortedFeatures = topologicalSortFeaturesInternal(remainingFeatures);

  return [...sortedFeatures, ...featuresToRunAtTheEnd];
}

function topologicalSortFeaturesInternal(
  features: FeatureDefinition[],
): FeatureDefinition[] {
  // Build a dependency graph
  const graph = new Map<string, Set<string>>(); // feature name -> set of features it depends on

  // First, initialize graph with all features
  for (const feature of features) {
    graph.set(feature.name, new Set());
  }

  // Build the dependency edges
  for (const feature of features) {
    let after = feature.after;
    if (!after) continue;

    let dependencies: string[];
    if (typeof after === "string") {
      dependencies = [after];
    } else {
      dependencies = after;
    }

    for (const dep of dependencies) {
      if (!graph.has(dep)) {
        throw new Error(
          `Feature ${feature.name} depends on unknown feature ${dep}`,
        );
      }
      graph.get(feature.name)!.add(dep);
    }
  }

  // Now, perform topological sort
  const sorted: FeatureDefinition[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  function visit(name: string) {
    if (visited.has(name)) return;
    if (temp.has(name)) {
      throw new Error("Circular dependency detected in features");
    }
    temp.add(name);
    const deps = graph.get(name)!;
    for (const dep of deps) {
      visit(dep);
    }
    temp.delete(name);
    visited.add(name);
    const feature = features.find((f) => f.name === name)!;
    sorted.push(feature);
  }

  for (const feature of features) {
    visit(feature.name);
  }

  return sorted;
}
