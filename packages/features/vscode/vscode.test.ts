import { vscode } from "./vscode.js";
import { oxlint } from "@condu-feature/oxlint/oxlint.js";
import { defineFeature } from "condu";
import { expect, test } from "vitest";
import { testApplyFeatures } from "@condu-test/utils";

test("vscode feature should generate extensions.json with recommended extensions", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        vscode({
          extensions: {
            recommendations: ["dbaeumer.vscode-eslint"],
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents(".vscode/extensions.json");
  const config = JSON.parse(content);

  expect(config.recommendations).toContain("dbaeumer.vscode-eslint");
});

test("vscode feature should merge extensions from peer context", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        vscode({
          extensions: {
            recommendations: ["dbaeumer.vscode-eslint"],
          },
        }),
        oxlint(),
      ],
    },
  });

  const content = await testUtils.getFileContents(".vscode/extensions.json");
  const config = JSON.parse(content);

  expect(config.recommendations).toContain("dbaeumer.vscode-eslint");
  expect(config.recommendations).toContain("oxc.oxc-vscode");
});

test("vscode feature should deduplicate extensions", async () => {
  const customFeature = defineFeature("custom", {
    modifyPeerContexts() {
      return {
        vscode: (config) => ({
          ...config,
          extensions: {
            ...config.extensions,
            recommendations: [
              ...(config.extensions.recommendations ?? []),
              "dbaeumer.vscode-eslint", // duplicate
              "esbenp.prettier-vscode",
            ],
          },
        }),
      };
    },
  });

  using testUtils = await testApplyFeatures({
    config: {
      features: [
        vscode({
          extensions: {
            recommendations: ["dbaeumer.vscode-eslint"],
          },
        }),
        customFeature,
      ],
    },
  });

  const content = await testUtils.getFileContents(".vscode/extensions.json");
  const config = JSON.parse(content);

  // Should only have one instance of each extension
  expect(config.recommendations).toHaveLength(2);
  expect(config.recommendations).toContain("dbaeumer.vscode-eslint");
  expect(config.recommendations).toContain("esbenp.prettier-vscode");
});

test("vscode feature should support unwanted recommendations", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        vscode({
          extensions: {
            recommendations: ["dbaeumer.vscode-eslint"],
            unwantedRecommendations: ["ms-vscode.vscode-typescript-next"],
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents(".vscode/extensions.json");
  const config = JSON.parse(content);

  expect(config.recommendations).toContain("dbaeumer.vscode-eslint");
  expect(config.unwantedRecommendations).toContain(
    "ms-vscode.vscode-typescript-next",
  );
});
