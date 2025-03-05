// based on https://github.com/un-ts/eslint-plugin-import-x/blob/0bac033b5ff15f46cfb98760be24b3f33436e4a7/src/rules/no-extraneous-dependencies.ts
// with the addition of autofixing
import fs from "node:fs";
import path from "node:path";

import type { TSESTree } from "@typescript-eslint/utils";
import { minimatch } from "minimatch";

import type { RuleContext } from "eslint-plugin-import-x/types.js";
import {
  createRule,
  moduleVisitor,
  resolve,
  pkgUp,
  importType,
  getFilePackageName,
} from "eslint-plugin-import-x/utils/index.js";
import {
  type SemVerPrefix,
  makeLazyAutofix,
  dependencyJsonCache,
  writeJSONLater,
  batchSaveMap,
  allowedSemVerPrefixes,
  wildcardToRegExp,
} from "./utils.js";
import type { PackageJson } from "@condu/schema-types/schemas/packageJson.gen.js";
import type { Rule } from "eslint";

type PackageDeps = ReturnType<typeof extractDepFields>;

const depFieldCache = new Map<string, PackageDeps>();

function hasKeys(obj: object = {}) {
  return Object.keys(obj).length > 0;
}

function arrayOrKeys(arrayOrObject: object | string[]) {
  return Array.isArray(arrayOrObject)
    ? (arrayOrObject as string[])
    : Object.keys(arrayOrObject);
}

function readJSON<T>(
  jsonPath: string,
  throwException: boolean,
  useCache: boolean = false,
) {
  if (useCache && batchSaveMap.has(jsonPath))
    return batchSaveMap.get(jsonPath) as T;
  try {
    return JSON.parse(fs.readFileSync(jsonPath, "utf8")) as T;
  } catch (error) {
    if (throwException) {
      throw error;
    }
  }
  return undefined;
}

function extractDepFields(pkg: PackageJson) {
  return {
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    optionalDependencies: pkg.optionalDependencies || {},
    peerDependencies: pkg.peerDependencies || {},
    // BundledDeps should be in the form of an array, but object notation is also supported by
    // `npm`, so we convert it to an array if it is an object
    bundledDependencies: arrayOrKeys(
      Array.isArray(pkg.bundleDependencies)
        ? pkg.bundleDependencies
        : Array.isArray(pkg.bundledDependencies)
          ? pkg.bundledDependencies
          : [],
    ),
  };
}

function getPackageDepFields(packageJsonPath: string, throwAtRead: boolean) {
  if (!depFieldCache.has(packageJsonPath)) {
    const packageJson = readJSON<PackageJson>(packageJsonPath, throwAtRead);
    if (packageJson) {
      const depFields = extractDepFields(packageJson);
      depFieldCache.set(packageJsonPath, depFields);
    }
  }
  return depFieldCache.get(packageJsonPath);
}

function getDependencies(context: RuleContext, packageDir?: string | string[]) {
  let paths: string[] = [];
  let sourcePath: string | undefined = undefined;

  try {
    let packageContent: PackageDeps = {
      dependencies: {},
      devDependencies: {},
      optionalDependencies: {},
      peerDependencies: {},
      bundledDependencies: [],
    };

    if (packageDir && packageDir.length > 0) {
      paths = Array.isArray(packageDir)
        ? packageDir.map((dir) => path.resolve(dir))
        : [path.resolve(packageDir)];
    }

    if (paths.length > 0) {
      // use rule config to find package.json
      for (const dir of paths) {
        const packageJsonPath = path.resolve(dir, "package.json");
        const packageContent_ = getPackageDepFields(
          packageJsonPath,
          paths.length === 1,
        );
        if (packageContent_) {
          for (const depsKey of Object.keys(packageContent)) {
            const key = depsKey as keyof PackageDeps;
            Object.assign(packageContent[key], packageContent_[key]);
          }
        }
        if (paths.length === 1) {
          sourcePath = packageJsonPath;
        }
      }
    } else {
      // use closest package.json
      const packageJsonPath = pkgUp({
        cwd: context.physicalFilename,
      })!;

      const packageContent_ = getPackageDepFields(packageJsonPath, false);

      if (packageContent_) {
        packageContent = packageContent_;
      }

      sourcePath = packageJsonPath;
    }

    if (
      ![
        packageContent.dependencies,
        packageContent.devDependencies,
        packageContent.optionalDependencies,
        packageContent.peerDependencies,
        packageContent.bundledDependencies,
      ].some(hasKeys)
    ) {
      return { packageContent: extractDepFields({}), sourcePath };
    }

    return { packageContent, sourcePath };
  } catch (error_) {
    const error = error_ as Error & { code: string };

    if (paths.length > 0 && error.code === "ENOENT") {
      context.report({
        messageId: "pkgNotFound",
        loc: { line: 0, column: 0 },
      });
    }
    if (error.name === "JSONError" || error instanceof SyntaxError) {
      context.report({
        messageId: "pkgUnparsable",
        data: { error: error.message },
        loc: { line: 0, column: 0 },
      });
    }
  }
  return { packageContent: extractDepFields({}), sourcePath };
}

