import { describe, test, expect } from "bun:test";
import {
  parseReferenceRange,
  parseStructuredNumeric,
} from "../../../../src/v2-to-fhir/segments/obx-observation";

describe("parseReferenceRange", () => {
  test("parses simple range like 3.5-5.5", () => {
    const result = parseReferenceRange("3.5-5.5");

    expect(result.low?.value).toBe(3.5);
    expect(result.high?.value).toBe(5.5);
  });

  test("parses range with integer values", () => {
    const result = parseReferenceRange("70-99");

    expect(result.low?.value).toBe(70);
    expect(result.high?.value).toBe(99);
  });

  test("parses comparator range >60", () => {
    const result = parseReferenceRange(">60");

    expect(result.text).toBe(">60");
    expect(result.low?.value).toBe(60);
  });

  test("parses comparator range <5", () => {
    const result = parseReferenceRange("<5");

    expect(result.text).toBe("<5");
    expect(result.high?.value).toBe(5);
  });

  test("handles text-only range like negative", () => {
    const result = parseReferenceRange("negative");

    expect(result.text).toBe("negative");
    expect(result.low).toBeUndefined();
    expect(result.high).toBeUndefined();
  });

  test("handles text-only range like normal", () => {
    const result = parseReferenceRange("normal");

    expect(result.text).toBe("normal");
  });

  test("returns text only for unparseable values", () => {
    const result = parseReferenceRange("See interpretation");

    expect(result.text).toBe("See interpretation");
    expect(result.low).toBeUndefined();
    expect(result.high).toBeUndefined();
  });
});

describe("parseStructuredNumeric (SN)", () => {
  test("parses plain number ^90 to valueQuantity", () => {
    const result = parseStructuredNumeric("^90");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(90);
  });

  test("parses comparator >^90 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric(">^90");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(90);
    expect(result.comparator).toBe(">");
  });

  test("parses comparator <^5 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric("<^5");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(5);
    expect(result.comparator).toBe("<");
  });

  test("parses comparator >=^100 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric(">=^100");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(100);
    expect(result.comparator).toBe(">=");
  });

  test("parses comparator <=^50 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric("<=^50");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(50);
    expect(result.comparator).toBe("<=");
  });

  test("parses range ^10^-^20 to valueRange", () => {
    const result = parseStructuredNumeric("^10^-^20");

    expect(result.type).toBe("range");
    expect(result.low).toBe(10);
    expect(result.high).toBe(20);
  });

  test("parses ratio ^1^:^128 to valueRatio", () => {
    const result = parseStructuredNumeric("^1^:^128");

    expect(result.type).toBe("ratio");
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(128);
  });

  test("parses ratio ^1^:^500 to valueRatio", () => {
    const result = parseStructuredNumeric("^1^:^500");

    expect(result.type).toBe("ratio");
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(500);
  });

  test("returns string fallback for unparseable SN", () => {
    const result = parseStructuredNumeric("invalid");

    expect(result.type).toBe("string");
    expect(result.raw).toBe("invalid");
  });
});
