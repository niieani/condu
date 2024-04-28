function readPackage(pkg, context) {
  if (pkg.name.startsWith('@condu/') || pkg.name.startsWith('@condu-feature/')) {
    if (pkg.peerDependencies?.['@condu/core']) {
      context.log("Nuking peerDependency")
      delete pkg.peerDependencies['@condu/core']
    }
    // pkg.peerDependenciesMeta = {}
    // pkg.peerDependencies = {}
  }
  return pkg
}

module.exports = {
  hooks: {
    readPackage
  }
}
