import { defineFeature } from "condu";
import { expect, test } from "vitest";
import { testApplyFeatures } from "./featureTestUtils.js";

test("custom feature should work", async () => {
  const customFeature = defineFeature("custom", {
    defineRecipe(condu) {
      condu.root.generateFile("test.txt", {
        content({ targetPackage }) {
          return `Hello, ${targetPackage.name}!`;
        },
      });
    },
  });

  using testUtils = await testApplyFeatures({
    config: { features: [customFeature] },
    packageJson: { name: "test" },
  });

  const content = await testUtils.getFileContents("test.txt");

  // Verify content
  expect(content).toBe("Hello, test!");
});
