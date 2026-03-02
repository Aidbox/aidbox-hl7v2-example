import { describe, test, expect } from "bun:test";
import { fromRXO } from "../../../../src/hl7v2/wrappers";
import type { HL7v2Segment } from "../../../../src/hl7v2/generated/types";

describe("fromRXO", () => {
  test("parses fully populated RXO segment", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        1: { 1: "med-code", 2: "Medication Name", 3: "RxNorm" },
        2: "10",
        3: "20",
        4: { 1: "mg", 2: "milligrams", 3: "UCUM" },
        5: { 1: "TAB", 2: "Tablet", 3: "form-system" },
        9: "T",
        11: "500",
        12: { 1: "mg", 2: "milligrams", 3: "UCUM" },
        13: "10",
        14: { 1: "DEA123", 2: "Smith", 3: "John" },
        18: "50",
        19: { 1: "mL/hr", 2: "milliliter per hour", 3: "UCUM" },
        25: "300",
        26: { 1: "mL", 2: "milliliter", 3: "UCUM" },
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$1_requestedGiveCode).toEqual({
      $1_code: "med-code",
      $2_text: "Medication Name",
      $3_system: "RxNorm",
    });
    expect(rxo.$2_requestedGiveAmountMin).toBe("10");
    expect(rxo.$3_requestedGiveAmountMax).toBe("20");
    expect(rxo.$4_requestedGiveUnits).toEqual({
      $1_code: "mg",
      $2_text: "milligrams",
      $3_system: "UCUM",
    });
    expect(rxo.$5_requestedDosageForm).toEqual({
      $1_code: "TAB",
      $2_text: "Tablet",
      $3_system: "form-system",
    });
    expect(rxo.$9_allowSubstitutions).toBe("T");
    expect(rxo.$11_requestedDispenseAmount).toBe("500");
    expect(rxo.$12_requestedDispenseUnits).toEqual({
      $1_code: "mg",
      $2_text: "milligrams",
      $3_system: "UCUM",
    });
    expect(rxo.$13_numberOfRefills).toBe("10");
    expect(rxo.$14_orderingProviderDea).toEqual([
      { $1_value: "DEA123", $2_family: { $1_family: "Smith" }, $3_given: "John" },
    ]);
    expect(rxo.$18_requestedGiveStrength).toBe("50");
    expect(rxo.$19_requestedGiveStrengthUnits).toEqual({
      $1_code: "mL/hr",
      $2_text: "milliliter per hour",
      $3_system: "UCUM",
    });
    expect(rxo.$25_requestedDrugStrengthVolume).toBe("300");
    expect(rxo.$26_requestedDrugStrengthVolumeUnits).toEqual({
      $1_code: "mL",
      $2_text: "milliliter",
      $3_system: "UCUM",
    });
  });

  test("parses minimal RXO segment with only RXO-1", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        1: { 1: "12345", 2: "Aspirin", 3: "NDC" },
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$1_requestedGiveCode).toEqual({
      $1_code: "12345",
      $2_text: "Aspirin",
      $3_system: "NDC",
    });
    expect(rxo.$2_requestedGiveAmountMin).toBeUndefined();
    expect(rxo.$3_requestedGiveAmountMax).toBeUndefined();
    expect(rxo.$4_requestedGiveUnits).toBeUndefined();
    expect(rxo.$5_requestedDosageForm).toBeUndefined();
    expect(rxo.$9_allowSubstitutions).toBeUndefined();
    expect(rxo.$11_requestedDispenseAmount).toBeUndefined();
    expect(rxo.$12_requestedDispenseUnits).toBeUndefined();
    expect(rxo.$13_numberOfRefills).toBeUndefined();
    expect(rxo.$14_orderingProviderDea).toBeUndefined();
    expect(rxo.$18_requestedGiveStrength).toBeUndefined();
    expect(rxo.$19_requestedGiveStrengthUnits).toBeUndefined();
    expect(rxo.$25_requestedDrugStrengthVolume).toBeUndefined();
    expect(rxo.$26_requestedDrugStrengthVolumeUnits).toBeUndefined();
  });

  test("parses empty RXO segment", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {},
    };

    const rxo = fromRXO(segment);

    expect(rxo).toEqual({});
  });

  test("parses CE fields with code-only values (string shorthand)", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        1: "simple-code",
        4: "mg",
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$1_requestedGiveCode).toEqual({ $1_code: "simple-code" });
    expect(rxo.$4_requestedGiveUnits).toEqual({ $1_code: "mg" });
  });

  test("parses CWE field with alternate coding (RXO-26)", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        26: {
          1: "mL",
          2: "milliliter",
          3: "UCUM",
          4: "alt-code",
          5: "alt-display",
          6: "alt-system",
          7: "2.0",
          8: "1.0",
          9: "original text",
        },
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$26_requestedDrugStrengthVolumeUnits).toEqual({
      $1_code: "mL",
      $2_text: "milliliter",
      $3_system: "UCUM",
      $4_altCode: "alt-code",
      $5_altDisplay: "alt-display",
      $6_altSystem: "alt-system",
      $7_version: "2.0",
      $8_altVersion: "1.0",
      $9_originalText: "original text",
    });
  });

  test("parses repeating XCN field (RXO-14) with multiple providers", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        14: [
          { 1: "DEA-001", 2: "Smith", 3: "John" },
          { 1: "DEA-002", 2: "Doe", 3: "Jane" },
        ],
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$14_orderingProviderDea).toEqual([
      { $1_value: "DEA-001", $2_family: { $1_family: "Smith" }, $3_given: "John" },
      { $1_value: "DEA-002", $2_family: { $1_family: "Doe" }, $3_given: "Jane" },
    ]);
  });

  test("parses CE field with alternate coding (RXO-1)", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        1: {
          1: "primary-code",
          2: "Primary Text",
          3: "primary-system",
          4: "alt-code",
          5: "Alt Text",
          6: "alt-system",
        },
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$1_requestedGiveCode).toEqual({
      $1_code: "primary-code",
      $2_text: "Primary Text",
      $3_system: "primary-system",
      $4_altCode: "alt-code",
      $5_altDisplay: "Alt Text",
      $6_altSystem: "alt-system",
    });
  });

  test("parses XCN field with string shorthand (single ID only)", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        14: "DEA-ONLY-ID",
      },
    };

    const rxo = fromRXO(segment);

    expect(rxo.$14_orderingProviderDea).toEqual([{ $1_value: "DEA-ONLY-ID" }]);
  });

  test("skips gaps in field numbering (fields 6-8, 10, 15-17, 20-24 not parsed)", () => {
    const segment: HL7v2Segment = {
      segment: "RXO",
      fields: {
        6: "should-be-ignored",
        7: "should-be-ignored",
        8: "should-be-ignored",
        10: "should-be-ignored",
        15: "should-be-ignored",
        16: "should-be-ignored",
        17: "should-be-ignored",
        20: "should-be-ignored",
      },
    };

    const rxo = fromRXO(segment);

    // None of the ignored fields should appear on the result
    expect(rxo).toEqual({});
  });
});
