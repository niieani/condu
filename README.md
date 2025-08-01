# condu - Configuration as Code

condu is a configuration management tool for JavaScript/TypeScript projects that solves the "config hell" problem by providing a unified approach to manage all project configuration in code.

## Why condu?

Modern JavaScript/TypeScript projects require numerous configuration files:

- tsconfig.json
- eslintrc/eslint.config.js
- .prettierrc
- .editorconfig
- package.json
- .gitignore
- And many more...

These configurations:

- Use different formats (JSON, YAML, JS)
- Are scattered across your project
- Are hard to keep in sync across multiple projects
- Often require changes to multiple files when adding a new tool

condu solves these problems by:

1. Allowing you to define all configuration in TypeScript
2. Providing a system to share and reuse configurations
3. Making it easy to override only what you need
4. Automating updates across your entire codebase

## Getting Started

### Installation

```bash
# Using npm
npm install condu --save-dev

# Using yarn
yarn add condu --dev

# Using pnpm
pnpm add condu -D
```

### Basic Usage

1. Create a `.config/condu.ts` file in your project root:

```typescript
import { configure } from "condu";
import { typescript } from "@condu-feature/typescript";
import { eslint } from "@condu-feature/eslint";
import { prettier } from "@condu-feature/prettier";

export default configure({
  features: [typescript(), eslint(), prettier()],
});
```

2. Run condu to apply your configuration:

```bash
npx condu apply
```

This will generate all the necessary configuration files based on your `.config/condu.ts` file.

## Features

Features are the building blocks of condu. Each feature manages configuration for a specific tool or aspect of your project.

### Core Features

condu comes with many built-in features:

- **typescript**: Manages TypeScript configuration
- **eslint**: Configures ESLint
- **prettier**: Sets up Prettier formatting
- **gitignore**: Creates and manages .gitignore files
- **vscode**: Configures VS Code workspace settings
- **editorconfig**: Sets up EditorConfig
- **pnpm/yarn/npm**: Package manager configuration
- **moon**: Task runner integration
- **vitest**: Testing framework setup
- **release-please**: Release management
- And more...

### Using Features

Each feature can be configured with options:

```typescript
typescript({
  preset: "esm-first",
  tsconfig: {
    compilerOptions: {
      strict: true,
      skipLibCheck: true,
    },
  },
});
```

## Monorepo Support

condu excels at managing monorepo configurations. Define your workspace structure:

```typescript
export default configure({
  projects: [
    {
      parentPath: "packages/features",
      nameConvention: "@myorg/feature-*",
    },
    {
      parentPath: "packages/core",
      nameConvention: "@myorg/*",
    },
  ],
  features: [
    // ...features
  ],
});
```

## Creating Custom Features

You can create custom features to encapsulate your own configuration logic.

A feature's primary purpose is to define a _recipe_ - a list of changes that should be made whenever `condu apply` is run. Think of the calls to condu recipe APIs similar to React component hooks.

### Inline Features (Simplest Approach)

For one-off or simple modifications, you can define features inline directly in your config file:

```typescript
import { configure } from "condu";
import { typescript } from "@condu-feature/typescript";

export default configure({
  features: [
    typescript(),

    // Anonymous arrow function feature
    (condu) => {
      condu.in({ kind: "package" }).modifyPublishedPackageJson((pkg) => ({
        ...pkg,
        // Add sideEffects: false to all packages for better tree-shaking
        sideEffects: false,
      }));
    },

    // Named functions will use their name as the feature name
    function addLicense(condu) {
      condu.root.generateFile("LICENSE", {
        content: `MIT License\n\nCopyright (c) ${new Date().getFullYear()} My Organization\n\n...`,
      });
    },
  ],
});
```

Inline features:

- Are perfect for quick, project-specific configurations
- Don't participate in the PeerContext system
- Are applied in the order they appear in the features array

### Reusable Features with `defineFeature`

For creating proper reusable features, use the `defineFeature` function:

