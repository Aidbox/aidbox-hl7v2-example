import { test, expect, describe } from "bun:test";
import { convertFTToAnnotation } from "../../../src/v2-to-fhir/datatypes/ft-annotation";

describe("convertFTToAnnotation", () => {
  test("returns undefined for undefined input", () => {
    expect(convertFTToAnnotation(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertFTToAnnotation("")).toBeUndefined();
  });

  test("converts simple text to annotation", () => {
    const result = convertFTToAnnotation("This is a comment.");
    expect(result).toEqual({
      text: "This is a comment.",
    });
  });

  test("preserves multiline text", () => {
    const result = convertFTToAnnotation("Line 1\nLine 2\nLine 3");
    expect(result).toEqual({
      text: "Line 1\nLine 2\nLine 3",
    });
  });

  test("preserves HL7v2 escape sequences", () => {
    const result = convertFTToAnnotation("Bold: \\H\\text\\N\\");
    expect(result).toEqual({
      text: "Bold: \\H\\text\\N\\",
    });
  });

  test("handles special characters", () => {
    const result = convertFTToAnnotation("Test & verify <data> \"quoted\"");
    expect(result).toEqual({
      text: "Test & verify <data> \"quoted\"",
    });
  });
});
