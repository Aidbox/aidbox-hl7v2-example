/**
 * Integration tests for ORU_R01 message processing.
 *
 * These tests verify end-to-end message processing against a real Aidbox instance.
 * They test the complete pipeline: message submission → processing → resource creation.
 *
 * Unit tests for pure functions like convertOBXToObservationResolving are in
 * test/unit/v2-to-fhir/messages/oru-r01.test.ts
 */
import { describe, test, expect, beforeEach } from "bun:test";
import {
  describeIntegration,
  loadFixture,
  testAidboxFetch,
  createTestConceptMap,
  getMappingTasks,
  resolveTask,
  cleanupTestResources,
} from "../helpers";
import { processNextMessage } from "../../../src/v2-to-fhir/processor-service";
import type {
  DiagnosticReport,
  Observation,
  Encounter,
  Specimen,
  Patient,
} from "../../../src/fhir/hl7-fhir-r4-core";

interface Bundle<T = unknown> {
  resourceType: "Bundle";
  total?: number;
  entry?: Array<{ resource: T }>;
}

interface IncomingHL7v2Message {
  id: string;
  status: string;
  error?: string;
  patient?: { reference: string };
  unmappedCodes?: Array<{ localCode: string; localSystem: string }>;
}

// Helper functions for fetching resources
async function getDiagnosticReports(patientRef: string): Promise<DiagnosticReport[]> {
  const bundle = await testAidboxFetch<Bundle<DiagnosticReport>>(
    `/fhir/DiagnosticReport?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

async function getObservations(patientRef: string): Promise<Observation[]> {
  const bundle = await testAidboxFetch<Bundle<Observation>>(
    `/fhir/Observation?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

async function getEncounters(patientRef: string): Promise<Encounter[]> {
  const bundle = await testAidboxFetch<Bundle<Encounter>>(
    `/fhir/Encounter?subject=${encodeURIComponent(patientRef)}`,
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

async function getPatient(patientId: string): Promise<Patient> {
  return testAidboxFetch<Patient>(`/fhir/Patient/${patientId}`);
}

async function submitAndProcess(hl7Message: string): Promise<IncomingHL7v2Message> {
  const createdMessage = await testAidboxFetch<IncomingHL7v2Message>(
    "/fhir/IncomingHL7v2Message",
    {
      method: "POST",
      body: JSON.stringify({
        resourceType: "IncomingHL7v2Message",
        message: hl7Message,
        status: "received",
        type: "ORU^R01",
      }),
    },
  );

  await processNextMessage().catch(() => {});

  return testAidboxFetch<IncomingHL7v2Message>(
    `/fhir/IncomingHL7v2Message/${createdMessage.id}`,
  );
}

describeIntegration("ORU_R01 E2E Integration", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  describe("happy path - basic message processing", () => {
    test("processes base message and creates FHIR resources", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");
      expect(message.patient?.reference).toContain("Patient/");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);
      expect(diagnosticReports.length).toBe(1);
      expect(diagnosticReports[0].status).toBe("final");

      const observations = await getObservations(patientRef);
      expect(observations.length).toBe(2);
    });

    test("creates DiagnosticReport with correct ID from OBR-3", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].id).toBe("26h-006mp0004");
      expect(diagnosticReports[0].code?.coding?.[0]?.code).toBe("LAB5524");
    });

    test("creates Observations with correct IDs from OBX", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      const ids = observations.map((o) => o.id).sort();
      expect(ids).toContain("26h-006mp0004-obx-1");
      expect(ids).toContain("26h-006mp0004-obx-2");
    });

    test("links Observations to DiagnosticReport via result array", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].result).toHaveLength(2);
      expect(diagnosticReports[0].result?.[0]?.reference).toContain("Observation/");
    });

    test("tags all resources with message control ID", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      const tag = diagnosticReports[0].meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      expect(tag?.code).toBe("TEST-MSG-001");
    });
  });

  describe("LOINC code handling", () => {
    test("extracts LOINC from OBX-3 primary coding", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/primary.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      const loincCoding = observations[0].code.coding?.find(
        (c) => c.system === "http://loinc.org",
      );
      expect(loincCoding?.code).toBe("2823-3");
    });

    test("extracts LOINC from OBX-3 alternate coding", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/alternate.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      const loincCoding = observations[0].code.coding?.find(
        (c) => c.system === "http://loinc.org",
      );
      expect(loincCoding?.code).toBe("2823-3");

      // Should also include local coding
      const localCoding = observations[0].code.coding?.find(
        (c) => c.system !== "http://loinc.org",
      );
      expect(localCoding?.code).toBe("12345");
    });

    test("returns mapping_error when OBX has no LOINC code", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/local-only.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("mapping_error");
      expect(message.unmappedCodes).toBeDefined();
      expect(message.unmappedCodes!.length).toBeGreaterThan(0);
      expect(message.unmappedCodes![0].localCode).toBe("12345");
    });

    test("collects all unmapped codes when multiple OBX lack LOINC", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/mixed.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("mapping_error");
      // First OBX has LOINC, second doesn't
      expect(message.unmappedCodes).toHaveLength(1);
      expect(message.unmappedCodes![0].localCode).toBe("67890");
    });
  });

  describe("SPM segment handling", () => {
    test("creates Specimen from SPM segment", async () => {
      const hl7Message = await loadFixture("oru-r01/with-specimen.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].specimen).toBeDefined();
      expect(diagnosticReports[0].specimen!.length).toBe(1);

      const specimenRef = diagnosticReports[0].specimen![0].reference!;
      const specimenId = specimenRef.split("/")[1];
      const specimen = await testAidboxFetch<Specimen>(`/fhir/Specimen/${specimenId}`);
      expect(specimen.type?.coding?.[0]?.code).toBe("Blood");
    });

    test("links Specimen to Observations", async () => {
      const hl7Message = await loadFixture("oru-r01/with-specimen.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      expect(observations[0].specimen?.reference).toContain("Specimen/");
    });
  });

  describe("NTE segment handling", () => {
    test("attaches NTE comments to Observation as notes", async () => {
      const hl7Message = await loadFixture("oru-r01/with-notes.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      expect(observations[0].note).toBeDefined();
      expect(observations[0].note!.length).toBe(1);
      expect(observations[0].note![0].text).toContain("eGFR calculation");
    });

    test("creates paragraph breaks for empty NTE-3", async () => {
      const hl7Message = await loadFixture("oru-r01/with-notes.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      // Should have paragraph break between first and third NTE
      expect(observations[0].note![0].text).toContain("\n\n");
    });
  });

  describe("multiple OBR groups", () => {
    test("creates multiple DiagnosticReports for multiple OBR groups", async () => {
      const hl7Message = await loadFixture("oru-r01/multiple-obr.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports.length).toBe(2);
      expect(diagnosticReports.every((dr) => dr.status === "final")).toBe(true);
    });

    test("links OBX to correct parent OBR", async () => {
      const hl7Message = await loadFixture("oru-r01/multiple-obr.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      // Each DiagnosticReport should have 2 observations
      expect(diagnosticReports.every((dr) => dr.result?.length === 2)).toBe(true);
    });
  });

  describe("OBX value type handling", () => {
    test("converts NM value type to valueQuantity", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      const quantityObs = observations.find((o) => o.valueQuantity?.value === 1.0);
      expect(quantityObs).toBeDefined();
      expect(quantityObs?.valueQuantity?.unit).toBe("%");
    });

    test("converts ST value type to valueString", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      const stringObs = observations.find((o) => o.valueString === "Detected");
      expect(stringObs).toBeDefined();
    });

    test("converts SN with comparator to valueQuantity", async () => {
      const hl7Message = await loadFixture("oru-r01/with-notes.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      expect(observations[0].valueQuantity?.value).toBe(90);
      expect(observations[0].valueQuantity?.comparator).toBe(">");
    });
  });

  describe("interpretation and reference range", () => {
    test("converts OBX-8 abnormal flag to interpretation", async () => {
      const hl7Message = await loadFixture("oru-r01/with-loinc-abnormal.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      expect(observations[0].interpretation?.[0]?.coding?.[0]?.code).toBe("H");
    });

    test("converts OBX-7 reference range", async () => {
      const hl7Message = await loadFixture("oru-r01/with-loinc-abnormal.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      expect(observations[0].referenceRange?.[0]?.low?.value).toBe(4.0);
      expect(observations[0].referenceRange?.[0]?.high?.value).toBe(6.0);
    });
  });

  describe("OBR-25 and OBX-11 status validation", () => {
    test("sets error when OBR-25 is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/error/missing-obr25.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBR-25/);
    });

    test("sets error when OBR-25 is Y", async () => {
      const hl7Message = await loadFixture("oru-r01/error/obr25-y.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBR-25/);
    });

    test("sets error when OBR-25 is Z", async () => {
      const hl7Message = await loadFixture("oru-r01/error/obr25-z.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBR-25/);
    });

    test("sets error when OBX-11 is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/error/missing-obx11.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBX-11/);
    });

    test("sets error when OBX-11 is N", async () => {
      const hl7Message = await loadFixture("oru-r01/error/obx11-n.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBX-11/);
    });

    test("processes message with valid OBR-25 P (preliminary)", async () => {
      const hl7Message = await loadFixture("oru-r01/valid-preliminary.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);
      expect(diagnosticReports[0].status).toBe("preliminary");
    });
  });

  describe("error handling", () => {
    test("sets error when MSH-3 (sending application) is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/error/missing-msh3.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/MSH-3/);
    });

    test("sets error when MSH-4 (sending facility) is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/error/missing-msh4.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/MSH-4/);
    });

    test("sets error when OBR segment is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/error/missing-obr.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBR/);
    });

    test("sets error when both OBR-2 and OBR-3 are missing", async () => {
      const hl7Message = await loadFixture("oru-r01/error/missing-obr-ids.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/OBR-3|OBR-2/);
    });

    test("uses OBR-2 as fallback when OBR-3 is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/valid-obr2-fallback.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);
      expect(diagnosticReports[0].id).toBe("placer123");
    });

    test("sets error when OBX-3 has no system (MissingLocalSystemError)", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/no-system.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/missing.*system|BFTYPE/i);
    });
  });

  describe("patient handling", () => {
    test("sets error when PID segment is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/patient/without-pid.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/PID/);
    });

    test("sets error when both PID-2 and PID-3 are empty", async () => {
      const hl7Message = await loadFixture("oru-r01/patient/empty-pid.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/Patient ID/i);
    });

    test("extracts patient ID from PID-2", async () => {
      const hl7Message = await loadFixture("oru-r01/patient/pid2-only.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");
      expect(message.patient?.reference).toBe("Patient/PAT-FROM-PID2");
    });

    test("extracts patient ID from PID-3.1 when PID-2 is empty", async () => {
      const hl7Message = await loadFixture("oru-r01/patient/pid3-only.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");
      expect(message.patient?.reference).toBe("Patient/PAT-FROM-PID3");
    });

    test("creates draft Patient with active=false when patient not found", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientId = message.patient!.reference.split("/")[1];
      const patient = await getPatient(patientId);

      expect(patient.active).toBe(false);
    });

    test("draft patient includes demographics from PID segment", async () => {
      const hl7Message = await loadFixture("oru-r01/patient/pid3-only.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientId = message.patient!.reference.split("/")[1];
      const patient = await getPatient(patientId);

      expect(patient.name?.[0]?.family).toBe("PATIENT");
      expect(patient.name?.[0]?.given).toContain("TEST");
      expect(patient.gender).toBe("male");
      expect(patient.birthDate).toBe("2000-01-01");
    });

    test("links DiagnosticReport to Patient via subject", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].subject?.reference).toBe(patientRef);
    });

    test("links all Observations to Patient via subject", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      observations.forEach((obs) => {
        expect(obs.subject?.reference).toBe(patientRef);
      });
    });
  });

  describe("encounter handling", () => {
    test("creates draft Encounter when PV1-19 is present", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/with-visit.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const encounters = await getEncounters(patientRef);

      expect(encounters.length).toBe(1);
      expect(encounters[0].status).toBe("unknown");
    });

    test("does not create Encounter when PV1 is missing", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/without-pv1.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].encounter).toBeUndefined();
    });

    test("does not create Encounter when PV1-19 is empty", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/no-visit-number.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].encounter).toBeUndefined();
    });

    test("links DiagnosticReport to Encounter", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/with-visit.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      expect(diagnosticReports[0].encounter?.reference).toContain("Encounter/");
    });

    test("links Observations to Encounter", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/with-visit.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      observations.forEach((obs) => {
        expect(obs.encounter?.reference).toContain("Encounter/");
      });
    });

    test("draft Encounter includes PV1-2 class", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/with-visit.hl7");
      const message = await submitAndProcess(hl7Message);

      const patientRef = message.patient!.reference;
      const encounters = await getEncounters(patientRef);

      // PV1-2 = I (inpatient) maps to IMP
      expect(encounters[0].class?.code).toBe("IMP");
    });

    test("includes draft Encounter even when mapping_error occurs", async () => {
      const hl7Message = await loadFixture("oru-r01/encounter/with-mapping-error.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("mapping_error");

      const patientRef = message.patient!.reference;
      const encounters = await getEncounters(patientRef);

      expect(encounters.length).toBe(1);
    });
  });

  describe("idempotency", () => {
    test("processing same message twice does not create duplicates", async () => {
      const hl7Message = await loadFixture("oru-r01/base.hl7");

      // Process first time
      const message1 = await submitAndProcess(hl7Message);
      const patientRef = message1.patient!.reference;

      const reportsAfterFirst = await getDiagnosticReports(patientRef);
      expect(reportsAfterFirst.length).toBe(1);
      const firstReportId = reportsAfterFirst[0].id;

      // Process second time
      await submitAndProcess(hl7Message);

      const reportsAfterSecond = await getDiagnosticReports(patientRef);

      // Should still be only 1 DiagnosticReport (idempotent)
      expect(reportsAfterSecond.length).toBe(1);
      expect(reportsAfterSecond[0].id).toBe(firstReportId);
    });

    test("same message with different MSH-10 updates resources", async () => {
      const hl7Message1 = await loadFixture("oru-r01/base.hl7");
      const hl7Message2 = hl7Message1.replace("TEST-MSG-001", "TEST-MSG-002");

      const message1 = await submitAndProcess(hl7Message1);
      const message2 = await submitAndProcess(hl7Message2);

      // Same patient
      expect(message1.patient?.reference).toBe(message2.patient?.reference);

      const patientRef = message1.patient!.reference;
      const diagnosticReports = await getDiagnosticReports(patientRef);

      // Still only 1 DiagnosticReport
      expect(diagnosticReports.length).toBe(1);

      // But tag updated to latest message ID
      const tag = diagnosticReports[0].meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      expect(tag?.code).toBe("TEST-MSG-002");
    });
  });

  describe("ConceptMap resolution", () => {
    test("resolves local code to LOINC via ConceptMap", async () => {
      await createTestConceptMap("LAB", "HOSP", [
        {
          localCode: "12345",
          localSystem: "LOCAL",
          loincCode: "2823-3",
          loincDisplay: "Potassium",
        },
      ]);

      const hl7Message = await loadFixture("oru-r01/loinc/conceptmap-resolve.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference;
      const observations = await getObservations(patientRef);

      const loincCoding = observations[0].code.coding?.find(
        (c) => c.system === "http://loinc.org",
      );
      expect(loincCoding?.code).toBe("2823-3");
    });

    test("creates mapping Task when LOINC resolution fails", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/local-only.hl7");
      const message = await submitAndProcess(hl7Message);

      expect(message.status).toBe("mapping_error");

      const tasks = await getMappingTasks();
      expect(tasks.length).toBe(1);

      const task = tasks[0];
      expect(task).toBeDefined();
      expect(task?.status).toBe("requested");
      expect(task.input).toContainEqual({
        type: {
            text: "Local code",
          },
          valueString: "12345",
        });
    });

    test("reprocesses message after mapping task resolution", async () => {
      const hl7Message = await loadFixture("oru-r01/loinc/local-only.hl7");
      const message = await submitAndProcess(hl7Message);
      expect(message.status).toBe("mapping_error");

      const tasks = await getMappingTasks();
      const task = tasks[0];

      await resolveTask(task.id!, "2823-3", "Potassium");

      await processNextMessage();

      const updatedMessage = await testAidboxFetch<IncomingHL7v2Message>(
        `/fhir/IncomingHL7v2Message/${message.id}`,
      );
      expect(updatedMessage.status).toBe("processed");
    });
  });
});
