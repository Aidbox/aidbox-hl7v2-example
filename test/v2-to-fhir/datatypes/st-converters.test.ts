import { test, expect, describe } from "bun:test";
import {
  convertSTToCodeableConcept,
  convertSTToIdentifier,
  convertSTArrayToCodeableConcepts,
  convertSTArrayToIdentifiers,
} from "../../../src/v2-to-fhir/datatypes/st-converters";

describe("convertSTToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertSTToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertSTToCodeableConcept("")).toBeUndefined();
  });

  test("converts string to CodeableConcept text", () => {
    const result = convertSTToCodeableConcept("Active");
    expect(result).toEqual({
      text: "Active",
    });
  });

  test("converts complex string to CodeableConcept text", () => {
    const result = convertSTToCodeableConcept(
      "Patient is complaining of chest pain"
    );
    expect(result).toEqual({
      text: "Patient is complaining of chest pain",
    });
  });
});

describe("convertSTToIdentifier", () => {
  test("returns undefined for undefined input", () => {
    expect(convertSTToIdentifier(undefined)).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(convertSTToIdentifier("")).toBeUndefined();
  });

  test("converts string to Identifier value", () => {
    const result = convertSTToIdentifier("12345");
    expect(result).toEqual({
      value: "12345",
    });
  });

  test("converts alphanumeric string to Identifier value", () => {
    const result = convertSTToIdentifier("MRN-ABC123");
    expect(result).toEqual({
      value: "MRN-ABC123",
    });
  });
});

describe("convertSTArrayToCodeableConcepts", () => {
  test("returns undefined for undefined input", () => {
    expect(convertSTArrayToCodeableConcepts(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertSTArrayToCodeableConcepts([])).toBeUndefined();
  });

  test("converts array of strings to CodeableConcepts", () => {
    const result = convertSTArrayToCodeableConcepts(["Active", "Inactive"]);
    expect(result).toEqual([{ text: "Active" }, { text: "Inactive" }]);
  });

  test("filters out empty strings", () => {
    const result = convertSTArrayToCodeableConcepts(["Active", "", "Inactive"]);
    expect(result).toEqual([{ text: "Active" }, { text: "Inactive" }]);
  });
});

describe("convertSTArrayToIdentifiers", () => {
  test("returns undefined for undefined input", () => {
    expect(convertSTArrayToIdentifiers(undefined)).toBeUndefined();
  });

  test("returns undefined for empty array", () => {
    expect(convertSTArrayToIdentifiers([])).toBeUndefined();
  });

  test("converts array of strings to Identifiers", () => {
    const result = convertSTArrayToIdentifiers(["ID1", "ID2"]);
    expect(result).toEqual([{ value: "ID1" }, { value: "ID2" }]);
  });

  test("filters out empty strings", () => {
    const result = convertSTArrayToIdentifiers(["ID1", "", "ID2"]);
    expect(result).toEqual([{ value: "ID1" }, { value: "ID2" }]);
  });
});