function getModuleOriginalName(name: string) {
  const [first, second] = name.split("/");
  return first?.startsWith("@") ? `${first}/${second}` : first;
}

type DepDeclaration = {
  isInDeps: boolean;
  isInDevDeps: boolean;
  isInOptDeps: boolean;
  isInPeerDeps: boolean;
  isInBundledDeps: boolean;
};

function checkDependencyDeclaration(
  deps: PackageDeps,
  packageName: string,
  declarationStatus?: DepDeclaration,
) {
  const newDeclarationStatus = declarationStatus || {
    isInDeps: false,
    isInDevDeps: false,
    isInOptDeps: false,
    isInPeerDeps: false,
    isInBundledDeps: false,
  };

  // in case of sub package.json inside a module
  // check the dependencies on all hierarchy
  const packageHierarchy: string[] = [];
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
        deps.bundledDependencies.includes(ancestorName),
    }),
    newDeclarationStatus,
  );
}

type DepsOptions = {
  allowDevDeps: boolean;
  allowOptDeps: boolean;
  allowPeerDeps: boolean;
  allowBundledDeps: boolean;
  verifyInternalDeps: boolean;
  verifyTypeImports: boolean;
  autoFixVersionMapping?: AutoFixSpecTransformed;
  autoFixFallback?: (typeof allowedSemVerPrefixes)[number];
};

