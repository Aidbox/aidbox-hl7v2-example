import { test, expect, describe } from "bun:test";
import { convertCWEToDurationUnit } from "../../../src/v2-to-fhir/datatypes/cwe-timing-durationunit";

describe("convertCWEToDurationUnit", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToDurationUnit(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToDurationUnit({})).toBeUndefined();
  });

  test("converts seconds", () => {
    expect(convertCWEToDurationUnit({ $1_code: "s" })).toBe("s");
  });

  test("converts minutes", () => {
    expect(convertCWEToDurationUnit({ $1_code: "min" })).toBe("min");
  });

  test("converts hours", () => {
    expect(convertCWEToDurationUnit({ $1_code: "h" })).toBe("h");
  });

  test("converts days", () => {
    expect(convertCWEToDurationUnit({ $1_code: "d" })).toBe("d");
  });

  test("converts weeks", () => {
    expect(convertCWEToDurationUnit({ $1_code: "wk" })).toBe("wk");
  });

  test("converts months", () => {
    expect(convertCWEToDurationUnit({ $1_code: "mo" })).toBe("mo");
  });

  test("converts years", () => {
    expect(convertCWEToDurationUnit({ $1_code: "a" })).toBe("a");
  });

  test("returns undefined for invalid unit code", () => {
    expect(convertCWEToDurationUnit({ $1_code: "invalid" })).toBeUndefined();
  });

  test("returns undefined when only text is present", () => {
    expect(convertCWEToDurationUnit({ $2_text: "days" })).toBeUndefined();
  });

  test("ignores text when code is valid", () => {
    const result = convertCWEToDurationUnit({
      $1_code: "d",
      $2_text: "days",
    });
    expect(result).toBe("d");
  });
});