```typescript
import { defineFeature } from "condu";

export const myFeature = (options = {}) =>
  defineFeature("myFeature", {
    // The main recipe that runs during configuration application
    defineRecipe(condu) {
      // Generate a configuration file
      condu.root.generateFile("my-config.json", {
        content: {
          enabled: options.enabled ?? true,
          settings: options.settings ?? {},
        },
        stringify: JSON.stringify,
      });

      // Add required dependencies
      condu.root.ensureDependency("my-library");

      // Target specific packages in a monorepo
      condu.in({ kind: "package" }).modifyPackageJson((pkg) => ({
        ...pkg,
        scripts: {
          ...pkg.scripts,
          "my-script": "my-command",
        },
      }));
    },
  });
```

### Using PeerContext for Feature Coordination

When you want features to influence each other, use the PeerContext system.
For example, the TypeScript feature could automatically enable TypeScript-specific ESLint rules as in the example below:

```typescript
// ESLint feature definition
declare module "condu" {
  interface PeerContext {
    eslint: {
      rules: Record<string, unknown>;
      plugins: string[];
      extends: string[];
    };
  }
}

export const eslint = (options = {}) =>
  defineFeature("eslint", {
    initialPeerContext: {
      rules: {
        "no-unused-vars": "error",
      },
      plugins: [],
      extends: ["eslint:recommended"],
    },

    defineRecipe(condu, peerContext) {
      // Generate eslint config using the final peer context
      // which may have been modified by other features
      condu.root.generateFile(".eslintrc.js", {
        content: `module.exports = {
          extends: ${JSON.stringify(peerContext.extends)},
          plugins: ${JSON.stringify(peerContext.plugins)},
          rules: ${JSON.stringify(peerContext.rules, null, 2)}
        }`,
      });

      // Ensure ESLint dependency
      condu.root.ensureDependency("eslint");

      // Ensure any plugins are installed
      for (const plugin of peerContext.plugins) {
        condu.root.ensureDependency(`eslint-plugin-${plugin}`);
      }
    },
  });

// TypeScript feature that influences ESLint
export const typescript = (options = {}) =>
  defineFeature("typescript", {
    initialPeerContext: {
      // TypeScript-specific context
      config: {
        strict: true,
        // ...other TypeScript options
      },
    },

    // Here TypeScript feature modifies ESLint's context
    modifyPeerContexts: (project, initialContext) => ({
      eslint: (current) => ({
        ...current,
        // Add TypeScript ESLint plugin
        plugins: [...current.plugins, "typescript"],
        // Add TypeScript ESLint config
        extends: [...current.extends, "plugin:@typescript-eslint/recommended"],
        // Add/modify TypeScript-specific rules
        rules: {
          ...current.rules,
          "@typescript-eslint/no-explicit-any": "error",
          "@typescript-eslint/explicit-function-return-type": "warn",
          // Disable the base ESLint rule in favor of TypeScript-specific one
          "no-unused-vars": "off",
          "@typescript-eslint/no-unused-vars": "error",
        },
      }),
    }),

    defineRecipe(condu, peerContext) {
      // Generate tsconfig.json
      condu.root.generateFile("tsconfig.json", {
        content: {
          compilerOptions: peerContext.config,
        },
        stringify: (obj) => JSON.stringify(obj, null, 2),
      });

      // Ensure TypeScript dependencies
      condu.root.ensureDependency("typescript");

      // Also add TypeScript ESLint dependencies if ESLint is used
      if (condu.project.hasFeature("eslint")) {
        condu.root.ensureDependency("@typescript-eslint/parser");
        condu.root.ensureDependency("@typescript-eslint/eslint-plugin");
      }
    },
  });
```

With this setup:

1. The ESLint feature defines its initial rules and plugin configuration
2. The TypeScript feature enhances ESLint configuration with TypeScript-specific rules
3. When both features are used together, you automatically get TypeScript-aware linting

### Advanced Usage: `defineGarnish` for Post-Processing

For final adjustments after all features have run their main recipes, use `defineGarnish`:

