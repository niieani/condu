# Changelog

## [0.1.4](https://github.com/niieani/condu/compare/@condu/core@0.1.3...@condu/core@0.1.4) (2024-10-07)


### Features

* add options to `writeProjectManifest` ([386ee2b](https://github.com/niieani/condu/commit/386ee2b646b95042213566217efcd858dae64d6d))
* add release-please publish actions ([a96c313](https://github.com/niieani/condu/commit/a96c313d600bf17caad0be7261e54018af9ab4e1))
* add sync version of findUp ([a03b63e](https://github.com/niieani/condu/commit/a03b63ecd905b4b0df5f1f3bf570435c70bcd905))
* correctly resolve package versions before publishing ([ac37454](https://github.com/niieani/condu/commit/ac374544ecb35ad3c3f27a830f24276928168306))
* enable linking other monorepos ([e707687](https://github.com/niieani/condu/commit/e707687bd2d5e109bb6d9eb96a9b777eb85e9737))
* fix read-write and add dummy package for release ([56a0296](https://github.com/niieani/condu/commit/56a0296df80933c6a908d78e1f30318a9c46e0f1))
* implement autolink ([2e991df](https://github.com/niieani/condu/commit/2e991dfd7896dcf9fe9660675670a2731b1075e4))
* initial support for single-repo configuration ([08402b2](https://github.com/niieani/condu/commit/08402b263ca671c05a0d3085a4801baa172910d0))
* package cli as 'condu' npm package ([0c1860b](https://github.com/niieani/condu/commit/0c1860bc4ccc11d89fce8c938f9d5e70d88a9c98))
* refactor package loading ([4c736a8](https://github.com/niieani/condu/commit/4c736a83077e0294a7854c8a2b9c95a5878149f3))
* support release to NPM ([4401bfe](https://github.com/niieani/condu/commit/4401bfe7a457ea3fb516d0165b89652aa3ef5200))


### Bug Fixes

* add "access: public" ([a15f582](https://github.com/niieani/condu/commit/a15f5827715367a3cdd2d39edbb7c63af7b2f9a8))
* add package list to manifest ([ca51a28](https://github.com/niieani/condu/commit/ca51a28d9a1f4bda1ca1dd929a7d22bdae09d5f3))
* correct prettier config ([9989094](https://github.com/niieani/condu/commit/99890941f5cd389caaa7f2ca65ae866ac81750cf))
* correct yarn gitignores ([e79db54](https://github.com/niieani/condu/commit/e79db54e78a41157ae90a2f6e5ac648fda602c27))
* default to 'origin' remote ([d9c37db](https://github.com/niieani/condu/commit/d9c37db0269be4e2f93d545da613a738cacc6f2e))
* extract core functionality to 'condu' package ([e2a5e53](https://github.com/niieani/condu/commit/e2a5e539f7aeaadedd3359d8bf80591f3e4ee258))
* improve exec internals ([0eaaf64](https://github.com/niieani/condu/commit/0eaaf64d2b4bae69bd78d47a08cee1525bdc40e2))
* improve support for various package managers ([acfe5d1](https://github.com/niieani/condu/commit/acfe5d1469145e27084a75dbb01ac3c9c053c4dc))
* package updates and eslint fixes ([0ed7c63](https://github.com/niieani/condu/commit/0ed7c63c75992a8952c84d6d79280f3ca3bf4225))
* rename workspace name to allow for 'condu' package creation ([5b4dbfe](https://github.com/niieani/condu/commit/5b4dbfe0912ad8d64a227b875d34c39ae5d50959))
* small improvements to release ([f8a0293](https://github.com/niieani/condu/commit/f8a029366cb6d5a162c50e6c29b6c2c871c01576))
* use findUp to find .git folder ([27fbb75](https://github.com/niieani/condu/commit/27fbb75c90e71e33286d331eb39a17c9b6aefe3f))
* various small fixes ([c8fbadf](https://github.com/niieani/condu/commit/c8fbadf0f538086dca5d8d4093c274128c793743))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/types bumped to 0.1.4
    * @condu/workspace-utils bumped to 0.1.5

## [0.1.3](https://github.com/niieani/condu/compare/@condu/core@0.1.2...@condu/core@0.1.3) (2024-08-03)


### Features

* initial support for single-repo configuration ([08402b2](https://github.com/niieani/condu/commit/08402b263ca671c05a0d3085a4801baa172910d0))


### Bug Fixes

* improve exec internals ([0eaaf64](https://github.com/niieani/condu/commit/0eaaf64d2b4bae69bd78d47a08cee1525bdc40e2))
* improve support for various package managers ([acfe5d1](https://github.com/niieani/condu/commit/acfe5d1469145e27084a75dbb01ac3c9c053c4dc))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/types bumped to 0.1.3
    * @condu/workspace-utils bumped to 0.1.4

## [0.1.2](https://github.com/niieani/toolchain/compare/@condu/core@0.1.1...@condu/core@0.1.2) (2024-07-25)


### Features

* add sync version of findUp ([a03b63e](https://github.com/niieani/toolchain/commit/a03b63ecd905b4b0df5f1f3bf570435c70bcd905))
* enable linking other monorepos ([e707687](https://github.com/niieani/toolchain/commit/e707687bd2d5e109bb6d9eb96a9b777eb85e9737))


### Bug Fixes

* use findUp to find .git folder ([27fbb75](https://github.com/niieani/toolchain/commit/27fbb75c90e71e33286d331eb39a17c9b6aefe3f))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/types bumped to 0.1.2
    * @condu/workspace-utils bumped to 0.1.3

## [0.1.1](https://github.com/niieani/toolchain/compare/@condu/core@0.1.0...@condu/core@0.1.1) (2024-07-08)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/types bumped to 0.1.1

## [0.1.0](https://github.com/niieani/toolchain/compare/@condu/core@0.0.1...@condu/core@0.1.0) (2024-07-08)


### Features

* correctly resolve package versions before publishing ([ac37454](https://github.com/niieani/toolchain/commit/ac374544ecb35ad3c3f27a830f24276928168306))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/types bumped to 0.1.0

## 0.0.1 (2024-07-07)


### Features

* add options to `writeProjectManifest` ([386ee2b](https://github.com/niieani/toolchain/commit/386ee2b646b95042213566217efcd858dae64d6d))
* add release-please publish actions ([a96c313](https://github.com/niieani/toolchain/commit/a96c313d600bf17caad0be7261e54018af9ab4e1))
* fix read-write and add dummy package for release ([56a0296](https://github.com/niieani/toolchain/commit/56a0296df80933c6a908d78e1f30318a9c46e0f1))
* package cli as 'condu' npm package ([0c1860b](https://github.com/niieani/toolchain/commit/0c1860bc4ccc11d89fce8c938f9d5e70d88a9c98))
* refactor package loading ([4c736a8](https://github.com/niieani/toolchain/commit/4c736a83077e0294a7854c8a2b9c95a5878149f3))
* support release to NPM ([4401bfe](https://github.com/niieani/toolchain/commit/4401bfe7a457ea3fb516d0165b89652aa3ef5200))


### Bug Fixes

* add "access: public" ([a15f582](https://github.com/niieani/toolchain/commit/a15f5827715367a3cdd2d39edbb7c63af7b2f9a8))
* add package list to manifest ([ca51a28](https://github.com/niieani/toolchain/commit/ca51a28d9a1f4bda1ca1dd929a7d22bdae09d5f3))
* correct yarn gitignores ([e79db54](https://github.com/niieani/toolchain/commit/e79db54e78a41157ae90a2f6e5ac648fda602c27))
* extract core functionality to 'condu' package ([e2a5e53](https://github.com/niieani/toolchain/commit/e2a5e539f7aeaadedd3359d8bf80591f3e4ee258))
* rename workspace name to allow for 'condu' package creation ([5b4dbfe](https://github.com/niieani/toolchain/commit/5b4dbfe0912ad8d64a227b875d34c39ae5d50959))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @condu/types bumped to 0.0.1
