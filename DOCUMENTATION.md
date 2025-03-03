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

The key part of the feature is a _recipe_.
It's a list of changes that should be made whenever `condu apply` is run.
If you've ever used react, you can think of the calls to any of the condu recipe APIs similarly to calling a component hook.

```typescript
import { defineFeature } from "condu";

// Declare the peer context for TypeScript support
declare module "condu" {
  interface PeerContext {
    myFeature: {
      config: { option1: string; option2: boolean };
    };
  }
}

export const myFeature = (options = {}) =>
  defineFeature("myFeature", {
    // Initial context for this feature
    initialPeerContext: {
      config: {
        option1: options.option1 || "default",
        option2: options.option2 || false,
      },
    },

    // How this feature affects other features' contexts
    modifyPeerContexts: (project, initialContext) => ({
      // Modify the eslint context
      eslint: (current) => ({
        ...current,
        defaultRules: {
          ...current.defaultRules,
          "my-rule": "error",
        },
      }),
    }),

    // The actual configuration recipe
    defineRecipe(condu, peerContext) {
      // Generate or modify files
      condu.root.generateFile("my-config.json", {
        content: peerContext.config,
        stringify: JSON.stringify,
      });

      // Ensure dependencies
      condu.root.ensureDependency("my-package", { dev: true });

      // Modify package.json
      condu.root.modifyPackageJson((pkg) => ({
        ...pkg,
        scripts: {
          ...pkg.scripts,
          "my-script": "my-command",
        },
      }));

      // In a monorepo you can target specific packages with the `in` method:
      // Apply to all packages
      condu.in({ kind: "package" }).generateFile("some-config.json", {
        content: {
          /* ... */
        },
      });

      // Apply only to a specific package
      condu.in({ name: "my-package" }).modifyPackageJson((pkg) => ({
        ...pkg,
        scripts: {
          ...pkg.scripts,
          build: "special-build-command",
        },
      }));
    },
  });
```

## PeerContext System

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
