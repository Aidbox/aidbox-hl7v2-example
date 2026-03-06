import { describe, test, expect } from "bun:test";
import {
  convertRXAToImmunization,
  deriveImmunizationStatus,
  type RXAConversionResult,
} from "../../../../src/v2-to-fhir/segments/rxa-immunization";
import type { RXA, RXR, ORC } from "../../../../src/hl7v2/generated/fields";
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

  describe("statusReason (RXA-18)", () => {
    test("populates statusReason when status=not-done (RXA-20=RE) and RXA-18 present", () => {
      const rxa = makeBaseRXA({
        $20_completionStatus: "RE",
        $18_substanceTreatmentRefusalReason: [
          { $1_code: "00", $2_text: "Parental decision", $3_system: "NIP002" },
        ],
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("not-done");
      expect(immunization.statusReason?.coding?.[0]?.code).toBe("00");
      expect(immunization.statusReason?.coding?.[0]?.display).toBe("Parental decision");
    });

    test("omits statusReason when status=not-done (RXA-20=NA) without RXA-18", () => {
      const rxa = makeBaseRXA({
        $20_completionStatus: "NA",
        $18_substanceTreatmentRefusalReason: undefined,
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("not-done");
      expect(immunization.statusReason).toBeUndefined();
    });

    test("omits statusReason when status=entered-in-error (RXA-21=D) even if RXA-18 present", () => {
      const rxa = makeBaseRXA({
        $20_completionStatus: "RE",
        $21_actionCodeRxa: "D",
        $18_substanceTreatmentRefusalReason: [
          { $1_code: "00", $2_text: "Parental decision", $3_system: "NIP002" },
        ],
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("entered-in-error");
      expect(immunization.statusReason).toBeUndefined();
    });

    test("omits statusReason when status=completed even if RXA-18 present", () => {
      const rxa = makeBaseRXA({
        $20_completionStatus: "CP",
        $18_substanceTreatmentRefusalReason: [
          { $1_code: "00", $2_text: "Parental decision", $3_system: "NIP002" },
        ],
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.status).toBe("completed");
      expect(immunization.statusReason).toBeUndefined();
    });
  });

  describe("reasonCode (RXA-19)", () => {
    test("maps RXA-19 indications to reasonCode[]", () => {
      const rxa = makeBaseRXA({
        $19_indication: [
          { $1_code: "070.30", $2_text: "Hepatitis B", $3_system: "ICD9CM" },
          { $1_code: "B18.1", $2_text: "Chronic hepatitis B", $3_system: "ICD10CM" },
        ],
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.reasonCode).toHaveLength(2);
      expect(immunization.reasonCode?.[0]?.coding?.[0]?.code).toBe("070.30");
      expect(immunization.reasonCode?.[1]?.coding?.[0]?.code).toBe("B18.1");
    });

    test("omits reasonCode when RXA-19 is empty", () => {
      const rxa = makeBaseRXA({ $19_indication: undefined });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.reasonCode).toBeUndefined();
    });

    test("omits reasonCode when RXA-19 has empty CE entries", () => {
      const rxa = makeBaseRXA({
        $19_indication: [{}] as any,
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.reasonCode).toBeUndefined();
    });
  });

  describe("recorded date (ORC-9 / RXA-22 fallback)", () => {
    test("uses ORC-9 as primary recorded date", () => {
      const rxa = makeBaseRXA({ $21_actionCodeRxa: "A", $22_systemEntryDateTime: "20160601" });
      const orc: ORC = {
        $1_orderControl: "RE",
        $9_transactionDateTime: "20160701120000",
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      expect(immunization.recorded).toBe("2016-07-01T12:00:00Z");
    });

    test("falls back to RXA-22 when ORC-9 is empty and RXA-21=A", () => {
      const rxa = makeBaseRXA({
        $21_actionCodeRxa: "A",
        $22_systemEntryDateTime: "20160601100000",
      });
      const orc: ORC = {
        $1_orderControl: "RE",
        $9_transactionDateTime: undefined,
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      expect(immunization.recorded).toBe("2016-06-01T10:00:00Z");
    });

    test("no recorded when ORC-9 is empty and RXA-21 is not A", () => {
      const rxa = makeBaseRXA({
        $21_actionCodeRxa: "D",
        $22_systemEntryDateTime: "20160601100000",
      });
      const orc: ORC = {
        $1_orderControl: "RE",
        $9_transactionDateTime: undefined,
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      // RXA-21=D → entered-in-error, and RXA-22 fallback only applies when RXA-21=A
      expect(immunization.recorded).toBeUndefined();
    });

    test("falls back to RXA-22 when ORC absent and RXA-21=A", () => {
      const rxa = makeBaseRXA({
        $21_actionCodeRxa: "A",
        $22_systemEntryDateTime: "20160601100000",
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.recorded).toBe("2016-06-01T10:00:00Z");
    });

    test("no recorded when ORC absent and RXA-21 not A", () => {
      const rxa = makeBaseRXA({
        $21_actionCodeRxa: undefined,
        $22_systemEntryDateTime: "20160601100000",
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.recorded).toBeUndefined();
    });

    test("no recorded when ORC-9 empty and RXA-22 empty", () => {
      const rxa = makeBaseRXA({
        $21_actionCodeRxa: "A",
        $22_systemEntryDateTime: undefined,
      });

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.recorded).toBeUndefined();
    });
  });

  describe("RXR — route and site", () => {
    test("maps RXR-1 to route and RXR-2 to site", () => {
      const rxa = makeBaseRXA();
      const rxr: RXR = {
        $1_route: { $1_code: "IM", $2_text: "INTRAMUSCULAR", $3_system: "NCIT" },
        $2_administrationSite: { $1_code: "LA", $2_text: "LEFT ARM", $3_system: "HL70163" },
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, rxr, undefined, "test-id", patientReference),
      );

      expect(immunization.route?.coding?.[0]?.code).toBe("IM");
      expect(immunization.route?.coding?.[0]?.display).toBe("INTRAMUSCULAR");
      expect(immunization.route?.coding?.[0]?.system).toBe("http://ncicb.nci.nih.gov/xml/owl/EVS/Thesaurus.owl");
      expect(immunization.site?.coding?.[0]?.code).toBe("LA");
      expect(immunization.site?.coding?.[0]?.display).toBe("LEFT ARM");
      expect(immunization.site?.coding?.[0]?.system).toBe("http://terminology.hl7.org/CodeSystem/v2-0163");
    });

    test("omits route when RXR-1 is empty, preserves site from RXR-2", () => {
      const rxa = makeBaseRXA();
      const rxr: RXR = {
        $1_route: {} as any,
        $2_administrationSite: { $1_code: "LA", $2_text: "LEFT ARM", $3_system: "HL70163" },
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, rxr, undefined, "test-id", patientReference),
      );

      expect(immunization.route).toBeUndefined();
      expect(immunization.site?.coding?.[0]?.code).toBe("LA");
    });

    test("omits both route and site when RXR is absent", () => {
      const rxa = makeBaseRXA();

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.route).toBeUndefined();
      expect(immunization.site).toBeUndefined();
    });
  });

  describe("ORC identifiers (PLAC/FILL)", () => {
    test("ORC-3 creates FILL identifier, ORC-2 creates PLAC identifier", () => {
      const rxa = makeBaseRXA();
      const orc: ORC = {
        $1_orderControl: "RE",
        $2_placerOrderNumber: { $1_value: "PL001", $2_namespace: "MYEMR" },
        $3_fillerOrderNumber: { $1_value: "65930", $2_namespace: "DCS" },
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      expect(immunization.identifier).toHaveLength(2);
      const placerIdentifier = immunization.identifier?.find(
        (id) => id.type?.coding?.[0]?.code === "PLAC",
      );
      const fillerIdentifier = immunization.identifier?.find(
        (id) => id.type?.coding?.[0]?.code === "FILL",
      );
      expect(placerIdentifier?.value).toBe("PL001");
      expect(placerIdentifier?.system).toBe("MYEMR");
      expect(placerIdentifier?.type?.coding?.[0]?.system).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0203",
      );
      expect(fillerIdentifier?.value).toBe("65930");
      expect(fillerIdentifier?.system).toBe("DCS");
    });

    test("ORC present but ORC-2 and ORC-3 both empty — no identifiers", () => {
      const rxa = makeBaseRXA();
      const orc: ORC = {
        $1_orderControl: "RE",
        $2_placerOrderNumber: undefined,
        $3_fillerOrderNumber: undefined,
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      expect(immunization.identifier).toBeUndefined();
    });

    test("ORC absent — no identifiers", () => {
      const rxa = makeBaseRXA();

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.identifier).toBeUndefined();
    });

    test("ORC-3 only (no ORC-2) — single FILL identifier", () => {
      const rxa = makeBaseRXA();
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "65930", $2_namespace: "DCS" },
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      expect(immunization.identifier).toHaveLength(1);
      expect(immunization.identifier?.[0]?.type?.coding?.[0]?.code).toBe("FILL");
      expect(immunization.identifier?.[0]?.value).toBe("65930");
    });
  });

  describe("performers (RXA-10 administering, ORC-12 ordering)", () => {
    const administeringXCN = {
      $1_value: "1234567890",
      $2_family: { $1_family: "SMITH" },
      $3_given: "JOHN",
      $4_additionalGiven: "W",
      $9_system: { $1_namespace: "NPI" },
      $13_type: "NPI",
    };

    const orderingXCN = {
      $1_value: "9876543210",
      $2_family: { $1_family: "DOE" },
      $3_given: "JANE",
      $9_system: { $1_namespace: "NPI" },
      $13_type: "NPI",
    };

    test("RXA-10 creates Practitioner + performer with function=AP", () => {
      const rxa = makeBaseRXA({ $10_administeringProvider: [administeringXCN] });

      const { immunization, performerEntries } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      const apPerformer = immunization.performer?.find(
        (p) => p.function?.coding?.[0]?.code === "AP",
      );
      expect(apPerformer).toBeDefined();
      expect(apPerformer?.function?.coding?.[0]?.system).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0443",
      );
      expect(apPerformer?.function?.coding?.[0]?.display).toBe("Administering Provider");
      expect(apPerformer?.actor.reference).toMatch(/^Practitioner\//);

      // Practitioner bundle entry created
      const practitionerEntry = performerEntries.find(
        (e) => (e.resource as any)?.resourceType === "Practitioner",
      );
      expect(practitionerEntry).toBeDefined();
      expect((practitionerEntry!.resource as any).name?.[0]?.family).toBe("SMITH");
      expect((practitionerEntry!.resource as any).id).toBe("npi-1234567890");
      expect(practitionerEntry!.request?.method).toBe("PUT");
    });

    test("ORC-12 creates PractitionerRole + performer with function=OP", () => {
      const rxa = makeBaseRXA();
      const orc: ORC = {
        $1_orderControl: "RE",
        $12_orderingProvider: [orderingXCN],
      };

      const { immunization, performerEntries } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      const opPerformer = immunization.performer?.find(
        (p) => p.function?.coding?.[0]?.code === "OP",
      );
      expect(opPerformer).toBeDefined();
      expect(opPerformer?.function?.coding?.[0]?.system).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0443",
      );
      expect(opPerformer?.function?.coding?.[0]?.display).toBe("Ordering Provider");
      expect(opPerformer?.actor.reference).toMatch(/^PractitionerRole\//);

      // PractitionerRole bundle entry created
      const roleEntry = performerEntries.find(
        (e) => (e.resource as any)?.resourceType === "PractitionerRole",
      );
      expect(roleEntry).toBeDefined();
      expect((roleEntry!.resource as any).id).toBe("role-npi-9876543210");
      expect(roleEntry!.request?.method).toBe("PUT");
    });

    test("both RXA-10 and ORC-12 create two performers and two bundle entries", () => {
      const rxa = makeBaseRXA({ $10_administeringProvider: [administeringXCN] });
      const orc: ORC = {
        $1_orderControl: "RE",
        $12_orderingProvider: [orderingXCN],
      };

      const { immunization, performerEntries } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      expect(immunization.performer).toHaveLength(2);
      expect(immunization.performer?.[0]?.function?.coding?.[0]?.code).toBe("AP");
      expect(immunization.performer?.[1]?.function?.coding?.[0]?.code).toBe("OP");
      expect(performerEntries).toHaveLength(2);
    });

    test("function coding includes system URI for both AP and OP", () => {
      const rxa = makeBaseRXA({ $10_administeringProvider: [administeringXCN] });
      const orc: ORC = {
        $1_orderControl: "RE",
        $12_orderingProvider: [orderingXCN],
      };

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, orc, "test-id", patientReference),
      );

      for (const performer of immunization.performer!) {
        expect(performer.function?.coding?.[0]?.system).toBe(
          "http://terminology.hl7.org/CodeSystem/v2-0443",
        );
      }
    });

    test("no administering performer when RXA-10 is empty", () => {
      const rxa = makeBaseRXA({ $10_administeringProvider: undefined });

      const { immunization, performerEntries } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.performer).toBeUndefined();
      expect(performerEntries).toHaveLength(0);
    });

    test("no ordering performer when ORC is absent", () => {
      const rxa = makeBaseRXA();

      const { immunization } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      const opPerformer = immunization.performer?.find(
        (p) => p.function?.coding?.[0]?.code === "OP",
      );
      expect(opPerformer).toBeUndefined();
    });

    test("no performer when RXA-10 XCN has no identifier or name", () => {
      const emptyXCN = {};
      const rxa = makeBaseRXA({ $10_administeringProvider: [emptyXCN as any] });

      const { immunization, performerEntries } = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      expect(immunization.performer).toBeUndefined();
      expect(performerEntries).toHaveLength(0);
    });

    test("Practitioner ID is deterministic from XCN.9 system + XCN.1 value", () => {
      const rxa = makeBaseRXA({ $10_administeringProvider: [administeringXCN] });

      const result1 = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );
      const result2 = expectImmunization(
        convertRXAToImmunization(rxa, undefined, undefined, "test-id", patientReference),
      );

      const id1 = (result1.performerEntries[0]!.resource as any).id;
      const id2 = (result2.performerEntries[0]!.resource as any).id;
      expect(id1).toBe(id2);
      expect(id1).toBe("npi-1234567890");
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
