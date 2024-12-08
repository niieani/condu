import type { ConduConfigWithInferredValues } from "condu";
import type { Linter } from "eslint";

export interface EslintFeatureInput {
  defaultRules?: Partial<Linter.RulesRecord>;
  ignores?: string[];
}

export interface ContextProvidedToEslintConfig
  extends Pick<ConduConfigWithInferredValues, "conventions" | "projects">,
    EslintFeatureInput {}

export type AdditionalConfigs =
  | Linter.Config[]
  | ((context: ContextProvidedToEslintConfig) => Linter.Config[]);

// this function is only here to provide type information when doing 'export default'
export const extendEslintConfig = (input: AdditionalConfigs) => input;
