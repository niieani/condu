function readPackage(pkg, context) {
  if (pkg.name.startsWith('@condu/') || pkg.name.startsWith('@condu-feature/')) {
    context.log("Nuking peerDependencies")
    if (pkg.peerDependencies?.['@condu/core']) {
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
