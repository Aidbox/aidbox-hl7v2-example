import { describe, test, expect } from "bun:test";
import {
  MAPPING_TYPES,
  getMappingType,
  getMappingTypeOrFail,
  getMappingTypeName,
  isMappingTypeName,
  type MappingTypeName,
} from "../../../src/code-mapping/mapping-types";

describe("MAPPING_TYPES registry", () => {
  test("contains all required mapping types", () => {
    const expectedTypes: MappingTypeName[] = [
      "loinc",
      "address-type",
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
      "taskCode",
      "taskDisplay",
      "targetSystem",
      "conceptMapSuffix",
      "sourceField",
      "targetField",
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

  test("loinc type has correct configuration", () => {
    expect(MAPPING_TYPES.loinc).toEqual({
      taskCode: "loinc-mapping",
      taskDisplay: "Local code to LOINC mapping",
      targetSystem: "http://loinc.org",
      conceptMapSuffix: "-to-loinc",
      sourceField: "OBX-3",
      targetField: "Observation.code",
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

describe("getMappingType", () => {
  test("returns correct type for valid task code", () => {
    const config = getMappingType("loinc-mapping");
    expect(config.taskCode).toBe("loinc-mapping");
    expect(config.targetSystem).toBe("http://loinc.org");
  });

  test("returns correct type for obr-status-mapping task code", () => {
    const config = getMappingType("obr-status-mapping");
    expect(config.taskCode).toBe("obr-status-mapping");
    expect(config.targetSystem).toBe(
      "http://hl7.org/fhir/diagnostic-report-status",
    );
  });

  test("supports legacy local-to-loinc-mapping task code", () => {
    const config = getMappingType("local-to-loinc-mapping");
    expect(config.taskCode).toBe("loinc-mapping");
    expect(config.targetSystem).toBe("http://loinc.org");
  });

  test("throws error for unknown task code", () => {
    expect(() => getMappingType("unknown-mapping")).toThrow(
      "Unknown mapping task code: unknown-mapping. Add it to MAPPING_TYPES registry.",
    );
  });

  test("throws error for empty task code", () => {
    expect(() => getMappingType("")).toThrow(
      "Unknown mapping task code: . Add it to MAPPING_TYPES registry.",
    );
  });
});

describe("getMappingTypeOrFail", () => {
  test("returns correct config for valid type name", () => {
    const config = getMappingTypeOrFail("loinc");
    expect(config.taskCode).toBe("loinc-mapping");
  });

  test("returns correct config for address-type", () => {
    const config = getMappingTypeOrFail("address-type");
    expect(config.taskCode).toBe("address-type-mapping");
    expect(config.targetSystem).toBe("http://hl7.org/fhir/address-type");
  });

  test("returns correct config for patient-class", () => {
    const config = getMappingTypeOrFail("patient-class");
    expect(config.taskCode).toBe("patient-class-mapping");
    expect(config.targetSystem).toBe(
      "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    );
  });

  test("throws error for unknown type name", () => {
    expect(() => getMappingTypeOrFail("unknown")).toThrow(
      "Unknown mapping type: unknown. Valid types: loinc, address-type, patient-class, obr-status, obx-status",
    );
  });

  test("throws error for task code used as type name", () => {
    expect(() => getMappingTypeOrFail("loinc-mapping")).toThrow(
      "Unknown mapping type: loinc-mapping",
    );
  });
});

describe("getMappingTypeName", () => {
  test("returns type name for valid task code", () => {
    expect(getMappingTypeName("loinc-mapping")).toBe("loinc");
    expect(getMappingTypeName("address-type-mapping")).toBe("address-type");
    expect(getMappingTypeName("patient-class-mapping")).toBe("patient-class");
    expect(getMappingTypeName("obr-status-mapping")).toBe("obr-status");
    expect(getMappingTypeName("obx-status-mapping")).toBe("obx-status");
  });

  test("supports legacy task code", () => {
    expect(getMappingTypeName("local-to-loinc-mapping")).toBe("loinc");
  });

  test("throws error for unknown task code", () => {
    expect(() => getMappingTypeName("unknown-mapping")).toThrow(
      "Unknown mapping task code: unknown-mapping. Add it to MAPPING_TYPES registry.",
    );
  });
});

describe("isMappingTypeName", () => {
  test("returns true for valid type names", () => {
    expect(isMappingTypeName("loinc")).toBe(true);
    expect(isMappingTypeName("address-type")).toBe(true);
    expect(isMappingTypeName("patient-class")).toBe(true);
    expect(isMappingTypeName("obr-status")).toBe(true);
    expect(isMappingTypeName("obx-status")).toBe(true);
  });

  test("returns false for invalid type names", () => {
    expect(isMappingTypeName("unknown")).toBe(false);
    expect(isMappingTypeName("loinc-mapping")).toBe(false);
    expect(isMappingTypeName("")).toBe(false);
    expect(isMappingTypeName("LOINC")).toBe(false);
  });
});
