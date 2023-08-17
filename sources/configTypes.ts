import * as t from "./utils/io-ts/io-ts.js";

const TaskValidator = t.type({
  // e.g. 'test:lint'
  name: t.string,
  // what is this task for? are we testing something, building, etc.
  type: t.unionOfStrings("test", "build", "execute", "publish"),
  // potentially add something like "after" or "before" to ensure order
});
export type Task = t.TypeOf<typeof TaskValidator>;
const FileDefValidator = t.type({
  path: t.string,
  content: t.string,
});
export type FileDef = t.TypeOf<typeof FileDefValidator>;
const StateValidator = t.type({
  /** these files will be created during execution */
  files: t.readonlyArray(FileDefValidator),
  /** we'll ensure these dependencies are installed during execution */
  devDependencies: t.readonlyArray(t.string),
  tasks: t.readonlyArray(TaskValidator),
});
export type State = t.TypeOf<typeof StateValidator>;

export type FinalState = {
  files: FileDef[];
  devDependencies: string[];
  tasks: Task[];
};
const FeatureActionFnValidator: t.Type<
  (config: RepoConfig, state: State) => Partial<State>
> = t.FunctionT;
export type FeatureActionFn = t.TypeOf<typeof FeatureActionFnValidator>;

const FeatureConfigValidator = t.intersection([
  t.type({
    name: t.string,
  }),
  t.partial({
    /** set the order execution */
    order: t.partial({
      after: t.array(t.string),
      priority: t.unionOfStrings("beginning", "end"),
    }),
  }),
]);

const FeatureDefinitionValidator = t.intersection([
  t.type({
    actionFn: FeatureActionFnValidator,
  }),
  FeatureConfigValidator,
]);
export type FeatureDefinition = t.TypeOf<typeof FeatureDefinitionValidator>;

// const DefinedFeatureValidator = t.intersection([
//   t.type({
//     [featureConfigProperty]: FeatureConfigValidator,
//   }),
//   FeatureActionFnValidator,
// ]);
// export type DefinedFeature = t.TypeOf<typeof DefinedFeatureValidator>;

export const RepoConfigValidator = t.intersection([
  t.type({
    engine: t.unionOfStrings("node@20", "node@latest", "bun@latest"),
    features: t.array(FeatureDefinitionValidator),
  }),
  t.partial({
    monorepo: t.boolean,
  }),
]);
export type RepoConfig = t.TypeOf<typeof RepoConfigValidator>;
