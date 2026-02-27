import { describe, test, expect } from "bun:test";
import {
  convertRXAToImmunization,
  deriveImmunizationStatus,
  type RXAConversionResult,
} from "../../../../src/v2-to-fhir/segments/rxa-immunization";
import type { RXA } from "../../../../src/hl7v2/generated/fields";
import type { Reference } from "../../../../src/fhir/hl7-fhir-r4-core";

const patientReference: Reference<"Patient"> = { reference: "Patient/test-patient-id" };

function makeBaseRXA(overrides: Partial<RXA> = {}): RXA {
  return {
    $1_subIdCounter: "0",
    $2_administrationSubIdCounter: "1",
    $3_startAdministrationDateTime: "20160701",
    $4_endAdministrationDateTime: "20160701",
    $5_administeredCode: { $1_code: "08", $2_text: "HEPB-ADOLESCENT OR PEDIATRIC", $3_system: "CVX" },
    $6_administeredAmount: "0.5",
    ...overrides,
  };
}

function expectImmunization(result: RXAConversionResult | { error: string }): RXAConversionResult {
  if ("error" in result) {
    throw new Error(`Expected RXAConversionResult but got error: ${result.error}`);
  }
  return result;
}

describe("deriveImmunizationStatus", () => {
  test("CP → completed", () => {
    expect(deriveImmunizationStatus("CP", undefined)).toBe("completed");
  });

  test("PA → completed", () => {
    expect(deriveImmunizationStatus("PA", undefined)).toBe("completed");
  });

  test("RE → not-done", () => {
    expect(deriveImmunizationStatus("RE", undefined)).toBe("not-done");
  });

  test("NA → not-done", () => {
    expect(deriveImmunizationStatus("NA", undefined)).toBe("not-done");
  });

  test("empty string → completed", () => {
    expect(deriveImmunizationStatus("", undefined)).toBe("completed");
  });

  test("undefined → completed", () => {
    expect(deriveImmunizationStatus(undefined, undefined)).toBe("completed");
  });

  test("RXA-21=D overrides any RXA-20 value → entered-in-error", () => {
    expect(deriveImmunizationStatus("CP", "D")).toBe("entered-in-error");
    expect(deriveImmunizationStatus("RE", "D")).toBe("entered-in-error");
    expect(deriveImmunizationStatus(undefined, "D")).toBe("entered-in-error");
  });

  test("RXA-21=A does not override RXA-20", () => {
    expect(deriveImmunizationStatus("CP", "A")).toBe("completed");
    expect(deriveImmunizationStatus("RE", "A")).toBe("not-done");
  });

  test("case insensitive: 'cp' → completed", () => {
    expect(deriveImmunizationStatus("cp", undefined)).toBe("completed");
    expect(deriveImmunizationStatus("re", undefined)).toBe("not-done");
    expect(deriveImmunizationStatus("CP", "d")).toBe("entered-in-error");
  });

  test("unknown value → completed", () => {
    expect(deriveImmunizationStatus("XY", undefined)).toBe("completed");
  });
});

