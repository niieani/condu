# Changelog

## [1.0.0](https://github.com/niieani/condu/compare/condu@0.1.10...condu@1.0.0) (2025-08-02)


### Features

* add auto-package-exports feature for generating package.json exports field ([0865581](https://github.com/niieani/condu/commit/0865581f400c85f84638c1fa4de85799f6c699b1))
* add support for inline features ([a7c131c](https://github.com/niieani/condu/commit/a7c131cfeafbc35560b4806a6ce07307678f542d))
* correct 'init' command ([47031b5](https://github.com/niieani/condu/commit/47031b50bce48a2cdbb8725a397f3f09235d76b3))
* expose globalRegistry in manifest modifications ([553c5fa](https://github.com/niieani/condu/commit/553c5fad6004064770d823830fad1a19b31177b0))
* implement feature testing utility ([eda0726](https://github.com/niieani/condu/commit/eda072696fe04953c9e01d8689962dd6df1f4657))
* implement package-scripts feature ([e123329](https://github.com/niieani/condu/commit/e123329374b28be0fa337598a3b454c83f241e01))
* implement packageScripts feature ([2297655](https://github.com/niieani/condu/commit/22976552c6f33cb0e30ebcb13d4690f80bc8c611))
* implement project.hasFeature() ([3588d19](https://github.com/niieani/condu/commit/3588d192b124fd25a19bb44d9e0a5d4c0af45569))


### Bug Fixes

* bump dependencies ([ac6a65e](https://github.com/niieani/condu/commit/ac6a65e45620f2111bc8f609be0350af24e11cce))
* bump remeda and node packages ([f009721](https://github.com/niieani/condu/commit/f00972173947c48e22a816c67b1b6b9406a39b29))
* correctly output publishConfig ([a1b3ad4](https://github.com/niieani/condu/commit/a1b3ad4bbbaeb431b7f1739a3b4aae5fd63d5ddc))
* dependency upgrade ([ba2f8bb](https://github.com/niieani/condu/commit/ba2f8bb0cb6ab8f9f59861f1e921971238ec868b))
* enable erasableSyntaxOnly ([0b631e5](https://github.com/niieani/condu/commit/0b631e516a6cbd131e65bdf379201591b82319a4))
* enable packageScripts for condu ([73bce96](https://github.com/niieani/condu/commit/73bce96d44e6f98a1adf7c03c06c87181fed1d42))
* exclude files that are already in gitignore ([5536a27](https://github.com/niieani/condu/commit/5536a27e6cadf5916fd61ddad90c665cde3d6e77))
* fixes from dependency bump ([66b22ea](https://github.com/niieani/condu/commit/66b22ea2ec08ab5440079053a720033637c41a6a))
* make root package work in non-monorepo ([3e24006](https://github.com/niieani/condu/commit/3e24006536c427eeaecdbc452a045f83e165816e))
* mark anonymous recipes ([8edb66f](https://github.com/niieani/condu/commit/8edb66f5112430c26e63df99d62f80c40b788682))
* move throwOnManualChanges logic into FileManager ([ce3ef59](https://github.com/niieani/condu/commit/ce3ef59a3095a8681b97c0529c9c0393b3e4197b))
* support internal manifest modifiers ([6feac0b](https://github.com/niieani/condu/commit/6feac0bfb298b4c5b4b80318510ce2990d9a867c))
* update moon CI setup to use pnpm action and improve conflict resolution handling ([742635d](https://github.com/niieani/condu/commit/742635d56c57644939e8c241db178419c34328e8))
* upgrade dependencies ([df64406](https://github.com/niieani/condu/commit/df64406b2322e8db6d1ad3f86f6ab9dfd3001871))
* upgrade dependencies ([37f4e2b](https://github.com/niieani/condu/commit/37f4e2babd29a9be1c69427ee13bcd08b8bbe25a))
* upgrade packages ([92e7272](https://github.com/niieani/condu/commit/92e72720753b246a5e67c08224ce1fc46c5f9a09))
* use biome as formatter ([5f2554d](https://github.com/niieani/condu/commit/5f2554d038d11b4261a06f8e97e64fedc68a1523))
* when a symlink already exists and we say to overwrite it with file contents, it should remove the symlink first, otherwise for some reason it writes over the symlink target ([b27ce06](https://github.com/niieani/condu/commit/b27ce0625f18d0f04f655a4bbd8c92400e101364))


### Miscellaneous Chores

* release 1.0.0 ([9d876c9](https://github.com/niieani/condu/commit/9d876c9fba8dbc305ac5be25e6f4fda47d6400b9))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 1.0.0
    * @condu/package-manager-utils bumped to 1.0.0
    * @condu/schema-types bumped to 1.0.0
    * @condu/update-specifiers bumped to 1.0.0
    * @condu/workspace-utils bumped to 1.0.0

## [0.1.10](https://github.com/niieani/condu/compare/condu@0.1.9...condu@0.1.10) (2024-12-21)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.7
    * @condu/update-specifiers bumped to 0.1.7
    * @condu/workspace-utils bumped to 0.1.7

## [0.1.9](https://github.com/niieani/condu/compare/condu@0.1.8...condu@0.1.9) (2024-12-21)


### Features

* skip release if up-to-date and add provenance ([26347b7](https://github.com/niieani/condu/commit/26347b753f62a619d86222ad018a0e01d1a55975))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.6
    * @condu/update-specifiers bumped to 0.1.6

## [0.1.8](https://github.com/niieani/condu/compare/condu@0.1.7...condu@0.1.8) (2024-12-11)


### Bug Fixes

* keep cli separate from main export ([4d9483f](https://github.com/niieani/condu/commit/4d9483fc9079182b6dae257b2beccdd00773f16f))

## [0.1.6](https://github.com/niieani/condu/compare/@condu/cli@0.1.5...@condu/cli@0.1.6) (2024-10-12)


### Bug Fixes

* break circular dependency (move autolink to platform) ([f5abb07](https://github.com/niieani/condu/commit/f5abb074253a1630535331ce08a78442c3e6e3b2))
* update deprecated node API ([e665bb4](https://github.com/niieani/condu/commit/e665bb412884223d59c51f90ef69589ee96ec30c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.5
    * @condu/types bumped to 0.1.5
    * @condu/update-specifiers bumped to 0.1.5
    * @condu/workspace-utils bumped to 0.1.6

## [0.1.5](https://github.com/niieani/condu/compare/@condu/cli@0.1.4...@condu/cli@0.1.5) (2024-10-07)


### Features

* add options to `writeProjectManifest` ([386ee2b](https://github.com/niieani/condu/commit/386ee2b646b95042213566217efcd858dae64d6d))
* add release-please publish actions ([a96c313](https://github.com/niieani/condu/commit/a96c313d600bf17caad0be7261e54018af9ab4e1))
* allow configuring eslint feature ([1e75f88](https://github.com/niieani/condu/commit/1e75f885419b876d264467e741a6fa55970ef84c))
* autolink default ignore ([1a2005f](https://github.com/niieani/condu/commit/1a2005f115656b203e60cd92ec1f3a2898473cfd))
* before-release support for CI-specific package preparation ([a4bc41d](https://github.com/niieani/condu/commit/a4bc41db5acb65a19870adf8a391689b34411528))
* correctly resolve package versions before publishing ([ac37454](https://github.com/niieani/condu/commit/ac374544ecb35ad3c3f27a830f24276928168306))
* enable linking other monorepos ([e707687](https://github.com/niieani/condu/commit/e707687bd2d5e109bb6d9eb96a9b777eb85e9737))
* fix read-write and add dummy package for release ([56a0296](https://github.com/niieani/condu/commit/56a0296df80933c6a908d78e1f30318a9c46e0f1))
* implement autolink ([2e991df](https://github.com/niieani/condu/commit/2e991dfd7896dcf9fe9660675670a2731b1075e4))
* initial support for single-repo configuration ([08402b2](https://github.com/niieani/condu/commit/08402b263ca671c05a0d3085a4801baa172910d0))
* initial version of init command ([ba7ae41](https://github.com/niieani/condu/commit/ba7ae415a13618fd3fdd92b276c8bd3928b88b6f))
* npmrc for pnpm feature support ([dfe3c22](https://github.com/niieani/condu/commit/dfe3c22bc4c7fa66f2517c284b9cbbf48bcc544c))
* package cli as 'condu' npm package ([0c1860b](https://github.com/niieani/condu/commit/0c1860bc4ccc11d89fce8c938f9d5e70d88a9c98))
* refactor package loading ([4c736a8](https://github.com/niieani/condu/commit/4c736a83077e0294a7854c8a2b9c95a5878149f3))
* support package creation from template ([72234b1](https://github.com/niieani/condu/commit/72234b1d700bd909632a345d3c5e40cc2aabc0bd))
* support release to NPM ([4401bfe](https://github.com/niieani/condu/commit/4401bfe7a457ea3fb516d0165b89652aa3ef5200))


### Bug Fixes

* add "access: public" ([a15f582](https://github.com/niieani/condu/commit/a15f5827715367a3cdd2d39edbb7c63af7b2f9a8))
* correct prettier config ([9989094](https://github.com/niieani/condu/commit/99890941f5cd389caaa7f2ca65ae866ac81750cf))
* correct yarn gitignores ([e79db54](https://github.com/niieani/condu/commit/e79db54e78a41157ae90a2f6e5ac648fda602c27))
* correctly build typescript ([f4fe049](https://github.com/niieani/condu/commit/f4fe04933e439a27e1f82e58dfcfc983720a259f))
* dependency update ([f01d63a](https://github.com/niieani/condu/commit/f01d63a200c71a92319b0c99dd1eeb491376578e))
* do not halt when in non-interactive TTY ([bd67353](https://github.com/niieani/condu/commit/bd6735371579e361369f27f1cd1130da0fc65a27))
* extract core functionality to 'condu' package ([e2a5e53](https://github.com/niieani/condu/commit/e2a5e539f7aeaadedd3359d8bf80591f3e4ee258))
* improve exec internals ([0eaaf64](https://github.com/niieani/condu/commit/0eaaf64d2b4bae69bd78d47a08cee1525bdc40e2))
* improve support for various package managers ([acfe5d1](https://github.com/niieani/condu/commit/acfe5d1469145e27084a75dbb01ac3c9c053c4dc))
* include condu version in cache file ([77b1276](https://github.com/niieani/condu/commit/77b127676f7b1e03d0aceaa3e8cc26e075f71be9))
* invalid workspace reference ([37f6029](https://github.com/niieani/condu/commit/37f6029848a43f06627f0ee2f7fcef4e535a7d07))
* package updates and eslint fixes ([0ed7c63](https://github.com/niieani/condu/commit/0ed7c63c75992a8952c84d6d79280f3ca3bf4225))
* rename workspace name to allow for 'condu' package creation ([5b4dbfe](https://github.com/niieani/condu/commit/5b4dbfe0912ad8d64a227b875d34c39ae5d50959))
* small improvements to release ([f8a0293](https://github.com/niieani/condu/commit/f8a029366cb6d5a162c50e6c29b6c2c871c01576))
* throw when no packages defined in before-release ([f30594f](https://github.com/niieani/condu/commit/f30594f42b81ed381af37d75fcff3e721154c311))
* use correct package version ([ecf9fc3](https://github.com/niieani/condu/commit/ecf9fc3e7fd463b56f828d5469105deafceef109))
* use default registry ([5bcf8ed](https://github.com/niieani/condu/commit/5bcf8ed1d325b60b50d4c7998bf8dd5264d35ebd))
* various small fixes ([c8fbadf](https://github.com/niieani/condu/commit/c8fbadf0f538086dca5d8d4093c274128c793743))


### Performance Improvements

* do not write cache file if no changes were done ([d13b4b9](https://github.com/niieani/condu/commit/d13b4b923109ac49db7a093aaf13a0e4b697f155))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.4
    * @condu/types bumped to 0.1.4
    * @condu/update-specifiers bumped to 0.1.4
    * @condu/workspace-utils bumped to 0.1.5
    * @condu-feature/autolink bumped to 0.0.1

## [0.1.4](https://github.com/niieani/condu/compare/@condu/cli@0.1.3...@condu/cli@0.1.4) (2024-08-03)


### Features

* initial support for single-repo configuration ([08402b2](https://github.com/niieani/condu/commit/08402b263ca671c05a0d3085a4801baa172910d0))
* initial version of init command ([ba7ae41](https://github.com/niieani/condu/commit/ba7ae415a13618fd3fdd92b276c8bd3928b88b6f))


### Bug Fixes

* do not halt when in non-interactive TTY ([bd67353](https://github.com/niieani/condu/commit/bd6735371579e361369f27f1cd1130da0fc65a27))
* improve exec internals ([0eaaf64](https://github.com/niieani/condu/commit/0eaaf64d2b4bae69bd78d47a08cee1525bdc40e2))
* improve support for various package managers ([acfe5d1](https://github.com/niieani/condu/commit/acfe5d1469145e27084a75dbb01ac3c9c053c4dc))


### Performance Improvements

* do not write cache file if no changes were done ([d13b4b9](https://github.com/niieani/condu/commit/d13b4b923109ac49db7a093aaf13a0e4b697f155))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.3
    * @condu/types bumped to 0.1.3
    * @condu/update-specifiers bumped to 0.1.3
    * @condu/workspace-utils bumped to 0.1.4

## [0.1.3](https://github.com/niieani/toolchain/compare/@condu/cli@0.1.2...@condu/cli@0.1.3) (2024-07-25)


### Features

* enable linking other monorepos ([e707687](https://github.com/niieani/toolchain/commit/e707687bd2d5e109bb6d9eb96a9b777eb85e9737))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.2
    * @condu/types bumped to 0.1.2
    * @condu/update-specifiers bumped to 0.1.2
    * @condu/workspace-utils bumped to 0.1.3

## [0.1.2](https://github.com/niieani/toolchain/compare/@condu/cli@0.1.1...@condu/cli@0.1.2) (2024-07-10)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/workspace-utils bumped to 0.1.2

## [0.1.1](https://github.com/niieani/toolchain/compare/@condu/cli@0.1.0...@condu/cli@0.1.1) (2024-07-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.1
    * @condu/types bumped to 0.1.1
    * @condu/update-specifiers bumped to 0.1.1
    * @condu/workspace-utils bumped to 0.1.1

## [0.1.0](https://github.com/niieani/toolchain/compare/@condu/cli@0.0.1...@condu/cli@0.1.0) (2024-07-08)


### Features

* correctly resolve package versions before publishing ([ac37454](https://github.com/niieani/toolchain/commit/ac374544ecb35ad3c3f27a830f24276928168306))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.1.0
    * @condu/types bumped to 0.1.0
    * @condu/update-specifiers bumped to 0.1.0
    * @condu/workspace-utils bumped to 0.1.0

## 0.0.1 (2024-07-07)


### Features

* add options to `writeProjectManifest` ([386ee2b](https://github.com/niieani/toolchain/commit/386ee2b646b95042213566217efcd858dae64d6d))
* add release-please publish actions ([a96c313](https://github.com/niieani/toolchain/commit/a96c313d600bf17caad0be7261e54018af9ab4e1))
* before-release support for CI-specific package preparation ([a4bc41d](https://github.com/niieani/toolchain/commit/a4bc41db5acb65a19870adf8a391689b34411528))
* fix read-write and add dummy package for release ([56a0296](https://github.com/niieani/toolchain/commit/56a0296df80933c6a908d78e1f30318a9c46e0f1))
* package cli as 'condu' npm package ([0c1860b](https://github.com/niieani/toolchain/commit/0c1860bc4ccc11d89fce8c938f9d5e70d88a9c98))
* refactor package loading ([4c736a8](https://github.com/niieani/toolchain/commit/4c736a83077e0294a7854c8a2b9c95a5878149f3))
* support release to NPM ([4401bfe](https://github.com/niieani/toolchain/commit/4401bfe7a457ea3fb516d0165b89652aa3ef5200))


### Bug Fixes

* add "access: public" ([a15f582](https://github.com/niieani/toolchain/commit/a15f5827715367a3cdd2d39edbb7c63af7b2f9a8))
* correct yarn gitignores ([e79db54](https://github.com/niieani/toolchain/commit/e79db54e78a41157ae90a2f6e5ac648fda602c27))
* correctly build typescript ([f4fe049](https://github.com/niieani/toolchain/commit/f4fe04933e439a27e1f82e58dfcfc983720a259f))
* extract core functionality to 'condu' package ([e2a5e53](https://github.com/niieani/toolchain/commit/e2a5e539f7aeaadedd3359d8bf80591f3e4ee258))
* invalid workspace reference ([37f6029](https://github.com/niieani/toolchain/commit/37f6029848a43f06627f0ee2f7fcef4e535a7d07))
* rename workspace name to allow for 'condu' package creation ([5b4dbfe](https://github.com/niieani/toolchain/commit/5b4dbfe0912ad8d64a227b875d34c39ae5d50959))
* throw when no packages defined in before-release ([f30594f](https://github.com/niieani/toolchain/commit/f30594f42b81ed381af37d75fcff3e721154c311))
* use correct package version ([ecf9fc3](https://github.com/niieani/toolchain/commit/ecf9fc3e7fd463b56f828d5469105deafceef109))
* use default registry ([5bcf8ed](https://github.com/niieani/toolchain/commit/5bcf8ed1d325b60b50d4c7998bf8dd5264d35ebd))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/core bumped to 0.0.1
    * @condu/types bumped to 0.0.1
    * @condu/update-specifiers bumped to 0.0.1
    * @condu/workspace-utils bumped to 0.0.1
