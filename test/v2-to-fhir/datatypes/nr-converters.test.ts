import { test, expect, describe } from "bun:test";
import { convertNRToRange } from "../../../src/v2-to-fhir/datatypes/nr-converters";

describe("convertNRToRange", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNRToRange(undefined)).toBeUndefined();
  });

  test("returns undefined when no values", () => {
    expect(convertNRToRange({})).toBeUndefined();
  });

  test("returns undefined when values are not numeric", () => {
    expect(convertNRToRange({ $1_low: "abc", $2_high: "xyz" })).toBeUndefined();
  });

  test("returns Range with both low and high", () => {
    const result = convertNRToRange({
      $1_low: "10",
      $2_high: "100",
    });
    expect(result).toEqual({
      low: { value: 10 },
      high: { value: 100 },
    });
  });

  test("returns Range with only low value", () => {
    const result = convertNRToRange({
      $1_low: "5",
    });
    expect(result).toEqual({
      low: { value: 5 },
    });
  });

  test("returns Range with only high value", () => {
    const result = convertNRToRange({
      $2_high: "50",
    });
    expect(result).toEqual({
      high: { value: 50 },
    });
  });

  test("handles decimal values", () => {
    const result = convertNRToRange({
      $1_low: "3.14",
      $2_high: "99.99",
    });
    expect(result).toEqual({
      low: { value: 3.14 },
      high: { value: 99.99 },
    });
  });

  test("handles negative values", () => {
    const result = convertNRToRange({
      $1_low: "-10",
      $2_high: "10",
    });
    expect(result).toEqual({
      low: { value: -10 },
      high: { value: 10 },
    });
  });

  test("returns partial result when one value is invalid", () => {
    const result = convertNRToRange({
      $1_low: "abc",
      $2_high: "50",
    });
    expect(result).toEqual({
      high: { value: 50 },
    });
  });
});