describe("convertRXAToImmunization", () => {
  describe("core fields", () => {
    test("maps RXA-3 to occurrenceDateTime", () => {
      const rxa = makeBaseRXA({ $3_startAdministrationDateTime: "20160701123030" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.occurrenceDateTime).toBe("2016-07-01T12:30:30Z");
    });

    test("maps RXA-5 to vaccineCode with normalized CVX system", () => {
      const rxa = makeBaseRXA({
        $5_administeredCode: {
          $1_code: "08",
          $2_text: "HEPB-ADOLESCENT OR PEDIATRIC",
          $3_system: "CVX",
        },
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.vaccineCode.coding?.[0]?.code).toBe("08");
      expect(immunization.vaccineCode.coding?.[0]?.display).toBe("HEPB-ADOLESCENT OR PEDIATRIC");
      expect(immunization.vaccineCode.coding?.[0]?.system).toBe("http://hl7.org/fhir/sid/cvx");
    });

    test("preserves alternate coding in vaccineCode (e.g., NDC)", () => {
      const rxa = makeBaseRXA({
        $5_administeredCode: {
          $1_code: "08",
          $2_text: "HEPB",
          $3_system: "CVX",
          $4_altCode: "49281-0215-10",
          $5_altDisplay: "ENGERIX-B",
          $6_altSystem: "NDC",
        },
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.vaccineCode.coding).toHaveLength(2);
      expect(immunization.vaccineCode.coding?.[1]?.code).toBe("49281-0215-10");
      expect(immunization.vaccineCode.coding?.[1]?.system).toBe("http://hl7.org/fhir/sid/ndc");
    });

    test("sets immunizationId from pre-computed value", () => {
      const rxa = makeBaseRXA();

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "dcs-65930", patientReference),
      );

      expect(immunization.id).toBe("dcs-65930");
    });

    test("sets patient reference", () => {
      const rxa = makeBaseRXA();

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.patient.reference).toBe("Patient/test-patient-id");
    });

    test("returns error when RXA-3 is empty", () => {
      const rxa = makeBaseRXA({ $3_startAdministrationDateTime: "" });

      const result = convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("RXA-3");
      }
    });

    test("returns error when RXA-5 is missing", () => {
      const rxa = makeBaseRXA({ $5_administeredCode: {} as any });

      const result = convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("RXA-5");
      }
    });
  });

  describe("status mapping", () => {
    test("status=completed when RXA-20=CP", () => {
      const rxa = makeBaseRXA({ $20_completionStatus: "CP" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("completed");
    });

    test("status=not-done when RXA-20=RE", () => {
      const rxa = makeBaseRXA({ $20_completionStatus: "RE" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("not-done");
    });

    test("status=not-done when RXA-20=NA", () => {
      const rxa = makeBaseRXA({ $20_completionStatus: "NA" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("not-done");
    });

    test("status=entered-in-error when RXA-21=D (overrides RXA-20=CP)", () => {
      const rxa = makeBaseRXA({ $20_completionStatus: "CP", $21_actionCodeRxa: "D" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("entered-in-error");
    });

    test("status=completed with isSubpotent=true when RXA-20=PA", () => {
      const rxa = makeBaseRXA({ $20_completionStatus: "PA" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("completed");
      expect(immunization.isSubpotent).toBe(true);
    });

    test("status=completed when RXA-20 is missing", () => {
      const rxa = makeBaseRXA({ $20_completionStatus: undefined });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("completed");
      expect(immunization.isSubpotent).toBeUndefined();
    });
  });

  describe("doseQuantity", () => {
    test("maps RXA-6/7 to doseQuantity with value and unit", () => {
      const rxa = makeBaseRXA({
        $6_administeredAmount: "0.5",
        $7_administeredUnit: { $1_code: "mL", $2_text: "milliliter", $3_system: "UCUM" },
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.doseQuantity?.value).toBe(0.5);
      expect(immunization.doseQuantity?.unit).toBe("milliliter");
      expect(immunization.doseQuantity?.code).toBe("mL");
      expect(immunization.doseQuantity?.system).toBe("http://unitsofmeasure.org");
    });

    test("doseQuantity omitted when RXA-6 is empty (cleared by preprocessor for '999')", () => {
      const rxa = makeBaseRXA({ $6_administeredAmount: "" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.doseQuantity).toBeUndefined();
    });

    test("doseQuantity preserved when RXA-6 is '0' (valid zero dose)", () => {
      const rxa = makeBaseRXA({ $6_administeredAmount: "0" });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.doseQuantity?.value).toBe(0);
    });

    test("doseQuantity with value only (no RXA-7 unit)", () => {
      const rxa = makeBaseRXA({
        $6_administeredAmount: "1",
        $7_administeredUnit: undefined,
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.doseQuantity?.value).toBe(1);
      expect(immunization.doseQuantity?.unit).toBeUndefined();
    });
  });

  describe("lotNumber and expirationDate", () => {
    test("maps RXA-15 first value to lotNumber", () => {
      const rxa = makeBaseRXA({ $15_lotNumber: ["MSD456789", "SECOND"] });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.lotNumber).toBe("MSD456789");
    });

    test("lotNumber omitted when RXA-15 is empty", () => {
      const rxa = makeBaseRXA({ $15_lotNumber: undefined });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.lotNumber).toBeUndefined();
    });

    test("maps RXA-16 first value to expirationDate", () => {
      const rxa = makeBaseRXA({ $16_expiration: ["20241231"] });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.expirationDate).toBe("2024-12-31");
    });

    test("expirationDate omitted when RXA-16 is empty", () => {
      const rxa = makeBaseRXA({ $16_expiration: undefined });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.expirationDate).toBeUndefined();
    });
  });

  describe("base fixture — comprehensive fields", () => {
    test("produces complete Immunization from typical VXU data", () => {
      const rxa = makeBaseRXA({
        $3_startAdministrationDateTime: "20160701",
        $5_administeredCode: {
          $1_code: "08",
          $2_text: "HEPB-ADOLESCENT OR PEDIATRIC",
          $3_system: "CVX",
        },
        $6_administeredAmount: "",
        $15_lotNumber: ["MSD456789"],
        $20_completionStatus: undefined,
        $21_actionCodeRxa: "A",
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "dcs-65930", patientReference),
      );

      expect(immunization.resourceType).toBe("Immunization");
      expect(immunization.id).toBe("dcs-65930");
      expect(immunization.status).toBe("completed");
      expect(immunization.vaccineCode.coding?.[0]?.code).toBe("08");
      expect(immunization.vaccineCode.coding?.[0]?.system).toBe("http://hl7.org/fhir/sid/cvx");
      expect(immunization.occurrenceDateTime).toBe("2016-07-01");
      // After preprocessing, "999" is cleared to empty string → no doseQuantity
      expect(immunization.doseQuantity).toBeUndefined();
      expect(immunization.lotNumber).toBe("MSD456789");
      expect(immunization.patient.reference).toBe("Patient/test-patient-id");
    });
  });
});
