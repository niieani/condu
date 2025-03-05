// Using relative path to avoid module resolution issues
import { editorconfig } from "@condu-feature/editorconfig/editorconfig.js";
import { defineFeature } from "condu";
import { expect, test } from "vitest";
import { testApplyFeatures } from "@condu-test/utils";

test("editorconfig feature should generate default .editorconfig file", async () => {
  using testUtils = await testApplyFeatures({
    // Create config with just the editorconfig feature
    config: { features: [editorconfig()] },
  });

  const content = await testUtils.getFileContents(".editorconfig");

  // Verify basic structure
  expect(content).toContain("root = true");
  expect(content).toContain("[*]");

  // Verify default settings
  expect(content).toContain("indent_style = space");
  expect(content).toContain("indent_size = 2");
  expect(content).toContain("end_of_line = lf");
  expect(content).toContain("charset = utf-8");
  expect(content).toContain("trim_trailing_whitespace = true");
  expect(content).toContain("insert_final_newline = true");
  expect(content).toContain("max_line_length = 80");
});

test("editorconfig feature should use custom configuration", async () => {
  using testUtils = await testApplyFeatures({
    // Create config with custom editorconfig feature
    config: {
      features: [
        editorconfig({
          sections: {
            "*": {
              indent_style: "space",
              indent_size: 4,
            },
            "*.md": {
              trim_trailing_whitespace: false,
            },
            Makefile: {
              indent_style: "tab",
            },
          },
        }),
      ],
    },
  });

  const content = await testUtils.getFileContents(".editorconfig");

  testUtils.bypassMockFs(() => {
    expect(content).toMatchInlineSnapshot(`
      "root = true

      [*]
      indent_style = space
      indent_size = 4

      [*.md]
      trim_trailing_whitespace = false

      [Makefile]
      indent_style = tab"
    `);
  });
});

test("editorconfig feature should work with other features providing its peerContext", async () => {
  // Create a custom editorconfig feature with additional section
  const customEditorConfig = editorconfig({
    sections: { "*.json": { indent_size: 2 } },
  });

  const customFeature = defineFeature("custom", {
    modifyPeerContexts() {
      return {
        editorconfig: (config) => ({
          ...config,
          sections: { ...config.sections, "*.yaml": { indent_size: 6 } },
        }),
      };
    },
  });

  using testUtils = await testApplyFeatures({
    // Create config with the custom feature
    config: { features: [customEditorConfig, customFeature] },
  });

  const content = await testUtils.getFileContents(".editorconfig");

  // Verify default content
  expect(content).toContain("[*]");
  expect(content).toContain("indent_style = space");

  // Verify the peer-contributed section exists
  expect(content).toContain("[*.json]");
  expect(content).toContain("indent_size = 2");

  expect(content).toContain("[*.yaml]");
  expect(content).toContain("indent_size = 6");
});
