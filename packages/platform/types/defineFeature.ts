import type { FeatureActionFn } from "@condu/cli/commands/apply/conduApiTypes.js";

export const defineFeature: FeatureActionFn = (name, definition) => ({
  ...definition,
  name,
  stack: new Error().stack?.split("\n").slice(2).join("\n") ?? import.meta.url,
});
