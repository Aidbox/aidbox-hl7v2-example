import { describe, test, expect } from "bun:test";
import {
  MAPPING_TYPES,
  getMappingTypeOrFail,
  isMappingTypeName,
  sourceLabel,
  targetLabel,
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

  test("each type has all required structured fields", () => {
    for (const [typeName, config] of Object.entries(MAPPING_TYPES)) {
      expect(config.source.segment, `${typeName} missing source.segment`).toBeDefined();
      expect(config.source.field, `${typeName} missing source.field`).toBeDefined();
      expect(config.target.resource, `${typeName} missing target.resource`).toBeDefined();
      expect(config.target.field, `${typeName} missing target.field`).toBeDefined();
      expect(config.targetSystem, `${typeName} missing targetSystem`).toBeDefined();
    }
  });

  test("source.field is always a number", () => {
    for (const [typeName, config] of Object.entries(MAPPING_TYPES)) {
      expect(typeof config.source.field, `${typeName} source.field should be number`).toBe("number");
    }
  });

  test("observation-code-loinc type has correct configuration", () => {
    expect(MAPPING_TYPES["observation-code-loinc"]).toEqual({
      source: { segment: "OBX", field: 3 },
      target: { resource: "Observation", field: "code" },
      targetSystem: "http://loinc.org",
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

describe("derivation helpers", () => {
  test("sourceLabel produces HL7v2 dash notation for each type", () => {
    expect(sourceLabel(MAPPING_TYPES["observation-code-loinc"])).toBe("OBX-3");
    expect(sourceLabel(MAPPING_TYPES["patient-class"])).toBe("PV1-2");
    expect(sourceLabel(MAPPING_TYPES["obr-status"])).toBe("OBR-25");
    expect(sourceLabel(MAPPING_TYPES["obx-status"])).toBe("OBX-11");
  });

  test("targetLabel produces FHIR Resource.field notation for each type", () => {
    expect(targetLabel(MAPPING_TYPES["observation-code-loinc"])).toBe("Observation.code");
    expect(targetLabel(MAPPING_TYPES["patient-class"])).toBe("Encounter.class");
    expect(targetLabel(MAPPING_TYPES["obr-status"])).toBe("DiagnosticReport.status");
    expect(targetLabel(MAPPING_TYPES["obx-status"])).toBe("Observation.status");
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
    expect(isMappingTypeName("loinc")).toBe(false);
  });
});