function reportIfMissing(
  context: RuleContext<MessageId>,
  {
    packageContent: deps,
    sourcePath,
  }: { packageContent: PackageDeps; sourcePath: string | undefined },
  depsOptions: DepsOptions,
  node: TSESTree.Node | TSESTree.Token,
  name: string,
  whitelist: Set<string> | undefined,
) {
  // Do not report when importing types unless option is enabled
  if (
    !depsOptions.verifyTypeImports &&
    (("importKind" in node &&
      (node.importKind === "type" ||
        // @ts-expect-error - flow type
        node.importKind === "typeof")) ||
      ("exportKind" in node && node.exportKind === "type") ||
      ("specifiers" in node &&
        Array.isArray(node.specifiers) &&
        node.specifiers.length > 0 &&
        (
          node.specifiers as Array<
            TSESTree.ExportSpecifier | TSESTree.ImportClause
          >
        ).every(
          (specifier) =>
            "importKind" in specifier &&
            (specifier.importKind === "type" ||
              // @ts-expect-error - flow type
              specifier.importKind === "typeof"),
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
  if (!importPackageName) {
    return;
  }
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
  const realPackageName = getFilePackageName(resolved);
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

  const packageName = realPackageName || importPackageName;

  if (whitelist?.has(packageName)) {
    return;
  }

  if (declarationStatus.isInDevDeps && !depsOptions.allowDevDeps) {
    context.report({
      node,
      messageId: "devDep",
      data: {
        packageName,
      },
    });
    return;
  }

  if (declarationStatus.isInOptDeps && !depsOptions.allowOptDeps) {
    context.report({
      node,
      messageId: "optDep",
      data: {
        packageName,
      },
    });
    return;
  }

  const pkgName = realPackageName || importPackageName;
  const [, autoFixVersionOrPrefix, target = "dependencies"] =
    depsOptions.autoFixVersionMapping?.find(([nameOrScope]) =>
      nameOrScope instanceof RegExp
        ? nameOrScope.test(pkgName)
        : pkgName === nameOrScope,
    ) ?? [undefined, depsOptions.autoFixFallback];

  // TODO: add support for @types - should check both the type and the real package
  const canAutofix =
    autoFixVersionOrPrefix &&
    (!realPackageName || realPackageName === importPackageName) &&
    sourcePath;

  context.report({
    node,
    messageId: "missing",
    data: {
      packageName,
    },
    fix: canAutofix
      ? makeLazyAutofix(() => {
          const importedPackageJsonPath = pkgUp({
            cwd: path.dirname(resolved),
          });
          if (!importedPackageJsonPath) {
            return;
          }
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

          const packageJson = readJSON<PackageJson>(sourcePath, false, true);
          if (!packageJson) {
            return;
          }

          packageJson[target] ||= {};
          packageJson[target][pkgName] = version;

          // this is crucial, as eslint will re-run the rule after autofixing, causing a loop
          // we can short-circuit this by updating the cache:
          depFieldCache.set(sourcePath, extractDepFields(packageJson));

          writeJSONLater(sourcePath, packageJson);
        })
      : undefined,
  });
}

function testConfig(config: string[] | boolean | undefined, filename: string) {
  // Simplest configuration first, either a boolean or nothing.
  if (typeof config === "boolean" || config === undefined) {
    return config;
  }
  // Array of globs.
  return config.some(
    (c) => minimatch(filename, c) || minimatch(filename, path.resolve(c)),
  );
}

export type AutoFixSpecTransformed = readonly (readonly [
  packageOrWildcard: string | RegExp,
  autoFixVersionOrPrefix: string,
  target?: "dependencies" | "devDependencies" | "peerDependencies",
])[];

export type AutoFixSpec = readonly (readonly [
  packageOrWildcard: string,
  autoFixVersionOrPrefix: string,
  target?: "dependencies" | "devDependencies" | "peerDependencies",
])[];

export type Options = {
  packageDir?: string | string[];
  devDependencies?: boolean | string[];
  optionalDependencies?: boolean | string[];
  peerDependencies?: boolean | string[];
  bundledDependencies?: boolean | string[];
  includeInternal?: boolean;
  includeTypes?: boolean;
  whitelist?: string[];
  autoFixVersionMapping?: AutoFixSpec;
  autoFixFallback?: SemVerPrefix;
};

type MessageId =
  | "pkgNotFound"
  | "pkgUnparsable"
  | "devDep"
  | "optDep"
  | "missing";

const rule = createRule<[Options?], MessageId>({
  name: "no-extraneous-dependencies",
  meta: {
    type: "problem",
    docs: {
      category: "Helpful warnings",
      description: "Forbid the use of extraneous packages.",
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
          whitelist: { type: ["array"] },
          autoFixVersionMapping: {
            type: "array",
            items: {
              type: "array",
              items: [
                { type: "string" },
                { type: "string" },
                {
                  type: ["string"],
                  enum: ["dependencies", "devDependencies", "peerDependencies"],
                },
              ],
              additionalItems: false,
              maxItems: 3,
              minItems: 2,
            },
          },
          autoFixFallback: { enum: allowedSemVerPrefixes, type: ["string"] },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      pkgNotFound: "The package.json file could not be found.",
      pkgUnparsable: "The package.json file could not be parsed: {{error}}",
      devDep:
        "'{{packageName}}' should be listed in the project's dependencies, not devDependencies.",
      optDep:
        "'{{packageName}}' should be listed in the project's dependencies, not optionalDependencies.",
      missing:
        "'{{packageName}}' should be listed in the project's dependencies. Run 'npm i -S {{packageName}}' to add it",
    },
  },
  defaultOptions: [],
  create(context) {
    const options = context.options[0] || {};

    const filename = context.physicalFilename;

    const depContext = getDependencies(context, options.packageDir);

    const depsOptions: DepsOptions = {
      allowDevDeps: testConfig(options.devDependencies, filename) !== false,
      allowOptDeps:
        testConfig(options.optionalDependencies, filename) !== false,
      allowPeerDeps: testConfig(options.peerDependencies, filename) !== false,
      allowBundledDeps:
        testConfig(options.bundledDependencies, filename) !== false,
      verifyInternalDeps: !!options.includeInternal,
      verifyTypeImports: !!options.includeTypes,
      autoFixVersionMapping: options.autoFixVersionMapping?.map(
        ([packageOrWildcard, ...tuple]) => [
          packageOrWildcard.length > 1 && packageOrWildcard.includes("*")
            ? wildcardToRegExp(packageOrWildcard)
            : packageOrWildcard,
          ...tuple,
        ],
      ),
      autoFixFallback: options.autoFixFallback,
    };

    return {
      ...moduleVisitor(
        (source, node) => {
          reportIfMissing(
            context,
            depContext,
            depsOptions,
            node,
            source.value,
            options.whitelist ? new Set(options.whitelist) : undefined,
          );
        },
        { commonjs: true },
      ),
      "Program:exit"() {
        depFieldCache.clear();
        dependencyJsonCache.clear();
      },
    };
  },
});

// @ts-expect-error types from ESLint are for ESLint 9 vs @typescript-eslint/utils is for ESLint 8
export default rule as Rule.RuleModule;
