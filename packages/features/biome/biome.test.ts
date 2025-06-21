import { biome } from "./biome.js";
import { defineFeature } from "condu";
import { expect, test } from "vitest";
import { testApplyFeatures } from "@condu-test/utils";

test("biome feature should generate default biome.json file", async () => {
  using testUtils = await testApplyFeatures({
    config: { features: [biome()] },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify basic structure
  expect(config).toHaveProperty("files");
  expect(config.files).toHaveProperty("includes");
  expect(config.files.includes).toBeInstanceOf(Array);

  // Verify includes pattern starts with **
  expect(config.files.includes).toContain("**");

  // Verify default ignore patterns include build directory and cache
  expect(config.files.includes).toContain("!.config/.cache/**");
  expect(config.files.includes).toContain("!build/**");
});

test("biome feature should use custom configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        biome({
          config: {
            formatter: {
              enabled: true,
              indentStyle: "tab",
              lineWidth: 120,
            },
            linter: {
              enabled: true,
            },
            javascript: {
              formatter: {
                quoteStyle: "single",
              },
            },
          },
          ignore: ["coverage/**", "dist/**"],
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify custom formatter config
  expect(config.formatter).toEqual({
    enabled: true,
    indentStyle: "tab",
    lineWidth: 120,
  });

  // Verify custom linter config
  expect(config.linter).toEqual({
    enabled: true,
  });

  // Verify JavaScript-specific config
  expect(config.javascript).toEqual({
    formatter: {
      quoteStyle: "single",
    },
  });

  // Verify custom ignore patterns are included
  expect(config.files.includes).toContain("!coverage/**");
  expect(config.files.includes).toContain("!dist/**");
});

test("biome feature should work with other features providing its peerContext", async () => {
  const customBiome = biome({
    config: {
      formatter: { enabled: true },
    },
  });

  const customFeature = defineFeature("custom", {
    modifyPeerContexts() {
      return {
        biome: (config) => ({
          ...config,
          config: {
            ...config.config,
            linter: {
              enabled: true,
            },
            javascript: {
              formatter: {
                quoteStyle: "single",
              },
            },
          },
          ignore: [...config.ignore, "temp/**"],
        }),
      };
    },
  });

  using testUtils = await testApplyFeatures({
    config: { features: [customBiome, customFeature] },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify peer-contributed linter config
  expect(config.linter).toEqual({
    enabled: true,
  });

  // Verify peer-contributed JavaScript config
  expect(config.javascript).toEqual({
    formatter: {
      quoteStyle: "single",
    },
  });

  // Verify peer-contributed ignore patterns
  expect(config.files.includes).toContain("!temp/**");
});

test("biome feature should support CSS configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        biome({
          config: {
            css: {
              formatter: {
                enabled: true,
                indentStyle: "space",
                indentWidth: 2,
              },
              linter: {
                enabled: true,
              },
            },
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify CSS configuration
  expect(config.css).toEqual({
    formatter: {
      enabled: true,
      indentStyle: "space",
      indentWidth: 2,
    },
    linter: {
      enabled: true,
    },
  });
});

test("biome feature should support JSON configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        biome({
          config: {
            json: {
              formatter: {
                enabled: true,
                indentStyle: "space",
                indentWidth: 2,
              },
            },
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify JSON configuration
  expect(config.json).toEqual({
    formatter: {
      enabled: true,
      indentStyle: "space",
      indentWidth: 2,
    },
  });
});

test("biome feature should merge files.includes configuration properly", async () => {
  const customBiome = biome({
    config: {
      files: {
        includes: ["src/**", "tests/**"],
      },
    },
    ignore: ["coverage/**"],
  });

  using testUtils = await testApplyFeatures({
    config: { features: [customBiome] },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify that all includes patterns are present
  expect(config.files.includes).toContain("**");
  expect(config.files.includes).toContain("src/**");
  expect(config.files.includes).toContain("tests/**");
  expect(config.files.includes).toContain("!coverage/**");
  expect(config.files.includes).toContain("!.config/.cache/**");
  expect(config.files.includes).toContain("!build/**");
});

test("biome feature should support overrides configuration", async () => {
  using testUtils = await testApplyFeatures({
    config: {
      features: [
        biome({
          config: {
            overrides: [
              {
                includes: ["*.test.ts", "*.spec.ts"],
                linter: {
                  rules: {
                    suspicious: {
                      noConsole: "off",
                    },
                  },
                },
              },
            ],
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents("biome.json");
  const config = JSON.parse(content);

  // Verify overrides
  expect(config.overrides).toHaveLength(1);
  expect(config.overrides[0]).toEqual({
    includes: ["*.test.ts", "*.spec.ts"],
    linter: {
      rules: {
        suspicious: {
          noConsole: "off",
        },
      },
    },
  });
});
