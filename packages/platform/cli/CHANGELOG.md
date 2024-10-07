# Changelog

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
