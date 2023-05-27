type State = {
  files: [File]
}

type FeatureActionFn = (
  config: RepoConfig,
  state: State,
) => State

interface RepoConfig {
  engine: {
    type: 'node' | 'bun'
    version: '20' | 'latest',
  },
  monorepo?: boolean,
  features: readonly FeatureActionFn[]
}