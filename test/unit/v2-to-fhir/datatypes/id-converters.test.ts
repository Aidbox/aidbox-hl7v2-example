import { test, expect, describe } from "bun:test";
import {
  convertIDToBoolean,
  convertIDToCode,
  convertIDToCodeableConcept,
  convertIDToCodeableConceptUniversalID,
  convertIDToCoding,
  convertIDToString,
} from "../../../../src/v2-to-fhir/datatypes/id-converters";

describe("convertIDToBoolean", () => {
  test("returns undefined for undefined input", () => {
    expect(convertIDToBoolean(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertIDToBoolean("")).toBeUndefined();
  });

  test("returns true for Y", () => {
    expect(convertIDToBoolean("Y")).toBe(true);
  });

  test("returns true for Yes (case insensitive)", () => {
    expect(convertIDToBoolean("yes")).toBe(true);
    expect(convertIDToBoolean("YES")).toBe(true);
  });

  test("returns true for 1", () => {
    expect(convertIDToBoolean("1")).toBe(true);
  });

  test("returns true for true (string)", () => {
    expect(convertIDToBoolean("true")).toBe(true);
    expect(convertIDToBoolean("TRUE")).toBe(true);
  });

  test("returns false for N", () => {
    expect(convertIDToBoolean("N")).toBe(false);
  });

  test("returns false for No (case insensitive)", () => {
    expect(convertIDToBoolean("no")).toBe(false);
    expect(convertIDToBoolean("NO")).toBe(false);
  });

  test("returns false for 0", () => {
    expect(convertIDToBoolean("0")).toBe(false);
  });

  test("returns false for false (string)", () => {
    expect(convertIDToBoolean("false")).toBe(false);
    expect(convertIDToBoolean("FALSE")).toBe(false);
  });

  test("returns undefined for unknown values", () => {
    expect(convertIDToBoolean("maybe")).toBeUndefined();
    expect(convertIDToBoolean("X")).toBeUndefined();
  });
});

describe("convertIDToCode", () => {
  test("returns undefined for undefined input", () => {
    expect(convertIDToCode(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertIDToCode("")).toBeUndefined();
  });

  test("returns the code as-is", () => {
    expect(convertIDToCode("A")).toBe("A");
    expect(convertIDToCode("P01")).toBe("P01");
  });
});

describe("convertIDToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertIDToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertIDToCodeableConcept("")).toBeUndefined();
  });

  test("returns CodeableConcept with code", () => {
    const result = convertIDToCodeableConcept("A01");
    expect(result).toEqual({
      coding: [{ code: "A01" }],
    });
  });
});

describe("convertIDToCodeableConceptUniversalID", () => {
  test("returns undefined for undefined input", () => {
    expect(convertIDToCodeableConceptUniversalID(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertIDToCodeableConceptUniversalID("")).toBeUndefined();
  });

  test("returns CodeableConcept with code and system", () => {
    const result = convertIDToCodeableConceptUniversalID("ISO");
    expect(result).toEqual({
      coding: [
        {
          code: "ISO",
          system: "http://terminology.hl7.org/CodeSystem/v2-0301",
        },
      ],
    });
  });
});

describe("convertIDToCoding", () => {
  test("returns undefined for undefined input", () => {
    expect(convertIDToCoding(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertIDToCoding("")).toBeUndefined();
  });

  test("returns Coding with code", () => {
    const result = convertIDToCoding("M");
    expect(result).toEqual({
      code: "M",
    });
  });
});

describe("convertIDToString", () => {
  test("returns undefined for undefined input", () => {
    expect(convertIDToString(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertIDToString("")).toBeUndefined();
  });

  test("returns the string as-is", () => {
    expect(convertIDToString("TestValue")).toBe("TestValue");
  });
});
