# Integration Testing Strategy for Condu

This directory contains integration tests for the condu project. The goal is to verify that condu works correctly in real-world scenarios, from initialization to configuration application.

## Testing Strategy

Our integration tests follow these principles:

1. **Isolation**: Each test creates a temporary directory with a fresh condu project to ensure tests don't interfere with each other
2. **Realistic scenarios**: Tests simulate actual user workflows, from initialization to config application
3. **Self-contained**: Tests use local condu code rather than published packages to test the latest changes
4. **Verification**: Tests validate that the expected files and configurations are generated correctly

## Test Workflow

Each integration test typically follows this workflow:

1. Create a temporary directory for the test
2. Initialize a git repository in the directory
3. Create a specific condu configuration for the test case
4. Link the test project to the local condu monorepo using the `linkOtherMonorepo` feature
5. Run `pnpm install` to install dependencies
6. Run `condu apply` to generate configuration files
7. Verify that the expected files and content are generated correctly
8. Clean up the temporary directory

## Testing Infrastructure

### File Structure

- `test-utils.ts`: Utility functions for creating test projects, running commands, etc.
- `basic.test.ts`: Simple test case for basic condu functionality
- Additional test files for specific features and scenarios

### Dependencies

- We use `vitest` as the test runner
- The `linkOtherMonorepo` feature ensures tests use the local condu code
- `verdaccio` is used for testing release/publish functionality

## Running Tests

```bash
# Run all integration tests
pnpm exec vitest test/integration

# Run a specific test
pnpm exec vitest test/integration -- -t "basic condu functionality"
```

## Adding New Tests

When adding a new test case:

1. Create a new test file in this directory
2. Use the utility functions from `test-utils.ts`
3. Follow the test workflow pattern
4. Ensure proper cleanup of temporary files in the `afterEach` or `afterAll` hooks

## Example

See `basic.test.ts` for a reference implementation of a basic integration test.
