# condu

One config to rule them all.

Configuration as code. Think about condu as terraform for your repository configuration.

The un-template / un-boilerplate / un-scaffold / un-generator.
Keep ALL of your project configuration up to date, and easily override it, using a single language.

> WORK IN PROGRESS - NOT YET FUNCTIONAL

---

Managing the JavaScript ecosystem can be a full time job.
Upgrades to transpiles, migrations across builder systems, migrating or adding support for new engines (deno, bun), correct support for CommonJS and ESM, linting, testing, etc.
And if you maintain more than one package, multiply all of that work by each one!

Annoyed by ecosystem/tooling churn? Hard to maintain dependencies? Tired of manually updating configs?

Tired of various tools having different configuration formats?
Some starting with dot, some in their own folders, some in .json,
others in [.yaml](https://news.ycombinator.com/item?id=37687060), JavaScript, or even .toml?

Configure everything with code! In TypeScript, neatly organized inside of a `.config` folder.

Additionally, reuse your configuration across projects, and easily update them all at once.
Override only the parts you need to in your given project, and keep the rest up to date.

Scaffolding seems great at first, but isn't good enough, because it's not maintainable.
The ecosystem moves too fast, and there are no configuration management tools in the JavaScript ecosystem.

`condu` fixes [this](https://twitter.com/WarrenInTheBuff/status/1672839156647575552) long list of files in your root of repo:

- tsconfig.json
- .eslintrc
- .prettierrc
- .babel.config.js (implied child .babelrc)
- .webpack.config.js
- jest.config.js
- .env
- docker-compose.yml
- gitlab-ci.yml
- .npmrc
- .editorconfig

and [this](https://deno.com/blog/node-config-hell)

and [this](https://www.youtube.com/watch?v=wYdnJPYFTIE),

and [this](https://x.com/_swanson/status/1715073746073973203).

and [this](https://twitter.com/mattpocockuk/status/1792270311334854822)

`condu` is here to help out.
