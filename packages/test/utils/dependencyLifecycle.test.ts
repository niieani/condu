import { expect, test } from "vitest";
import { testApplyFeatures } from "./featureTestUtils.js";
import { defineFeature } from "condu";
import {
  collectState,
  applyAndCommitCollectedState,
} from "condu/commands/apply/apply.js";

test("apply removes previous ownership when no feature declares dependencies", async () => {
  using result = await testApplyFeatures({
    config: { features: [] },
    packageJson: {
      devDependencies: { retired: "1.0.0", manual: "2.0.0" },
      condu: { managedDependencies: { retired: "presence" } },
    },
  });
  expect(
    JSON.parse(await result.getFileContents("package.json")),
  ).toMatchObject({
    devDependencies: { manual: "2.0.0" },
    condu: { managedDependencies: {} },
  });
  expect(result.project.manifest.devDependencies).not.toHaveProperty("retired");
});

test("removing a feature preserves a pre-existing user dependency", async () => {
  using initial = await testApplyFeatures({
    config: {
      features: [
        defineFeature("fixture", {
          defineRecipe(condu) {
            condu.root.ensureDependency("user-tool", { version: "9.0.0" });
          },
        }),
      ],
    },
    packageJson: { devDependencies: { "user-tool": "~1.0.0" } },
  });
  expect(initial.project.manifest.condu?.managedDependencies).toBeUndefined();
  using afterRemoval = await testApplyFeatures({
    config: { features: [] },
    projectDir: initial.projectDir,
  });
  expect(afterRemoval.project.manifest.devDependencies).toEqual({
    "user-tool": "~1.0.0",
  });
});

test("root and single-package proxy declarations reconcile the same manifest once", async () => {
  using result = await testApplyFeatures({
    config: {
      features: [
        defineFeature("fixture", {
          defineRecipe(condu) {
            condu.root.ensureDependency("root-tool", { version: "1.0.0" });
            condu
              .in({ kind: "package" })
              .ensureDependency("package-tool", { version: "2.0.0" });
          },
        }),
      ],
    },
  });
  expect(result.project.manifest.devDependencies).toEqual({
    "root-tool": "^1.0.0",
    "package-tool": "^2.0.0",
  });
  expect(result.project.manifest.condu?.managedDependencies).toEqual({
    "root-tool": "presence",
    "package-tool": "presence",
  });
});

test("dependency metrics count installed aliases once across lists and duplicate declarations", async () => {
  using fixture = await testApplyFeatures({ config: { features: [] } });
  const state = await collectState({ project: fixture.project });
  for (const list of [
    "devDependencies",
    "peerDependencies",
    "devDependencies",
  ] as const) {
    state.collectedState.dependencies.push({
      targetPackage: fixture.project.workspace,
      context: { featureName: "fixture" },
      dependencyDefinition: {
        name: "actual",
        installAsAlias: "alias",
        version: "1.0.0",
        list,
      },
    });
  }
  const summary = await applyAndCommitCollectedState(state);
  expect(summary.dependencyStats).toEqual({
    evaluated: 1,
    changed: 1,
    removed: 0,
  });
  expect(summary.packagesTouched.size).toBe(1);
});