```typescript
import { defineFeature } from "condu";

export const packageScripts = () =>
  defineFeature("packageScripts", {
    // Standard recipe for basic setup
    defineRecipe(condu) {
      // Basic script setup
      condu.root.modifyPackageJson((pkg) => ({
        ...pkg,
        scripts: {
          ...pkg.scripts,
          start: "node index.js",
        },
      }));
    },

    // Garnish runs after all other features have applied their recipes
    defineGarnish(condu) {
      // Access the complete state after all features have run
      const allTasks = condu.globalRegistry.tasks;

      // Generate scripts based on tasks defined by other features
      condu.root.modifyPackageJson((pkg) => {
        const scripts = { ...pkg.scripts };

        // Create aggregate scripts based on task types
        const buildTasks = allTasks.filter(
          (task) => task.taskDefinition.type === "build",
        );

        if (buildTasks.length > 0) {
          scripts["build:all"] = buildTasks
            .map((t) => `npm run build:${t.taskDefinition.name}`)
            .join(" && ");

          // Add individual build scripts for each task
          for (const task of buildTasks) {
            scripts[`build:${task.taskDefinition.name}`] =
              task.taskDefinition.command;
          }
        }

        // Create test scripts for all test tasks
        const testTasks = allTasks.filter(
          (task) => task.taskDefinition.type === "test",
        );

        if (testTasks.length > 0) {
          scripts["test:all"] = testTasks
            .map((t) => `npm run test:${t.taskDefinition.name}`)
            .join(" && ");
        }

        return { ...pkg, scripts };
      });
    },
  });
```

The `defineGarnish` function:

- Runs after all features have completed their main recipes
- Has access to `globalRegistry` with information about all tasks, dependencies, and files
- Is perfect for generating aggregate configurations or scripts that depend on what other features defined
- Enables post-processing of files or configurations

## API Reference

### `condu` object

The main `condu` object available in feature recipes contains the following:

- `condu.project`: Information about the project
- `condu.root`: Recipe API for the root package
- `condu.in(criteria)`: Recipe API for the packages matching the criteria

Additionally, when used in `defineGarnish`:

- `condu.globalRegistry`: Contains the summary of all the recipes, including:
  - which files were modified
  - what tasks were registered

### Recipe API

Methods for declaring configuration changes:

#### generateFile

Creates files that are fully managed by condu.

```typescript
generateFile<PathT extends string>(path: PathT, options: GenerateFileOptionsForPath<PathT>): ScopedRecipeApi
```

- **Purpose**: Generate new files that are completely managed by condu
- **Features**:
  - Type-safe content generation
  - Custom serialization support
  - File attributes for special handling (e.g., gitignore)

**Examples**:

```typescript
// Generate a standard JSON configuration file
condu.root.generateFile("tsconfig.json", {
  content: {
    compilerOptions: {
      strict: true,
      target: "ES2020",
    },
    include: ["**/*.ts"],
  },
  // Automatically stringify JSON with formatting
  stringify: (obj) => JSON.stringify(obj, null, 2),
});

// Generate a YAML file
condu.root.generateFile("pnpm-workspace.yaml", {
  content: {
    packages: ["packages/*"],
  },
  // Use a custom YAML stringifier
  stringify: getYamlStringify(),
  // Set file attributes for special handling
  attributes: {
    gitignore: false, // Don't add to .gitignore
  },
});

// Generate a text file with raw content
condu.root.generateFile(".gitignore", {
  content: ["node_modules", "build", ".DS_Store", "*.log"].join("\n"),
  // No stringification needed for plain text
});
```

#### modifyGeneratedFile

Modifies a file that was previously generated by condu.

```typescript
modifyGeneratedFile<PathT extends string>(path: PathT, options: ModifyGeneratedFileOptions<ResolvedSerializedType<PathT>>): ScopedRecipeApi
```

- **Purpose**: Update or extend files already managed by condu
- **Features**:
  - Access to current content
  - Preserves format of the file
  - Can be used to add or modify portions of existing files in a typesafe way
  - Can be used without providing a parse/stringify, as it uses the one provided by the feature

