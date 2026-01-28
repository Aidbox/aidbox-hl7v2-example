/**
 * Unit tests for code-mapping validation module.
 */
import { describe, test, expect } from "bun:test";
import {
  validateResolvedCode,
  getValidValues,
  getTargetSystemForCode,
} from "../../../src/code-mapping/validation";

describe("validateResolvedCode", () => {
  describe("LOINC validation", () => {
    test("accepts any non-empty LOINC code", () => {
      const result = validateResolvedCode("loinc", "2823-3");
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("accepts LOINC codes with various formats", () => {
      expect(validateResolvedCode("loinc", "12345-6").valid).toBe(true);
      expect(validateResolvedCode("loinc", "LP1234-5").valid).toBe(true);
      expect(validateResolvedCode("loinc", "LA12345-6").valid).toBe(true);
    });

    test("rejects empty LOINC code", () => {
      const result = validateResolvedCode("loinc", "");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });

    test("rejects whitespace-only LOINC code", () => {
      const result = validateResolvedCode("loinc", "   ");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("cannot be empty");
    });
  });

  describe("OBR status (DiagnosticReport.status) validation", () => {
    const validStatuses = [
      "registered",
      "preliminary",
      "partial",
      "corrected",
      "final",
      "cancelled",
      "entered-in-error",
      "unknown",
    ];

    test.each(validStatuses)("accepts valid status: %s", (status) => {
      const result = validateResolvedCode("obr-status", status);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("rejects invalid status", () => {
      const result = validateResolvedCode("obr-status", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid DiagnosticReport status");
      expect(result.error).toContain("invalid");
      expect(result.error).toContain("Valid values:");
    });

    test("rejects empty status", () => {
      const result = validateResolvedCode("obr-status", "");
      expect(result.valid).toBe(false);
    });

    test("is case-sensitive", () => {
      const result = validateResolvedCode("obr-status", "Final");
      expect(result.valid).toBe(false);
    });
  });

  describe("OBX status (Observation.status) validation", () => {
    const validStatuses = [
      "registered",
      "preliminary",
      "final",
      "amended",
      "corrected",
      "cancelled",
      "entered-in-error",
      "unknown",
    ];

    test.each(validStatuses)("accepts valid status: %s", (status) => {
      const result = validateResolvedCode("obx-status", status);
      expect(result.valid).toBe(true);
    });

    test("rejects invalid status", () => {
      const result = validateResolvedCode("obx-status", "bad-status");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid Observation status");
    });

    test("observation status excludes partial (unlike DiagnosticReport)", () => {
      const result = validateResolvedCode("obx-status", "partial");
      expect(result.valid).toBe(false);
    });
  });

  describe("Address type validation", () => {
    // Address-type mapping can resolve to either Address.type or Address.use
    const validTypes = ["postal", "physical", "both"];
    const validUses = ["home", "work", "temp", "old", "billing"];

    test.each(validTypes)("accepts valid Address.type: %s", (type) => {
      const result = validateResolvedCode("address-type", type);
      expect(result.valid).toBe(true);
    });

    test.each(validUses)("accepts valid Address.use: %s", (use) => {
      const result = validateResolvedCode("address-type", use);
      expect(result.valid).toBe(true);
    });

    test("rejects invalid value", () => {
      const result = validateResolvedCode("address-type", "invalid");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid Address type/use");
    });
  });

  describe("Patient class (Encounter.class) validation", () => {
    const validClasses = [
      "AMB",
      "EMER",
      "FLD",
      "HH",
      "IMP",
      "ACUTE",
      "NONAC",
      "OBSENC",
      "PRENC",
      "SS",
      "VR",
    ];

    test.each(validClasses)("accepts valid class: %s", (classCode) => {
      const result = validateResolvedCode("patient-class", classCode);
      expect(result.valid).toBe(true);
    });

    test("rejects invalid class", () => {
      const result = validateResolvedCode("patient-class", "INVALID");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid Encounter class");
    });

    test("is case-sensitive (codes are uppercase)", () => {
      const result = validateResolvedCode("patient-class", "amb");
      expect(result.valid).toBe(false);
    });
  });
});

describe("getValidValues", () => {
  test("returns undefined for LOINC (no fixed set)", () => {
    const values = getValidValues("loinc");
    expect(values).toBeUndefined();
  });

  test("returns valid DiagnosticReport statuses for obr-status", () => {
    const values = getValidValues("obr-status");
    expect(values).toBeDefined();
    expect(values).toContain("final");
    expect(values).toContain("preliminary");
    expect(values).toContain("partial");
    expect(values).toContain("amended");
    expect(values).toContain("appended");
    expect(values!.length).toBe(10);
  });

  test("returns valid Observation statuses for obx-status", () => {
    const values = getValidValues("obx-status");
    expect(values).toBeDefined();
    expect(values).toContain("final");
    expect(values).toContain("amended");
    expect(values).not.toContain("partial"); // Not valid for Observation
    expect(values!.length).toBe(8);
  });

  test("returns valid Address types and uses", () => {
    const values = getValidValues("address-type");
    expect(values).toBeDefined();
    // Address.type values
    expect(values).toContain("postal");
    expect(values).toContain("physical");
    expect(values).toContain("both");
    // Address.use values
    expect(values).toContain("home");
    expect(values).toContain("work");
    expect(values).toContain("temp");
    expect(values).toContain("old");
    expect(values).toContain("billing");
    // 3 type + 5 use = 8 total
    expect(values!.length).toBe(8);
  });

  test("returns valid Encounter classes", () => {
    const values = getValidValues("patient-class");
    expect(values).toBeDefined();
    expect(values).toContain("AMB");
    expect(values).toContain("EMER");
    expect(values).toContain("IMP");
    expect(values!.length).toBe(11);
  });
});

describe("getTargetSystemForCode", () => {
  describe("address-type mapping", () => {
    const defaultSystem = "http://hl7.org/fhir/address-type";

    test("returns address-type system for Address.type values", () => {
      expect(getTargetSystemForCode("address-type", "postal", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-type",
      );
      expect(getTargetSystemForCode("address-type", "physical", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-type",
      );
      expect(getTargetSystemForCode("address-type", "both", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-type",
      );
    });

    test("returns address-use system for Address.use values", () => {
      expect(getTargetSystemForCode("address-type", "home", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-use",
      );
      expect(getTargetSystemForCode("address-type", "work", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-use",
      );
      expect(getTargetSystemForCode("address-type", "temp", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-use",
      );
      expect(getTargetSystemForCode("address-type", "old", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-use",
      );
      expect(getTargetSystemForCode("address-type", "billing", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-use",
      );
    });

    test("returns default system for unknown codes", () => {
      // Unknown codes would fail validation, but if they somehow got through,
      // they should use the default address-type system
      expect(getTargetSystemForCode("address-type", "unknown", defaultSystem)).toBe(
        "http://hl7.org/fhir/address-type",
      );
    });
  });

  describe("other mapping types", () => {
    test("returns default system for loinc", () => {
      const defaultSystem = "http://loinc.org";
      expect(getTargetSystemForCode("loinc", "2823-3", defaultSystem)).toBe(defaultSystem);
    });

    test("returns default system for obr-status", () => {
      const defaultSystem = "http://hl7.org/fhir/diagnostic-report-status";
      expect(getTargetSystemForCode("obr-status", "final", defaultSystem)).toBe(defaultSystem);
    });

    test("returns default system for obx-status", () => {
      const defaultSystem = "http://hl7.org/fhir/observation-status";
      expect(getTargetSystemForCode("obx-status", "final", defaultSystem)).toBe(defaultSystem);
    });

    test("returns default system for patient-class", () => {
      const defaultSystem = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
      expect(getTargetSystemForCode("patient-class", "AMB", defaultSystem)).toBe(defaultSystem);
    });
  });
});
