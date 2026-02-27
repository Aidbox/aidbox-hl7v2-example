import { describe, test, expect } from "bun:test";
import type { RXO } from "../../../../src/hl7v2/wrappers/rxo";
import { convertRXOToMedicationRequest } from "../../../../src/v2-to-fhir/segments/rxo-medicationrequest";

function makeRXO(overrides: Partial<RXO> = {}): RXO {
  return {
    $1_requestedGiveCode: { $1_code: "RX001", $2_text: "Amoxicillin", $3_system: "NDC" },
    ...overrides,
  };
}

// ============================================================================
// Intent
// ============================================================================

describe("intent", () => {
  test("intent is always 'original-order'", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "active");

    expect(result.intent).toBe("original-order");
  });

  test("intent remains 'original-order' regardless of status", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "completed");

    expect(result.intent).toBe("original-order");
  });
});

// ============================================================================
// Status adaptation
// ============================================================================

describe("status adaptation", () => {
  test("'revoked' adapted to 'cancelled' for MedicationRequest", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "revoked");

    expect(result.status).toBe("cancelled");
  });

  test("'active' passes through unchanged", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "active");

    expect(result.status).toBe("active");
  });

  test("'completed' passes through unchanged", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "completed");

    expect(result.status).toBe("completed");
  });

  test("'on-hold' passes through unchanged", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "on-hold");

    expect(result.status).toBe("on-hold");
  });

  test("'entered-in-error' passes through unchanged", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "entered-in-error");

    expect(result.status).toBe("entered-in-error");
  });

  test("'unknown' passes through unchanged", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "unknown");

    expect(result.status).toBe("unknown");
  });

  test("'draft' passes through unchanged", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "draft");

    expect(result.status).toBe("draft");
  });
});

// ============================================================================
// RXO-1 -> medicationCodeableConcept
// ============================================================================

