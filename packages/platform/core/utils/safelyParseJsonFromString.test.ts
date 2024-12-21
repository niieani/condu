import { describe, expect, it } from "vitest";
import { safelyParseLastJsonFromString } from "./safelyParseJsonFromString.js";

describe("safelyParseLastJsonFromString", () => {
  it("should parse the last JSON object in the string", () => {
    const input =
      'Some text before {"key": "value"} and some text after and another JSON [1, 2, 3]';
    const expected = [1, 2, 3];
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });

  it("should return null if no JSON is found", () => {
    const input = "Some text without JSON";
    expect(safelyParseLastJsonFromString(input)).toBeUndefined();
  });

  it("should handle multiline JSON objects", () => {
    const input = `Some text before
        {
            "key": "value"
        }
        and some text after and another JSON
        [
            1, 2, 3
        ] more text here`;
    const expected = [1, 2, 3];
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });

  it("should handle nested JSON objects", () => {
    const input =
      'Some text before {"nested": {"key": "value"}} and some text after and another JSON {"array": [1, 2, 3]}';
    const expected = { array: [1, 2, 3] };
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });

  it("should handle strings with } ] before the JSON", () => {
    const input = 'Some text with brackets } ] before {"key": "value"}';
    const expected = { key: "value" };
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });

  it("should handle strings with { [ after the JSON", () => {
    const input = '{"key": "value"} and some text with brackets { [ after';
    const expected = { key: "value" };
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });

  it("should handle invalid JSON gracefully", () => {
    const input = 'Some text before {"key": "value" and some text after';
    expect(safelyParseLastJsonFromString(input)).toBeUndefined();
  });

  it("should return the last valid JSON when multiple JSON items are present", () => {
    const input =
      'Some text before {"first": "value"} and some text after and another JSON {"second": "value"} and more text before {"third": "value"}';
    const expectedOutput = { third: "value" };
    expect(safelyParseLastJsonFromString(input)).toEqual(expectedOutput);
  });

  it("should parse a simple JSON string", () => {
    const input = '"value"';
    const expected = "value";
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });

  it("should parse a simple JSON number", () => {
    const input = "123";
    const expected = 123;
    expect(safelyParseLastJsonFromString(input)).toEqual(expected);
  });
});
