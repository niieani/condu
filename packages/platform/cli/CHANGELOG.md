# Changelog

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
