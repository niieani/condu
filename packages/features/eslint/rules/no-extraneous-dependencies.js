/* eslint-disable unicorn/no-null */
import path from "node:path";
import fs from "node:fs";
import { minimatch } from "minimatch";
import pkgUpModule from "eslint-module-utils/pkgUp";
import resolveModule from "eslint-module-utils/resolve";
import moduleVisitorModule from "eslint-module-utils/moduleVisitor";
import { importType } from "eslint-plugin-import-x/utils/import-type.js";
import { getFilePackageName } from "eslint-plugin-import-x/utils/package-path.js";
import { docsUrl } from "eslint-plugin-import-x/utils/docs-url.js";
const { default: moduleVisitor } = moduleVisitorModule;
const { default: pkgUp } = pkgUpModule;
const { default: resolve } = resolveModule;

// const path = require("path");
// const fs = require("fs");
// const pkgUp = require("eslint-module-utils/pkgUp").default;
// const minimatch = require("minimatch");
// const resolve = require("eslint-module-utils/resolve").default;
// const moduleVisitor = require("eslint-module-utils/moduleVisitor").default;
// const { importType } = require("eslint-plugin-import-x/utils/import-type.js");
// const {
//   getFilePackageName,
// } = require("eslint-plugin-import-x/utils/package-path.js");
// const { docsUrl } = require("eslint-plugin-import-x/utils/docs-url.js");

// because autofixes are evaluated eagerly, it's not possible to do this correctly using eslint
// this is a nasty hack that depends on the fact that eslint's SourceCodeFixer passes the text as is
// the code hasn't changed for the past 5 years, so it should be safe for the time being
// there's a call to startsWith(BOM) on the autofix text, which we can use to trigger the autofix
// see https://github.com/eslint/eslint/blob/13d0bd371eb8eb4aa1601c8727212a62ab923d0e/lib/linter/source-code-fixer.js#L98

// TODO: we could try to create a typescript language service plugin that does this,
// and make it into a TS autofix instead

class LazyAutofix extends String {
  applied = false;
  constructor(autofixFn, fixer) {
    super("");
    this.autofixFn = autofixFn;
    this.fixer = fixer;
  }
  startsWith() {
    if (!this.applied) {
      this.autofixFn(this.fixer);
      this.applied = true;
    }
    return false;
  }
  valueOf() {
    return "";
  }
}

const makeLazyAutofix = (autofixFn) => (fixer) => ({
  range: [0, 0],
  text: new LazyAutofix(autofixFn, fixer),
});

const batchSaveMap = new Map();
let batchTimeout = null;
const writeJSONLater = (jsonPath, content) => {
  batchSaveMap.set(jsonPath, content);
  if (batchTimeout) {
    clearTimeout(batchTimeout);
  }
  batchTimeout = setTimeout(() => {
    for (const [jsonPath, content] of batchSaveMap.entries()) {
      fs.writeFile(jsonPath, JSON.stringify(content, null, 2) + "\n", () => {
        batchSaveMap.delete(jsonPath);
      });
    }
    batchTimeout = null;
  }, 50);
};

const allowedSemVerPrefixes = ["", "=", "^", "~", ">=", "<=", "*"];
const dependencyJsonCache = new Map();
const depFieldCache = new Map();

function arrayOrKeys(arrayOrObject) {
  return Array.isArray(arrayOrObject)
    ? arrayOrObject
    : Object.keys(arrayOrObject);
}

function readJSON(jsonPath, throwException, useCache) {
  if (useCache && batchSaveMap.has(jsonPath)) return batchSaveMap.get(jsonPath);
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (err) {
    if (throwException) {
      throw err;
    }
  }
}

function extractDepFields(pkg) {
  return {
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    optionalDependencies: pkg.optionalDependencies || {},
    peerDependencies: pkg.peerDependencies || {},
    // BundledDeps should be in the form of an array, but object notation is also supported by
    // `npm`, so we convert it to an array if it is an object
    bundledDependencies: arrayOrKeys(
      pkg.bundleDependencies || pkg.bundledDependencies || [],
    ),
  };
}

