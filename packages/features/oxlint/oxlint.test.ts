import { oxlint } from "./oxlint.js";
import { defineFeature } from "condu";
import { expect, test } from "vitest";
import { testApplyFeatures } from "@condu-test/utils";

test("oxlint feature should generate default .oxlintrc.json file", async () => {
  using testUtils = await testApplyFeatures({
    config: { features: [oxlint()] },
  });

  const content = await testUtils.getFileContents(".oxlintrc.json");
  const config = JSON.parse(content);

  // Verify basic structure
  expect(config).toHaveProperty("ignorePatterns");
  expect(config.ignorePatterns).toBeInstanceOf(Array);

  // Verify default ignore patterns include build directory and cache
  expect(config.ignorePatterns).toContain("/.config/.cache/");
  expect(config.ignorePatterns).toContain("/build/");
});

test("oxlint feature should use custom configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        oxlint({
          config: {
            rules: {
              eqeqeq: "error",
              "import/no-cycle": "warn",
            },
            env: {
              browser: true,
              node: true,
            },
            plugins: ["import", "typescript"],
          },
          ignore: ["coverage/**", "dist/**"],
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents(".oxlintrc.json");
  const config = JSON.parse(content);

  // Verify custom rules
  expect(config.rules).toEqual({
    eqeqeq: "error",
    "import/no-cycle": "warn",
  });

  // Verify custom env
  expect(config.env).toEqual({
    browser: true,
    node: true,
  });

  // Verify custom plugins
  expect(config.plugins).toEqual(["import", "typescript"]);

  // Verify custom ignore patterns are included
  expect(config.ignorePatterns).toContain("coverage/**");
  expect(config.ignorePatterns).toContain("dist/**");
});

test("oxlint feature should work with category configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        oxlint({
          config: {
            categories: {
              correctness: "error",
              style: "warn",
              perf: "off",
            },
            rules: {
              "no-unused-vars": "error",
            },
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents(".oxlintrc.json");
  const config = JSON.parse(content);

  // Verify categories
  expect(config.categories).toEqual({
    correctness: "error",
    style: "warn",
    perf: "off",
  });

  // Verify rules override categories
  expect(config.rules).toEqual({
    "no-unused-vars": "error",
  });
});

test("oxlint feature should work with other features providing its peerContext", async () => {
  const customOxlint = oxlint({
    config: { rules: { eqeqeq: "warn" } },
  });

  const customFeature = defineFeature("custom", {
    modifyPeerContexts() {
      return {
        oxlint: (config) => ({
          ...config,
          config: {
            ...config.config,
            rules: {
              ...config.config.rules,
              "no-console": "error",
            },
            globals: {
              myGlobal: "readonly",
            },
          },
          ignore: [...config.ignore, "temp/**"],
        }),
      };
    },
  });

  using testUtils = await testApplyFeatures({
    config: { features: [customOxlint, customFeature] },
  });

  const content = await testUtils.getFileContents(".oxlintrc.json");
  const config = JSON.parse(content);

  // Verify peer-contributed rules
  expect(config.rules).toEqual({
    eqeqeq: "warn",
    "no-console": "error",
  });

  // Verify peer-contributed globals
  expect(config.globals).toEqual({
    myGlobal: "readonly",
  });

  // Verify peer-contributed ignore patterns
  expect(config.ignorePatterns).toContain("temp/**");
});

test("oxlint feature should support overrides configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        oxlint({
          config: {
            rules: {
              "no-explicit-any": "error",
            },
            overrides: [
              {
                files: ["*.test.ts", "*.spec.ts"],
                rules: {
                  "no-explicit-any": "off",
                },
              },
            ],
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents(".oxlintrc.json");
  const config = JSON.parse(content);

  // Verify base rules
  expect(config.rules).toEqual({
    "no-explicit-any": "error",
  });

  // Verify overrides
  expect(config.overrides).toHaveLength(1);
  expect(config.overrides[0]).toEqual({
    files: ["*.test.ts", "*.spec.ts"],
    rules: {
      "no-explicit-any": "off",
    },
  });
});
