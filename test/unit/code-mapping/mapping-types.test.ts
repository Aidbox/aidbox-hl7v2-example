import { describe, test, expect } from "bun:test";
import {
  MAPPING_TYPES,
  getMappingTypeOrFail,
  isMappingTypeName,
  type MappingTypeName,
} from "../../../src/code-mapping/mapping-types";

describe("MAPPING_TYPES registry", () => {
  test("contains all required mapping types", () => {
    const expectedTypes: MappingTypeName[] = [
      "observation-code-loinc",
      "patient-class",
      "obr-status",
      "obx-status",
    ];

    for (const typeName of expectedTypes) {
      expect(MAPPING_TYPES[typeName]).toBeDefined();
    }
  });

  test("each type has all required fields", () => {
    const requiredFields = [
      "taskDisplay",
      "targetSystem",
      "sourceFieldLabel",
      "targetFieldLabel",
    ];

    for (const [typeName, config] of Object.entries(MAPPING_TYPES)) {
      for (const field of requiredFields) {
        expect(
          config[field as keyof typeof config],
          `${typeName} missing ${field}`,
        ).toBeDefined();
      }
    }
  });

  test("observation-code-loinc type has correct configuration", () => {
    expect(MAPPING_TYPES["observation-code-loinc"]).toEqual({
      taskDisplay: "Observation code to LOINC mapping",
      targetSystem: "http://loinc.org",
      sourceFieldLabel: "OBX-3",
      targetFieldLabel: "Observation.code",
    });
  });

  test("obr-status type has correct target system", () => {
    expect(MAPPING_TYPES["obr-status"].targetSystem).toBe(
      "http://hl7.org/fhir/diagnostic-report-status",
    );
  });

  test("obx-status type has correct target system", () => {
    expect(MAPPING_TYPES["obx-status"].targetSystem).toBe(
      "http://hl7.org/fhir/observation-status",
    );
  });
});

describe("getMappingTypeOrFail", () => {
  test("returns correct config for valid type name", () => {
    const config = getMappingTypeOrFail("observation-code-loinc");
    expect(config.targetSystem).toBe("http://loinc.org");
  });

  test("returns correct config for patient-class", () => {
    const config = getMappingTypeOrFail("patient-class");
    expect(config.targetSystem).toBe(
      "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    );
  });

  test("throws error for unknown type name", () => {
    expect(() => getMappingTypeOrFail("unknown")).toThrow(
      "Unknown mapping type: unknown. Valid types: observation-code-loinc, patient-class, obr-status, obx-status",
    );
  });

  test("throws error for old task code used as type name", () => {
    expect(() => getMappingTypeOrFail("loinc-mapping")).toThrow(
      "Unknown mapping type: loinc-mapping",
    );
  });
});

describe("isMappingTypeName", () => {
  test("returns true for valid type names", () => {
    expect(isMappingTypeName("observation-code-loinc")).toBe(true);
    expect(isMappingTypeName("patient-class")).toBe(true);
    expect(isMappingTypeName("obr-status")).toBe(true);
    expect(isMappingTypeName("obx-status")).toBe(true);
  });

  test("returns false for invalid type names", () => {
    expect(isMappingTypeName("unknown")).toBe(false);
    expect(isMappingTypeName("address-type")).toBe(false);
    expect(isMappingTypeName("loinc-mapping")).toBe(false);
    expect(isMappingTypeName("")).toBe(false);
    expect(isMappingTypeName("LOINC")).toBe(false);
    expect(isMappingTypeName("loinc")).toBe(false); // Old type name should be invalid
  });
});