function getPackageDepFields(packageJsonPath, throwAtRead) {
  if (!depFieldCache.has(packageJsonPath)) {
    const depFields = extractDepFields(readJSON(packageJsonPath, throwAtRead));
    depFieldCache.set(packageJsonPath, depFields);
  }

  return depFieldCache.get(packageJsonPath);
}

function getDependencies(context, packageDir) {
  let paths = [];
  let sourcePath = null;
  const packageContent = {
    dependencies: {},
    devDependencies: {},
    optionalDependencies: {},
    peerDependencies: {},
    bundledDependencies: [],
  };

  try {
    if (packageDir && packageDir.length > 0) {
      if (!Array.isArray(packageDir)) {
        paths = [path.resolve(packageDir)];
      } else {
        paths = packageDir.map((dir) => path.resolve(dir));
      }
    }

    if (paths.length > 0) {
      // use rule config to find package.json
      for (const dir of paths) {
        const packageJsonPath = path.join(dir, "package.json");
        const _packageContent = getPackageDepFields(packageJsonPath, true);
        Object.assign(
          packageContent.dependencies,
          _packageContent.dependencies,
        );
        Object.assign(
          packageContent.devDependencies,
          _packageContent.devDependencies,
        );
        Object.assign(
          packageContent.optionalDependencies,
          _packageContent.optionalDependencies,
        );
        Object.assign(
          packageContent.peerDependencies,
          _packageContent.peerDependencies,
        );
        packageContent.bundledDependencies.push(
          ..._packageContent.bundledDependencies,
        );
        sourcePath = packageJsonPath;
      }
      if (paths.length > 1) {
        // multiple package.json found, reset sourcePath to null
        sourcePath = null;
      }
    } else {
      const packageJsonPath = pkgUp({
        cwd:
          context.physicalFilename ??
          context.filename ??
          // deprecated:
          (context.getPhysicalFilename
            ? context.getPhysicalFilename()
            : context.getFilename()),
        normalize: false,
      });

      // use closest package.json
      Object.assign(
        packageContent,
        getPackageDepFields(packageJsonPath, false),
      );

      sourcePath = packageJsonPath;
    }

    return { packageContent, sourcePath };
  } catch (e) {
    if (paths.length > 0 && e.code === "ENOENT") {
      context.report({
        message: "The package.json file could not be found.",
        loc: { line: 0, column: 0 },
      });
    }
    if (e.name === "JSONError" || e instanceof SyntaxError) {
      context.report({
        message: `The package.json file could not be parsed: ${e.message}`,
        loc: { line: 0, column: 0 },
      });
    }

    return { packageContent: extractDepFields({}), sourcePath: null };
  }
}

function missingErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's dependencies. Run 'npm i -S ${packageName}' to add it`;
}

function devDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's dependencies, not devDependencies.`;
}

function optDepErrorMessage(packageName) {
  return `'${packageName}' should be listed in the project's dependencies, not optionalDependencies.`;
}

function getModuleOriginalName(name) {
  const [first, second] = name.split("/");
  return first.startsWith("@") ? `${first}/${second}` : first;
}

function getModuleRealName(resolved) {
  return getFilePackageName(resolved);
}

function checkDependencyDeclaration(deps, packageName, declarationStatus) {
  const newDeclarationStatus = declarationStatus || {
    isInDeps: false,
    isInDevDeps: false,
    isInOptDeps: false,
    isInPeerDeps: false,
    isInBundledDeps: false,
  };

  // in case of sub package.json inside a module
  // check the dependencies on all hierarchy
  const packageHierarchy = [];
  const packageNameParts = packageName ? packageName.split("/") : [];
  for (const [index, namePart] of packageNameParts.entries()) {
    if (!namePart.startsWith("@")) {
      const ancestor = packageNameParts.slice(0, index + 1).join("/");
      packageHierarchy.push(ancestor);
    }
  }

  return packageHierarchy.reduce(
    (result, ancestorName) => ({
      isInDeps:
        result.isInDeps || deps.dependencies[ancestorName] !== undefined,
      isInDevDeps:
        result.isInDevDeps || deps.devDependencies[ancestorName] !== undefined,
      isInOptDeps:
        result.isInOptDeps ||
        deps.optionalDependencies[ancestorName] !== undefined,
      isInPeerDeps:
        result.isInPeerDeps ||
        deps.peerDependencies[ancestorName] !== undefined,
      isInBundledDeps:
        result.isInBundledDeps ||
        deps.bundledDependencies.indexOf(ancestorName) !== -1,
    }),
    newDeclarationStatus,
  );
}

