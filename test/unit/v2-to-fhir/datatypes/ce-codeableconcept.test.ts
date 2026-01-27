import { test, expect, describe } from "bun:test";
import { convertCEToCodeableConcept } from "../../../../src/v2-to-fhir/datatypes/ce-codeableconcept";

describe("convertCEToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCEToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CE", () => {
    expect(convertCEToCodeableConcept({})).toBeUndefined();
  });

  test("converts primary coding", () => {
    const result = convertCEToCodeableConcept({
      $1_code: "M",
      $2_text: "Married",
      $3_system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
    });

    expect(result).toEqual({
      coding: [
        {
          code: "M",
          display: "Married",
          system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
        },
      ],
      text: "Married",
    });
  });

  test("converts primary and alternate coding", () => {
    const result = convertCEToCodeableConcept({
      $1_code: "M",
      $2_text: "Married",
      $3_system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
      $4_altCode: "MAR",
      $5_altDisplay: "Married Person",
      $6_altSystem: "http://example.com/marital",
    });

    expect(result?.coding).toHaveLength(2);
    expect(result?.coding?.[1]).toEqual({
      code: "MAR",
      display: "Married Person",
      system: "http://example.com/marital",
    });
  });

  test("converts code only without display", () => {
    const result = convertCEToCodeableConcept({
      $1_code: "M",
    });

    expect(result).toEqual({
      coding: [{ code: "M" }],
    });
  });

  test("preserves original system values without normalization", () => {
    const result = convertCEToCodeableConcept({
      $1_code: "2160-0",
      $2_text: "Creatinine",
      $3_system: "LN",
    });

    expect(result?.coding?.[0]?.system).toBe("LN");
  });
});