describe("RXO-1 -> medicationCodeableConcept", () => {
  test("RXO-1 maps to medicationCodeableConcept", () => {
    const rxo = makeRXO({
      $1_requestedGiveCode: { $1_code: "RX001", $2_text: "Amoxicillin 500mg", $3_system: "NDC" },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.medicationCodeableConcept).toBeDefined();
    expect(result.medicationCodeableConcept!.coding![0]!.code).toBe("RX001");
    expect(result.medicationCodeableConcept!.coding![0]!.display).toBe("Amoxicillin 500mg");
    expect(result.medicationCodeableConcept!.coding![0]!.system).toBe("NDC");
  });

  test("RXO-1 with alternate coding includes both codings", () => {
    const rxo = makeRXO({
      $1_requestedGiveCode: {
        $1_code: "RX001",
        $2_text: "Amoxicillin",
        $3_system: "NDC",
        $4_altCode: "723",
        $5_altDisplay: "Amoxicillin Cap",
        $6_altSystem: "LOCAL",
      },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.medicationCodeableConcept!.coding).toHaveLength(2);
    expect(result.medicationCodeableConcept!.coding![1]!.code).toBe("723");
    expect(result.medicationCodeableConcept!.coding![1]!.system).toBe("LOCAL");
  });

  test("no RXO-1 -> no medicationCodeableConcept", () => {
    const rxo = makeRXO({ $1_requestedGiveCode: undefined });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.medicationCodeableConcept).toBeUndefined();
  });
});

// ============================================================================
// RXO-2/3/4 -> dosageInstruction doseRange
// ============================================================================

describe("RXO-2/3/4 -> dosageInstruction doseRange", () => {
  test("RXO-2/3/4 maps to doseRange with low, high, and units", () => {
    const rxo = makeRXO({
      $2_requestedGiveAmountMin: "500",
      $3_requestedGiveAmountMax: "1000",
      $4_requestedGiveUnits: { $1_code: "mg", $3_system: "http://unitsofmeasure.org" },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dosageInstruction).toBeDefined();
    expect(result.dosageInstruction).toHaveLength(1);
    const doseAndRate = result.dosageInstruction![0]!.doseAndRate as any[];
    expect(doseAndRate).toHaveLength(1);
    const doseRange = doseAndRate[0].doseRange;
    expect(doseRange.low.value).toBe(500);
    expect(doseRange.low.code).toBe("mg");
    expect(doseRange.low.system).toBe("http://unitsofmeasure.org");
    expect(doseRange.high.value).toBe(1000);
    expect(doseRange.high.code).toBe("mg");
    expect(doseRange.high.system).toBe("http://unitsofmeasure.org");
  });

  test("RXO-2 only (no max) -> doseRange.low only", () => {
    const rxo = makeRXO({
      $2_requestedGiveAmountMin: "250",
      $3_requestedGiveAmountMax: undefined,
      $4_requestedGiveUnits: { $1_code: "mg" },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    const doseAndRate = result.dosageInstruction![0]!.doseAndRate as any[];
    const doseRange = doseAndRate[0].doseRange;
    expect(doseRange.low.value).toBe(250);
    expect(doseRange.low.code).toBe("mg");
    expect(doseRange.high).toBeUndefined();
  });

  test("RXO-2 without units -> doseRange with value only", () => {
    const rxo = makeRXO({
      $2_requestedGiveAmountMin: "10",
      $3_requestedGiveAmountMax: "20",
      $4_requestedGiveUnits: undefined,
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    const doseAndRate = result.dosageInstruction![0]!.doseAndRate as any[];
    const doseRange = doseAndRate[0].doseRange;
    expect(doseRange.low.value).toBe(10);
    expect(doseRange.low.code).toBeUndefined();
    expect(doseRange.high.value).toBe(20);
    expect(doseRange.high.code).toBeUndefined();
  });

  test("no RXO-2 -> no dosageInstruction", () => {
    const rxo = makeRXO({
      $2_requestedGiveAmountMin: undefined,
      $3_requestedGiveAmountMax: "1000",
      $4_requestedGiveUnits: { $1_code: "mg" },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dosageInstruction).toBeUndefined();
  });
});

// ============================================================================
// RXO-9 -> substitution
// ============================================================================

describe("RXO-9 -> substitution", () => {
  test("RXO-9 'T' maps to allowed substitution", () => {
    const rxo = makeRXO({ $9_allowSubstitutions: "T" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.substitution).toBeDefined();
    const coding = result.substitution!.allowedCodeableConcept!.coding![0]!;
    expect(coding.code).toBe("E");
    expect(coding.display).toBe("Equivalent");
  });

  test("RXO-9 'Y' maps to allowed substitution", () => {
    const rxo = makeRXO({ $9_allowSubstitutions: "Y" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.substitution).toBeDefined();
    expect(result.substitution!.allowedCodeableConcept!.coding![0]!.code).toBe("E");
  });

  test("RXO-9 'N' maps to not-allowed substitution", () => {
    const rxo = makeRXO({ $9_allowSubstitutions: "N" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.substitution).toBeDefined();
    const coding = result.substitution!.allowedCodeableConcept!.coding![0]!;
    expect(coding.code).toBe("N");
    expect(coding.display).toBe("None");
  });

  test("RXO-9 is case-insensitive", () => {
    const rxo = makeRXO({ $9_allowSubstitutions: "t" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.substitution).toBeDefined();
    expect(result.substitution!.allowedCodeableConcept!.coding![0]!.code).toBe("E");
  });

  test("no RXO-9 -> no substitution", () => {
    const rxo = makeRXO({ $9_allowSubstitutions: undefined });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.substitution).toBeUndefined();
  });

  test("unknown RXO-9 value -> no substitution", () => {
    const rxo = makeRXO({ $9_allowSubstitutions: "X" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.substitution).toBeUndefined();
  });
});

// ============================================================================
// RXO-11/12 -> dispenseRequest.quantity
// ============================================================================

describe("RXO-11/12 -> dispenseRequest.quantity", () => {
  test("RXO-11/12 maps to dispenseRequest quantity with units", () => {
    const rxo = makeRXO({
      $11_requestedDispenseAmount: "30",
      $12_requestedDispenseUnits: { $1_code: "TAB", $3_system: "http://unitsofmeasure.org" },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dispenseRequest).toBeDefined();
    expect(result.dispenseRequest!.quantity!.value).toBe(30);
    expect(result.dispenseRequest!.quantity!.code).toBe("TAB");
    expect(result.dispenseRequest!.quantity!.unit).toBe("TAB");
    expect(result.dispenseRequest!.quantity!.system).toBe("http://unitsofmeasure.org");
  });

  test("RXO-11 without units -> quantity with value only", () => {
    const rxo = makeRXO({
      $11_requestedDispenseAmount: "60",
      $12_requestedDispenseUnits: undefined,
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dispenseRequest!.quantity!.value).toBe(60);
    expect(result.dispenseRequest!.quantity!.code).toBeUndefined();
  });

  test("no RXO-11 -> no dispenseRequest quantity", () => {
    const rxo = makeRXO({
      $11_requestedDispenseAmount: undefined,
      $12_requestedDispenseUnits: { $1_code: "TAB" },
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    // dispenseRequest might still exist if RXO-13 is present, but quantity should not be set
    expect(result.dispenseRequest?.quantity).toBeUndefined();
  });
});

// ============================================================================
// RXO-13 -> dispenseRequest.numberOfRepeatsAllowed
// ============================================================================

describe("RXO-13 -> dispenseRequest.numberOfRepeatsAllowed", () => {
  test("RXO-13 maps to numberOfRepeatsAllowed", () => {
    const rxo = makeRXO({ $13_numberOfRefills: "3" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dispenseRequest).toBeDefined();
    expect(result.dispenseRequest!.numberOfRepeatsAllowed).toBe(3);
  });

  test("RXO-13 '0' maps to 0 refills", () => {
    const rxo = makeRXO({ $13_numberOfRefills: "0" });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dispenseRequest!.numberOfRepeatsAllowed).toBe(0);
  });

  test("no RXO-13 and no RXO-11 -> no dispenseRequest", () => {
    const rxo = makeRXO({
      $11_requestedDispenseAmount: undefined,
      $13_numberOfRefills: undefined,
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dispenseRequest).toBeUndefined();
  });

  test("RXO-11 and RXO-13 both present -> dispenseRequest has both", () => {
    const rxo = makeRXO({
      $11_requestedDispenseAmount: "30",
      $12_requestedDispenseUnits: { $1_code: "TAB" },
      $13_numberOfRefills: "5",
    });

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.dispenseRequest!.quantity!.value).toBe(30);
    expect(result.dispenseRequest!.numberOfRepeatsAllowed).toBe(5);
  });
});

// ============================================================================
// resourceType
// ============================================================================

describe("resourceType", () => {
  test("resourceType is always 'MedicationRequest'", () => {
    const result = convertRXOToMedicationRequest(makeRXO(), "active");

    expect(result.resourceType).toBe("MedicationRequest");
  });
});

// ============================================================================
// Minimal RXO (no optional fields)
// ============================================================================

describe("minimal RXO", () => {
  test("empty RXO produces MedicationRequest with only required fields", () => {
    const rxo: RXO = {};

    const result = convertRXOToMedicationRequest(rxo, "active");

    expect(result.resourceType).toBe("MedicationRequest");
    expect(result.intent).toBe("original-order");
    expect(result.status).toBe("active");
    expect(result.medicationCodeableConcept).toBeUndefined();
    expect(result.dosageInstruction).toBeUndefined();
    expect(result.substitution).toBeUndefined();
    expect(result.dispenseRequest).toBeUndefined();
  });
});
