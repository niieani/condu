MVP

- [x] moonrepo integration
- [x] typescript
- [x] typescript references
- [ ] scaffolding new packages in monorepo (Create package command)
- [ ] TS building for release
- [ ] semantic-release (use [Auto](https://github.com/intuit/auto) instead for mono-repo support)
- [ ] GitHub Actions
- [ ] CI build and test using moon

- shippable state -

Later:

- [ ] Eslint
- [ ] Vitest / jest
- [ ] Individual Package overrides
- [ ] Customizable package source directory (so we can skip src in mono repo), when publishing copy src into the publish directory. Hmm will semantic publishing work if we copy sources?
- [ ] State file to track changes made to the repo by the tool, and show diff before applying (for upgrading)
- [ ] Migration tool - should remove files from gitignore from committed files
