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

### ConduApi

The main API available in feature recipes:

- `condu.project`: Information about the project
- `condu.root`: Operations on the root package
- `condu.in(criteria)`: Target specific packages

### StateDeclarationApi

Methods for declaring configuration changes:

- `generateFile(path, options)`: Create a new file
- `modifyGeneratedFile(path, options)`: Modify a generated file
- `modifyUserEditableFile(path, options)`: Modify a user-editable file
- `ensureDependency(name, options)`: Ensure a dependency exists
- `modifyPackageJson(modifier)`: Modify package.json
- `defineTask(name, definition)`: Define a task

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