**Examples**:

```typescript
// Modify an existing tsconfig.json
condu.root.modifyGeneratedFile("tsconfig.json", {
  content: ({ content = {} }) => ({
    ...content,
    compilerOptions: {
      ...content.compilerOptions,
      // Add or update specific compiler options
      declaration: true,
      sourceMap: true,
    },
  }),
});
```

#### modifyUserEditableFile

Modifies files that should remain editable by users.

```typescript
modifyUserEditableFile<PathT extends string, DeserializedT = ...>(path: PathT, options: ModifyUserEditableFileOptions<DeserializedT>): ScopedRecipeApi
```

- **Purpose**: Update portions of user-editable files while preserving other user changes
- **Features**:
  - Custom parsing and stringification for different formats
  - Can create the file if it doesn't exist with `ifNotExists: "create"`
  - Preserves content not explicitly modified by condu

**Examples**:

```typescript
// Modify a JSON file with type safety
condu.root.modifyUserEditableFile(".vscode/settings.json", {
  // Get default JSON parsers and stringifiers
  ...getJsonParseAndStringify<MySettingsType>(),
  // Create the file if it doesn't exist (that's the default)
  ifNotExists: "create", // other options: "ignore" | "error"
  // Modify or provide content
  content: ({ content = {} }) => ({
    ...content,
    // Add or update specific settings while preserving others
    "typescript.tsdk": "node_modules/typescript/lib",
    "editor.formatOnSave": true,
  }),
});

// Modify a custom format file
condu.root.modifyUserEditableFile(".npmrc", {
  // Custom parser for the specific file format
  parse: (rawContent) => customParse(rawContent),
  // Custom stringifier for the specific file format
  stringify: (data) => customStringify(data),
  // Merge content
  content: ({ content = {} }) => ({
    ...content,
    "my-setting": "value",
  }),
  // Set file attributes (e.g., for .gitignore)
  attributes: { gitignore: false },
});
```

#### ensureDependency

Ensures a dependency is installed in the package.

```typescript
ensureDependency(name: string, dependency?: DependencyDefinitionInput): ScopedRecipeApi
```

- **Purpose**: Manage dependencies in package.json
- **Features**:
  - Installation target customization (dev, peer, regular)
  - Version specification
  - Support for aliased packages
  - Ability to mark as "built" for pnpm's `onlyBuiltDependencies`

**Examples**:

```typescript
// Add a simple dev dependency with default settings
condu.root.ensureDependency("typescript");

// Add a dependency with specific options
condu.root.ensureDependency("react", {
  // Specify which dependency list to use
  list: "dependencies",
  // Specify exact version
  version: "18.2.0",
  // Use a custom name for the dependency
  installAsAlias: "react-aliased",
  // Specify how versioning is managed
  managed: "version", // or "presence" to preserve existing versions
});

// Add peer dependencies
condu.root.ensureDependency("react-dom", {
  list: "peerDependencies",
  // Use semver range prefix
  rangePrefix: ">=",
  // Mark as built for pnpm
  built: true,
});
```

#### setDependencyResolutions

Sets dependency resolutions to override specific package versions.

```typescript
setDependencyResolutions(resolutions: Record<string, string>): ScopedRecipeApi
```

- **Purpose**: Override dependency versions for all packages in the workspace
- **Features**:
  - Works with different package managers (npm, yarn, pnpm)
  - Adapts to the correct syntax for each package manager

**Examples**:

```typescript
// Force specific versions of packages
condu.root.setDependencyResolutions({
  lodash: "4.17.21",
  "webpack/tapable": "2.2.1",
  "@types/react": "18.0.0",
});
```

#### modifyPackageJson

Modifies the package.json file with a custom transformer function.

```typescript
modifyPackageJson(modifier: PackageJsonModifier): ScopedRecipeApi
```

- **Purpose**: Make changes to package.json
- **Features**:
  - Full access to the package.json content
  - Type-safe with package.json type definitions
  - Can access the global registry state

