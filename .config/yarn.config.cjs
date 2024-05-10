// @ts-check
/** @type {import('@yarnpkg/types')} */
const { defineConfig } = require("@yarnpkg/types");

/**
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Workspace} Workspace
 * @typedef {import('@yarnpkg/types').Yarn.Constraints.Dependency} Dependency
 */

module.exports = defineConfig({
  async constraints({ Yarn }) {
    const workspaces = Yarn.workspaces();
    for (const workspace of workspaces) {
      if (!workspace.ident) continue;
      for (const dep of Yarn.dependencies({
        ident: workspace.ident,
        type: "dependencies",
      })) {
        // console.log(
        //   `would update ${dep.ident}@${dep.range} in ${dep.workspace.ident}`,
        // );
        dep.update(`workspace:^`);
      }
      for (const dep of Yarn.dependencies({
        ident: workspace.ident,
        type: "peerDependencies",
      })) {
        dep.update(`workspace:^`);
      }
    }

    // ensure every workspace has the same version of every dependency:
    ensureDependencies(Yarn.dependencies({ type: "dependencies" }));
    ensureDependencies(Yarn.dependencies({ type: "devDependencies" }));
    ensureDependencies(Yarn.dependencies({ type: "peerDependencies" }));
  },
});

/** @param {Dependency[]} dependencies */
function ensureDependencies(dependencies) {
  const versions = new Map();
  for (const dep of dependencies) {
    if (/^(link|portal|workspace):/.test(dep.range)) {
      continue;
    }
    const version = versions.get(dep.ident);
    if (version) {
      // TODO: perhaps we can allow for wider/compatible ranges?
      // i.e. if all packages satisfy the same range, then it's okay if they differ
      if (dep.range !== "*") {
        dep.update(version);
      }
    } else if (dep.range !== "*") {
      versions.set(dep.ident, dep.range);
    }
  }
}
