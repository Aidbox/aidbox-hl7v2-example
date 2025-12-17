import { test, expect, describe } from "bun:test";
import {
  convertISToCode,
  convertISToCodeableConcept,
  convertISToString,
} from "../../../src/v2-to-fhir/datatypes/is-converters";

describe("convertISToCode", () => {
  test("returns undefined for undefined input", () => {
    expect(convertISToCode(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertISToCode("")).toBeUndefined();
  });

  test("returns the code as-is", () => {
    expect(convertISToCode("INP")).toBe("INP");
    expect(convertISToCode("OUTPAT")).toBe("OUTPAT");
  });
});

describe("convertISToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertISToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertISToCodeableConcept("")).toBeUndefined();
  });

  test("returns CodeableConcept with code", () => {
    const result = convertISToCodeableConcept("INP");
    expect(result).toEqual({
      coding: [{ code: "INP" }],
    });
  });
});

describe("convertISToString", () => {
  test("returns undefined for undefined input", () => {
    expect(convertISToString(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertISToString("")).toBeUndefined();
  });

  test("returns the string as-is", () => {
    expect(convertISToString("UserDefined")).toBe("UserDefined");
  });
});
