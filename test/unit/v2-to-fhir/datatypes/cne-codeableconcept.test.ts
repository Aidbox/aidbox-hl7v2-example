import { test, expect, describe } from "bun:test";
import { convertCNEToCodeableConcept } from "../../../../src/v2-to-fhir/datatypes/cne-codeableconcept";

describe("convertCNEToCodeableConcept", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCNEToCodeableConcept(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CNE", () => {
    expect(convertCNEToCodeableConcept({})).toBeUndefined();
  });

  test("converts primary coding", () => {
    const result = convertCNEToCodeableConcept({
      $1_code: "F",
      $2_text: "Female",
      $3_system: "http://terminology.hl7.org/CodeSystem/v2-0001",
    });

    expect(result).toEqual({
      coding: [
        {
          code: "F",
          display: "Female",
          system: "http://terminology.hl7.org/CodeSystem/v2-0001",
        },
      ],
      text: "Female",
    });
  });

  test("converts with version", () => {
    const result = convertCNEToCodeableConcept({
      $1_code: "F",
      $2_text: "Female",
      $7_version: "2.9",
    });

    expect(result?.coding?.[0]?.version).toBe("2.9");
  });

  test("uses originalText for text when present", () => {
    const result = convertCNEToCodeableConcept({
      $1_code: "F",
      $2_text: "Female",
      $9_originalText: "Patient is female",
    });

    expect(result?.text).toBe("Patient is female");
  });

  test("converts alternate coding", () => {
    const result = convertCNEToCodeableConcept({
      $1_code: "F",
      $4_altCode: "female",
      $5_altDisplay: "Female Gender",
      $6_altSystem: "http://hl7.org/fhir/administrative-gender",
      $8_altVersion: "4.0",
    });

    expect(result?.coding).toHaveLength(2);
    expect(result?.coding?.[1]).toEqual({
      code: "female",
      display: "Female Gender",
      system: "http://hl7.org/fhir/administrative-gender",
      version: "4.0",
    });
  });
});