**Examples**:

```typescript
// Add custom scripts based on project structure
condu.root.modifyPackageJson((pkg) => ({
  ...pkg,
  scripts: {
    ...pkg.scripts,
    build: "tsc -p tsconfig.json",
    test: "vitest run",
    lint: "eslint .",
  },
  // Add custom metadata
  keywords: [...(pkg.keywords || []), "condu-managed"],
}));

// Add or modify specific fields
condu.in({ kind: "package" }).modifyPackageJson((pkg) => ({
  ...pkg,
  // Add TypeScript configuration
  types: "./build/index.d.ts",
  // Ensure sideEffects flag is set for tree-shaking
  sideEffects: false,
}));
```

#### modifyPublishedPackageJson

Modifies the package.json that will be used during publishing.

```typescript
modifyPublishedPackageJson(modifier: PackageJsonModifier): ScopedRecipeApi
```

- **Purpose**: Configure how the package.json appears when published to registries like npm
- **Features**:
  - Only affects the published version, not the development version
  - Perfect for export maps, types path adjustments, etc.

**Examples**:

```typescript
// Configure exports map for published packages
condu.in({ kind: "package" }).modifyPublishedPackageJson((pkg) => ({
  ...pkg,
  // Add standard entry points
  main: "./build/index.js",
  module: "./build/index.js",
  types: "./build/index.d.ts",
  // Configure exports map
  exports: {
    ".": {
      import: "./build/index.js",
      require: "./build/index.cjs",
      types: "./build/index.d.ts",
    },
    "./package.json": "./package.json",
  },
  // Remove development-only fields
  devDependencies: undefined,
}));
```

#### defineTask

Defines a task that can be run using a task runner.

```typescript
defineTask(name: string, taskDefinition: Omit<Task, "name">): ScopedRecipeApi
```

- **Purpose**: Define tasks for build, test, etc. that can be run by task runners or package scripts
- **Features**:
  - Task type categorization
  - Dependencies between tasks
  - Command definition

**Examples**:

```typescript
// Define a build task
condu.root.defineTask("build", {
  type: "build",
  command: "tsc -p tsconfig.json",
  inputs: ["**/*.ts", "tsconfig.json"],
  outputs: ["build/**"],
});

// Define a test task that depends on the build task
condu.root.defineTask("test", {
  type: "test",
  command: "vitest run",
  deps: ["build"],
});
```

#### ignoreFile

Marks a file to be ignored by certain tools.

```typescript
ignoreFile(path: string, options?: Omit<PartialGlobalFileAttributes, "inAllPackages">): ScopedRecipeApi
```

- **Purpose**: Add files to gitignore or configure other file attributes without generating content
- **Features**:
  - Control file visibility in editors and VCS

**Examples**:

```typescript
// Add a file to .gitignore
condu.root.ignoreFile("build/");

// Configure file attributes
condu.root.ignoreFile("temp/debug.log", {
  gitignore: true,
  vscode: false, // will still be visible in VSCode
});
```

### PeerContext System

The PeerContext system enables features to share information and coordinate with each other:

1. **Declaring Context**: Features declare what data is exposed and modifiable via TypeScript interface augmentation

```typescript
declare module "condu" {
  interface PeerContext {
    myFeature: {
      config: MyConfigType;
    };
  }
}
```

2. **Initializing Context**: Features provide their initial context data

```typescript
initialPeerContext: {
  config: {
    /* initial data */
  }
}
```

3. **Modifying Other Contexts**: Features can modify other features' contexts

```typescript
modifyPeerContexts: (project, initialContext) => ({
  otherFeature: (current) => ({
    ...current,
    someOption: true,
  }),
});
```

4. **Using Context**: Features get the _final_ (merged) context data passed in to their recipes when they are applied

```typescript
defineRecipe(condu, peerContext) {
  // Use peerContext.config
}
```

This system enables powerful coordination between features without tight coupling.

