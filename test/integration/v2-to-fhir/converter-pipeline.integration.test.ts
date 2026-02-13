/**
 * End-to-end converter pipeline tests (ADT + ORU).
 *
 * Covers:
 * - Patient and Encounter ID generation
 * - Preprocessor authority injection from MSH into PV1-19 CX.4
 * - Draft resources (Patient active=false, Encounter status=unknown)
 * - Observation LOINC code mapping
 * - Config-driven PV1 required/optional toggle
 * - Condition creation without Encounter when PV1 is missing
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { join } from "path";
import {
  loadFixture,
  getEncounters,
  getConditions,
  getDiagnosticReports,
  getObservations,
  getPatient,
  submitAndProcess,
} from "../helpers";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import { clearConfigCache } from "../../../src/v2-to-fhir/config";

const TEST_CONFIG_DIR = join(__dirname, "../../fixtures/config");

function submitAdtA01(hl7Message: string): Promise<IncomingHL7v2Message> {
  return submitAndProcess(hl7Message, "ADT^A01");
}

function submitOruR01(hl7Message: string): Promise<IncomingHL7v2Message> {
  return submitAndProcess(hl7Message, "ORU^R01");
}

describe("Converter Pipeline", () => {
  describe("ADT-A01", () => {
    test("injects authority from MSH when PV1-19 has no CX.4", async () => {
      const hl7Message = await loadFixture("adt-a01/base.hl7");
      const message = await submitAdtA01(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference!;
      expect(patientRef).toBe("Patient/P12345");

      const encounters = await getEncounters(patientRef);
      expect(encounters).toHaveLength(1);

      // MSH-3=SENDER, MSH-4=FACILITY → authority="SENDER-FACILITY"
      // sanitize: lowercase, non-alphanumeric → hyphens
      expect(encounters[0]!.id).toBe("sender-facility-vn001");
      expect(encounters[0]!.identifier?.[0]?.system).toBe("SENDER-FACILITY");
    });

    test("preserves existing CX.4 authority", async () => {
      const hl7Message = await loadFixture("adt-a01/preprocessor/with-authority.hl7");
      const message = await submitAdtA01(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference!;
      expect(patientRef).toBe("Patient/P-PREPROC");

      const encounters = await getEncounters(patientRef);
      expect(encounters).toHaveLength(1);

      // PV1-19=VN002^^^MYHOSP&urn:oid:2.3.4&ISO → HD.2="urn:oid:2.3.4"
      // sanitize("urn:oid:2.3.4") = "urn-oid-2-3-4"
      expect(encounters[0]!.id).toBe("urn-oid-2-3-4-vn002");
      expect(encounters[0]!.identifier?.[0]?.system).toBe("urn:oid:2.3.4");
    });

    // Default config has ADT-A01.converter.PV1.required=false
    test("creates Conditions without Encounter when PV1 missing (required=false)", async () => {
      const hl7Message = await loadFixture("adt-a01/no-pv1-with-conditions.hl7");
      const message = await submitAdtA01(hl7Message);

      expect(message.status).toBe("warning");

      const patientRef = message.patient!.reference!;
      expect(patientRef).toBe("Patient/P-NOPV1-DG1");

      const encounters = await getEncounters(patientRef);
      expect(encounters).toHaveLength(0);

      const conditions = await getConditions(patientRef);
      expect(conditions).toHaveLength(1);

      // Condition linked to Patient, not Encounter
      expect(conditions[0]!.subject?.reference).toBe(patientRef);
      expect(conditions[0]!.encounter).toBeUndefined();
    });
  });

  describe("ORU-R01", () => {
    describe("required=false (default config)", () => {
      test("processes without Encounter when PV1 missing", async () => {
        const hl7Message = await loadFixture("oru-r01/encounter/without-pv1.hl7");
        const message = await submitOruR01(hl7Message);

        expect(message.status).toBe("processed");

        const patientRef = message.patient!.reference!;
        expect(patientRef).toBe("Patient/TEST-0001");

        const patient = await getPatient("TEST-0001");
        expect(patient.active).toBe(false);

        const diagnosticReports = await getDiagnosticReports(patientRef);
        expect(diagnosticReports).toHaveLength(1);
        expect(diagnosticReports[0]!.encounter).toBeUndefined();

        const observations = await getObservations(patientRef);
        expect(observations).toHaveLength(1);
        expect(observations[0]!.code?.coding?.[0]?.code).toBe("2823-3");
        expect(observations[0]!.code?.coding?.[0]?.system).toBe("http://loinc.org");
      });

      test("sets warning when PV1-19 empty, preserves clinical data", async () => {
        const hl7Message = await loadFixture("oru-r01/encounter/no-visit-number.hl7");
        const message = await submitOruR01(hl7Message);

        expect(message.status).toBe("warning");
        expect(message.error).toContain("PV1-19");

        const patientRef = message.patient!.reference!;
        expect(patientRef).toBe("Patient/TEST-0002");

        const diagnosticReports = await getDiagnosticReports(patientRef);
        expect(diagnosticReports).toHaveLength(1);
        expect(diagnosticReports[0]!.encounter).toBeUndefined();

        const observations = await getObservations(patientRef);
        expect(observations).toHaveLength(1);
        expect(observations[0]!.code?.coding?.[0]?.code).toBe("2823-3");
        expect(observations[0]!.code?.coding?.[0]?.system).toBe("http://loinc.org");
      });

      test("preprocessor injects authority into Encounter ID", async () => {
        const hl7Message = await loadFixture("oru-r01/encounter/with-visit.hl7");
        const message = await submitOruR01(hl7Message);

        expect(message.status).toBe("processed");

        const patientRef = message.patient!.reference!;
        expect(patientRef).toBe("Patient/TEST-0003");

        const patient = await getPatient("TEST-0003");
        expect(patient.active).toBe(false);

        const encounters = await getEncounters(patientRef);
        expect(encounters).toHaveLength(1);

        // MSH-3=LAB, MSH-4=HOSPITAL → authority="LAB-HOSPITAL"
        expect(encounters[0]!.id).toBe("lab-hospital-enc-12345");
        expect(encounters[0]!.identifier?.[0]?.system).toBe("LAB-HOSPITAL");
        expect(encounters[0]!.status).toBe("unknown");

        const observations = await getObservations(patientRef);
        expect(observations).toHaveLength(1);
        expect(observations[0]!.code?.coding?.[0]?.code).toBe("2823-3");
        expect(observations[0]!.code?.coding?.[0]?.system).toBe("http://loinc.org");
      });
    });

    describe("required=true (config toggle)", () => {
      beforeAll(() => {
        process.env.HL7V2_TO_FHIR_CONFIG = join(TEST_CONFIG_DIR, "hl7v2-to-fhir-oru-pv1-required.json");
        clearConfigCache();
      });

      afterAll(() => {
        process.env.HL7V2_TO_FHIR_CONFIG = join(TEST_CONFIG_DIR, "hl7v2-to-fhir.json");
        clearConfigCache();
      });

      test("returns error when PV1 is missing", async () => {
        const hl7Message = await loadFixture("oru-r01/encounter/without-pv1.hl7");
        const message = await submitOruR01(hl7Message);

        expect(message.status).toBe("error");
      });

      test("returns error when PV1-19 is empty", async () => {
        const hl7Message = await loadFixture("oru-r01/encounter/no-visit-number.hl7");
        const message = await submitOruR01(hl7Message);

        expect(message.status).toBe("error");
      });
    });
  });
});