function reportIfMissing(
  /** @type {import('eslint').Rule.RuleContext} */ context,
  { packageContent: deps, sourcePath },
  depsOptions,
  node,
  name,
) {
  // Do not report when importing types unless option is enabled
  if (
    !depsOptions.verifyTypeImports &&
    (node.importKind === "type" ||
      node.importKind === "typeof" ||
      (Array.isArray(node.specifiers) &&
        node.specifiers.length &&
        node.specifiers.every(
          (specifier) =>
            specifier.importKind === "type" ||
            specifier.importKind === "typeof",
        )))
  ) {
    return;
  }

  const typeOfImport = importType(name, context);

  if (
    typeOfImport !== "external" &&
    (typeOfImport !== "internal" || !depsOptions.verifyInternalDeps)
  ) {
    return;
  }

  const resolved = resolve(name, context);
  if (!resolved) {
    return;
  }

  const importPackageName = getModuleOriginalName(name);
  let declarationStatus = checkDependencyDeclaration(deps, importPackageName);

  if (
    declarationStatus.isInDeps ||
    (depsOptions.allowDevDeps && declarationStatus.isInDevDeps) ||
    (depsOptions.allowPeerDeps && declarationStatus.isInPeerDeps) ||
    (depsOptions.allowOptDeps && declarationStatus.isInOptDeps) ||
    (depsOptions.allowBundledDeps && declarationStatus.isInBundledDeps)
  ) {
    return;
  }

  // test the real name from the resolved package.json
  // if not aliased imports (alias/react for example), importPackageName can be misinterpreted
  const realPackageName = getModuleRealName(resolved);
  if (realPackageName && realPackageName !== importPackageName) {
    declarationStatus = checkDependencyDeclaration(
      deps,
      realPackageName,
      declarationStatus,
    );

    if (
      declarationStatus.isInDeps ||
      (depsOptions.allowDevDeps && declarationStatus.isInDevDeps) ||
      (depsOptions.allowPeerDeps && declarationStatus.isInPeerDeps) ||
      (depsOptions.allowOptDeps && declarationStatus.isInOptDeps) ||
      (depsOptions.allowBundledDeps && declarationStatus.isInBundledDeps)
    ) {
      return;
    }
  }

  if (declarationStatus.isInDevDeps && !depsOptions.allowDevDeps) {
    context.report(
      node,
      devDepErrorMessage(realPackageName || importPackageName),
    );
    return;
  }

  if (declarationStatus.isInOptDeps && !depsOptions.allowOptDeps) {
    context.report(
      node,
      optDepErrorMessage(realPackageName || importPackageName),
    );
    return;
  }
  const pkgName = realPackageName || importPackageName;
  const [, autoFixVersionOrPrefix] = depsOptions.autoFixVersionMapping?.find(
    ([nameOrScope]) => {
      return pkgName === nameOrScope || matchWildcard(nameOrScope, pkgName);
    },
  ) ?? [undefined, depsOptions.autoFixFallback];

  // TODO: add support for @types - should check both the type and the real package
  const canAutofix =
    autoFixVersionOrPrefix &&
    (!realPackageName || realPackageName === importPackageName) &&
    sourcePath;

  context.report({
    node,
    message: missingErrorMessage(pkgName),
    fix: canAutofix
      ? makeLazyAutofix(() => {
          const importedPackageJsonPath = pkgUp({
            cwd: path.dirname(resolved),
            normalize: false,
          });
          const importedPackageContent =
            dependencyJsonCache.get(importedPackageJsonPath) ??
            readJSON(importedPackageJsonPath, false);

          if (importedPackageContent) {
            dependencyJsonCache.set(
              importedPackageJsonPath,
              importedPackageContent,
            );
          } else if (
            !importedPackageContent.name ||
            importedPackageContent.name !== pkgName
          ) {
            // cannot autofix, we likely resolved to a @types definition or an aliased package
            return;
          }

          // guard against the case the package.json does not have a version specified:
          const resolvedVersion = importedPackageContent.version ?? "*";
          const version =
            autoFixVersionOrPrefix === "" || autoFixVersionOrPrefix === "="
              ? resolvedVersion
              : autoFixVersionOrPrefix === "*"
                ? "*"
                : allowedSemVerPrefixes.includes(autoFixVersionOrPrefix) &&
                    resolvedVersion !== "*"
                  ? `${autoFixVersionOrPrefix}${resolvedVersion}`
                  : autoFixVersionOrPrefix;

          const packageJson = readJSON(sourcePath, false, true);
          if (!packageJson) {
            return;
          }

          packageJson.dependencies = packageJson.dependencies || {};
          packageJson.dependencies[pkgName] = version;

          // this is crucial, as eslint will re-run the rule after autofixing, causing a loop
          // we can short-circuit this by updating the cache:
          depFieldCache.set(sourcePath, extractDepFields(packageJson));

          writeJSONLater(sourcePath, packageJson);
        })
      : undefined,
  });
}

