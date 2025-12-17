import { test, expect, describe } from "bun:test";
import { convertCWEToPractitionerRole } from "../../../src/v2-to-fhir/datatypes/cwe-practitionerrole";

describe("convertCWEToPractitionerRole", () => {
  test("returns undefined for undefined input", () => {
    expect(convertCWEToPractitionerRole(undefined)).toBeUndefined();
  });

  test("returns undefined for empty CWE", () => {
    expect(convertCWEToPractitionerRole({})).toBeUndefined();
  });

  test("converts full CWE to PractitionerRole", () => {
    const result = convertCWEToPractitionerRole({
      $1_code: "MD",
      $2_text: "Medical Doctor",
      $3_system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
    });

    expect(result).toEqual({
      resourceType: "PractitionerRole",
      code: [
        {
          coding: [
            {
              code: "MD",
              display: "Medical Doctor",
              system: "http://terminology.hl7.org/CodeSystem/practitioner-role",
            },
          ],
        },
      ],
    });
  });

  test("converts with alternate coding", () => {
    const result = convertCWEToPractitionerRole({
      $1_code: "C1",
      $2_text: "Primary Role",
      $3_system: "S1",
      $4_altCode: "C2",
      $5_altDisplay: "Alt Role",
      $6_altSystem: "S2",
    });

    expect(result).toEqual({
      resourceType: "PractitionerRole",
      code: [
        {
          coding: [
            { code: "C1", display: "Primary Role", system: "S1" },
            { code: "C2", display: "Alt Role", system: "S2" },
          ],
        },
      ],
    });
  });

  test("converts code only", () => {
    const result = convertCWEToPractitionerRole({ $1_code: "RN" });

    expect(result).toEqual({
      resourceType: "PractitionerRole",
      code: [{ coding: [{ code: "RN" }] }],
    });
  });

  test("converts text only", () => {
    const result = convertCWEToPractitionerRole({ $2_text: "Nurse" });

    expect(result).toEqual({
      resourceType: "PractitionerRole",
      code: [{ coding: [{ display: "Nurse" }] }],
    });
  });

  test("converts alternate coding only", () => {
    const result = convertCWEToPractitionerRole({
      $4_altCode: "ALT",
      $5_altDisplay: "Alternate Role",
    });

    expect(result).toEqual({
      resourceType: "PractitionerRole",
      code: [{ coding: [{ code: "ALT", display: "Alternate Role" }] }],
    });
  });

  test("includes original text", () => {
    const result = convertCWEToPractitionerRole({
      $1_code: "MD",
      $2_text: "Doctor",
      $9_originalText: "Primary Care Physician",
    });

    expect(result?.code?.[0]?.text).toBe("Primary Care Physician");
  });

  test("code array contains single CodeableConcept", () => {
    const result = convertCWEToPractitionerRole({
      $1_code: "MD",
      $4_altCode: "PHYS",
    });

    expect(result?.code).toHaveLength(1);
    expect(result?.code?.[0]?.coding).toHaveLength(2);
  });
});
