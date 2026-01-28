/**
 * Unit tests for code-mapping validation module.
 */
import { describe, test, expect } from "bun:test";
import {
  validateResolvedCode,
  getValidValues,
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
    const validTypes = ["postal", "physical", "both"];

    test.each(validTypes)("accepts valid type: %s", (type) => {
      const result = validateResolvedCode("address-type", type);
      expect(result.valid).toBe(true);
    });

    test("rejects invalid type", () => {
      const result = validateResolvedCode("address-type", "home");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid Address type");
    });

    test("rejects work (that's Address.use, not type)", () => {
      const result = validateResolvedCode("address-type", "work");
      expect(result.valid).toBe(false);
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

  test("returns valid Address types", () => {
    const values = getValidValues("address-type");
    expect(values).toBeDefined();
    expect(values).toContain("postal");
    expect(values).toContain("physical");
    expect(values).toContain("both");
    expect(values!.length).toBe(3);
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
