# Condu Test Utilities

This package provides utilities for unit testing condu features.

## Usage

### Testing a Feature

```typescript
import { testFeature } from '@condu-test/utils';
import { myFeature } from '@condu-feature/my-feature';
import { expect } from 'vitest';

test("my feature should work", async () => {
  testFeature({
    name: "my-feature",
    config: {
      features: [myFeature({ /* feature config */ })]
    },
    tests: ({ getFileContents, collectedState, getMockState }) => {
      // Test that the right files were created
      const fileContent = getFileContents("path/to/file");
      expect(fileContent).toContain("expected content");
      
      // Or make assertions against the entire mock filesystem
      const mockState = getMockState();
      expect(Object.keys(mockState)).toContain("path/to/file");
      
      // Or check what state was collected
      expect(collectedState.fileManager.modifiedFiles.size).toBe(1);
    },
  });
});
```

### Testing Multiple Features Together

```typescript
import { createFeatureTest } from '@condu-test/utils';
import { featureA } from '@condu-feature/feature-a';
import { featureB } from '@condu-feature/feature-b';

test("features should work together", async () => {
  const { runFeatureTest } = createFeatureTest({
    config: {
      features: [featureA(), featureB()]
    },
    // Optional initial filesystem state
    initialFs: {
      "some-file.json": JSON.stringify({ key: "value" }),
    },
    // Optional custom package.json
    packageJson: {
      name: "test-project",
      dependencies: {
        "some-dep": "^1.0.0",
      },
    },
  });
  
  const { getFileContents, cleanup } = await runFeatureTest();
  
  // Test your features...
  
  cleanup();
});
```

### Using Dynamic Config

```typescript
import { createFeatureTest } from '@condu-test/utils';
import { typescript } from '@condu-feature/typescript';

test("feature with dynamic config", async () => {
  const { runFeatureTest } = createFeatureTest({
    // Using a function that returns a config
    config: (pkg) => ({
      features: [
        typescript({
          compilerOptions: {
            target: pkg.dependencies?.react ? "es2018" : "es2020",
          }
        })
      ]
    }),
    packageJson: {
      dependencies: {
        react: "^18.0.0"
      }
    }
  });
  
  const { getFileContents, cleanup } = await runFeatureTest();
  
  // Test that the TypeScript configuration is correct
  const tsconfig = JSON.parse(getFileContents("tsconfig.json"));
  expect(tsconfig.compilerOptions.target).toBe("es2018");
  
  cleanup();
});
```

## How It Works

The test utilities use:

1. `mock-fs` to create a virtual filesystem
2. `configure` to create a proper condu configuration
3. `collectState` to process the features and collect changes 
4. `applyAndCommitCollectedState` to apply those changes to the virtual filesystem
5. Testing utilities to verify the resulting filesystem state

This allows for unit testing features without performing full integration tests that modify the real filesystem.