function testConfig(config, filename) {
  // Simplest configuration first, either a boolean or nothing.
  if (typeof config === "boolean" || config === undefined) {
    return config;
  }
  // Array of globs.
  return config.some(
    (c) =>
      minimatch(filename, c) ||
      minimatch(filename, path.join(process.cwd(), c)),
  );
}

export default {
  meta: {
    type: "problem",
    docs: {
      category: "Helpful warnings",
      description: "Forbid the use of extraneous packages.",
      url: docsUrl("no-extraneous-dependencies"),
    },
    fixable: "code",

    schema: [
      {
        type: "object",
        properties: {
          devDependencies: { type: ["boolean", "array"] },
          optionalDependencies: { type: ["boolean", "array"] },
          peerDependencies: { type: ["boolean", "array"] },
          bundledDependencies: { type: ["boolean", "array"] },
          packageDir: { type: ["string", "array"] },
          includeInternal: { type: ["boolean"] },
          includeTypes: { type: ["boolean"] },
          autoFixVersionMapping: {
            type: ["array"],
            items: {
              type: "array",
              items: [{ type: "string" }, { type: "string" }],
              additionalItems: false,
              maxItems: 2,
              minItems: 2,
            },
          },
          autoFixFallback: { enum: allowedSemVerPrefixes },
        },
        additionalProperties: false,
      },
    ],
  },

  create(context) {
    const options = context.options[0] || {};
    const filename = context.physicalFilename
      ? context.physicalFilename
      : context.filename;
    const depContext = getDependencies(context, options.packageDir);

    const depsOptions = {
      allowDevDeps: testConfig(options.devDependencies, filename) !== false,
      allowOptDeps:
        testConfig(options.optionalDependencies, filename) !== false,
      allowPeerDeps: testConfig(options.peerDependencies, filename) !== false,
      allowBundledDeps:
        testConfig(options.bundledDependencies, filename) !== false,
      verifyInternalDeps: !!options.includeInternal,
      verifyTypeImports: !!options.includeTypes,
      autoFixVersionMapping: options.autoFixVersionMapping,
      autoFixFallback: options.autoFixFallback,
    };

    return moduleVisitor(
      (source, node) => {
        reportIfMissing(context, depContext, depsOptions, node, source.value);
      },
      { commonjs: true },
    );
  },

  "Program:exit"() {
    depFieldCache.clear();
    dependencyJsonCache.clear();
  },
};

// TODO: import { matchWildcard } from "@condu/core/utils/matchWildcard.js";
function matchWildcard(pattern, str) {
  // Escape special characters in pattern and replace '*' with '.*' for regex
  const regexPattern = pattern
    .replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")
    .replace(/\*/g, ".*");

  // Create a regular expression from the pattern
  const regex = new RegExp(`^${regexPattern}$`);

  // Test if the string matches the regular expression
  return regex.test(str);
}