To resolve any type-system issues when building a feature that might influence others, be sure to include the peer features as an optional peerDependency, with a broad version requirement (such as `*` or `>=1.0.0`).

## CLI Reference

Condu provides a comprehensive CLI for managing your projects.

### Core Commands

#### `condu init [project-name]`

Initializes a new condu project in the current directory or creates a new directory with the specified name.

```bash
# Initialize in current directory
condu init

# Create a new project directory
condu init my-new-project
```

Options: None

The init command will:

- Create a `.config` directory with a default `condu.ts` file
- Set up a package.json with the necessary dependencies
- Initialize a git repository if one doesn't exist
- Add a postinstall script that runs `condu apply`

#### `condu apply`

Applies configuration from your `.config/condu.ts` file, generating or updating all configuration files.

```bash
condu apply
```

Options: None

This is the primary command you'll use to apply changes after modifying your condu configuration.

#### `condu create <partial-path> [options]`

Creates a new package in a monorepo according to your project conventions.

```bash
# Create a basic package
condu create features/my-feature

# Create a package with a custom name
condu create features/my-feature --as @myorg/custom-name
```

Options:

- `--as <name>`: Specify a custom package name
- `--description <text>`: Add a description to the package.json
- `--private`: Mark the package as private

#### `condu tsc [options]`

Builds TypeScript code and additionally creates CommonJS (.cjs) or ES Module (.mjs) versions of your code.

```bash
# Build with CommonJS output
condu tsc --preset ts-to-cts

# Build with ES Module output
condu tsc --preset ts-to-mts
```

Options:

- `--preset ts-to-cts|ts-to-mts`: Generate CommonJS or ES Module versions
- All standard TypeScript compiler options are supported

#### `condu release [packages...] [options]`

Prepares packages for release by generating distributable files and optionally publishing to npm.

```bash
# Release all packages
condu release

# Release specific packages
condu release @myorg/package1 @myorg/package2

# Do a dry run without publishing
condu release --dry-run
```

Options:

- `--ci`: Mark non-released packages as private (useful in CI environments)
- `--npm-tag <tag>`: Specify the npm tag to use (default: latest)
- `--dry-run`: Prepare packages without actually publishing

#### `condu exec <command> [args...]`

Executes a command in the context of a selected package.

```bash
# Run in current directory
condu exec npm run test

# Run in a specific package
condu exec --pkg @myorg/my-package npm run test
```

Options:

- `--cwd <path>`: Specify the working directory
- `--pkg <package>`: Specify the target package

### Helper Commands

- `condu help`: Shows help information
- `condu version`: Shows the current condu version

## Best Practices

1. **Keep features focused**: Each feature should manage one aspect of configuration
2. **Use peer contexts** for cross-feature coordination, e.g. if you know that the project is TypeScript-based, you might want to enable TS-specific linters in your linter feature
3. **Use presets** to combine common feature sets, making common boilerplates like `create-react-app` obsolete
4. **Create custom features** for organization-specific configuration patterns
5. **Commit the generated files** to source control for transparency

## Preset Example

Presets combine multiple features with sensible defaults:

```typescript
// monorepo.ts
export const monorepo =
  (options = {}) =>
  (pkg) => ({
    projects: [
      {
        parentPath: "packages",
        nameConvention: `@${pkg.name}/*`,
      },
    ],
    features: [
      typescript(options.typescript),
      eslint(options.eslint),
      prettier(options.prettier),
      pnpm(options.pnpm),
      // Add more features
    ],
  });
```

Use a preset in your project:

```typescript
import { configure } from "condu";
import { monorepo } from "@condu-preset/monorepo";

export default configure(
  monorepo({
    // Override specific feature options
    typescript: {
      preset: "commonjs-first",
    },
  }),
);
```

## Conclusion

condu streamlines configuration management by:

- Centralizing all configuration in code
- Providing strong typing with TypeScript
- Enabling reuse across projects
- Minimizing boilerplate
- Making updates easier to apply

Say goodbye to config hell and focus on building your application!
