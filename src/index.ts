type File = {
  path: string
  content: string
}

type State = {
  files: File[]
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

const defineFeature = ({
  actionFn,
  ...config
}: {
  name: string
  actionFn: FeatureActionFn
  /** set the order execution */
  after?: string[]
}) => Object.assign(actionFn, config)

const gitignore = ({ignore = []}: {ignore?: string[]} = {}) =>
  defineFeature({
    name: 'gitignore',
    actionFn: (config, state) => {
      return {
        files: [
          {
            path: '.gitignore',
            content: ['node_modules', ...ignore].join('\n'),
          },
        ],
      }
    },
  })
