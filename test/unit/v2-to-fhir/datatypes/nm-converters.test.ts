import { test, expect, describe } from "bun:test";
import {
  convertNMToPositiveInt,
  convertNMToQuantity,
  convertNMToQuantityLengthOfStay,
  convertNMToDecimal,
} from "../../../../src/v2-to-fhir/datatypes/nm-converters";

describe("convertNMToPositiveInt", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNMToPositiveInt(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertNMToPositiveInt("")).toBeUndefined();
  });

  test("returns undefined for non-numeric string", () => {
    expect(convertNMToPositiveInt("abc")).toBeUndefined();
  });

  test("returns undefined for negative values", () => {
    expect(convertNMToPositiveInt("-5")).toBeUndefined();
  });

  test("returns positive integer for valid positive string", () => {
    expect(convertNMToPositiveInt("42")).toBe(42);
    expect(convertNMToPositiveInt("1")).toBe(1);
    expect(convertNMToPositiveInt("100")).toBe(100);
  });

  test("truncates decimal values to integer", () => {
    expect(convertNMToPositiveInt("3.7")).toBe(3);
    expect(convertNMToPositiveInt("10.99")).toBe(10);
  });

  test("returns 0 for zero", () => {
    expect(convertNMToPositiveInt("0")).toBe(0);
  });
});

describe("convertNMToQuantity", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNMToQuantity(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertNMToQuantity("")).toBeUndefined();
  });

  test("returns undefined for non-numeric string", () => {
    expect(convertNMToQuantity("abc")).toBeUndefined();
  });

  test("returns Quantity with value", () => {
    expect(convertNMToQuantity("42")).toEqual({ value: 42 });
  });

  test("preserves decimal values", () => {
    expect(convertNMToQuantity("3.14")).toEqual({ value: 3.14 });
  });

  test("handles negative values", () => {
    expect(convertNMToQuantity("-5")).toEqual({ value: -5 });
  });
});

describe("convertNMToQuantityLengthOfStay", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNMToQuantityLengthOfStay(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertNMToQuantityLengthOfStay("")).toBeUndefined();
  });

  test("returns undefined for non-numeric string", () => {
    expect(convertNMToQuantityLengthOfStay("abc")).toBeUndefined();
  });

  test("returns undefined for negative values", () => {
    expect(convertNMToQuantityLengthOfStay("-5")).toBeUndefined();
  });

  test("returns Quantity with days unit", () => {
    const result = convertNMToQuantityLengthOfStay("7");
    expect(result).toEqual({
      value: 7,
      unit: "days",
      system: "http://unitsofmeasure.org",
      code: "d",
    });
  });

  test("preserves decimal values", () => {
    const result = convertNMToQuantityLengthOfStay("3.5");
    expect(result?.value).toBe(3.5);
    expect(result?.unit).toBe("days");
  });
});

describe("convertNMToDecimal", () => {
  test("returns undefined for undefined input", () => {
    expect(convertNMToDecimal(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertNMToDecimal("")).toBeUndefined();
  });

  test("returns undefined for non-numeric string", () => {
    expect(convertNMToDecimal("abc")).toBeUndefined();
  });

  test("returns decimal value", () => {
    expect(convertNMToDecimal("42")).toBe(42);
    expect(convertNMToDecimal("3.14159")).toBe(3.14159);
    expect(convertNMToDecimal("-10.5")).toBe(-10.5);
  });
});
