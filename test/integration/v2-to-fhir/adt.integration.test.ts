/**
 * Integration tests for ADT message processing (A01, A08).
 *
 * These tests verify end-to-end message processing against a real Aidbox instance.
 * They test the complete pipeline: message submission → processing → resource creation.
 */
import { describe, test, expect } from "bun:test";
import {
  loadFixture,
  getPatient,
  getEncounters,
  getConditions,
  getAllergies,
  getCoverages,
  getRelatedPersons,
  getMappingTasks,
  submitAndProcess,
  aidboxFetch,
} from "../helpers";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";

async function submitAndProcessAdtA01(hl7Message: string): Promise<IncomingHL7v2Message> {
  return submitAndProcess(hl7Message, "ADT^A01");
}

async function submitAndProcessAdtA08(hl7Message: string): Promise<IncomingHL7v2Message> {
  return submitAndProcess(hl7Message, "ADT^A08");
}

describe("ADT_A01 E2E Integration", () => {
  describe("happy path - basic message processing", () => {
    test("processes base message and creates Patient and Encounter", async () => {
      const hl7Message = await loadFixture("adt-a01/base.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("processed");
      expect(message.patient?.reference).toBe("Patient/hospital-p12345");

      const patient = await getPatient("hospital-p12345");
      expect(patient.resourceType).toBe("Patient");
      expect(patient.name?.[0]?.family).toBe("TESTPATIENT");
      expect(patient.gender).toBe("male");

      const patientRef = message.patient!.reference!;
      const encounters = await getEncounters(patientRef);
      expect(encounters.length).toBe(1);
      expect(encounters[0]!.class?.code).toBe("IMP");
    });

    test("processes minimal message with just Patient and Encounter", async () => {
      const hl7Message = await loadFixture("adt-a01/minimal.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("processed");
      expect(message.patient?.reference).toBe("Patient/hospital-p-minimal");

      const patient = await getPatient("hospital-p-minimal");
      expect(patient.name?.[0]?.family).toBe("MINIMALPATIENT");
      expect(patient.gender).toBe("female");
    });

    test("tags Patient with message control ID", async () => {
      const hl7Message = await loadFixture("adt-a01/base.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patient = await getPatient("hospital-p12345");
      const tag = patient.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      expect(tag?.code).toBe("MSG-ADT-001");
    });

    test("tags Patient with message type ADT_A01", async () => {
      const hl7Message = await loadFixture("adt-a01/base.hl7");
      await submitAndProcessAdtA01(hl7Message);

      const patient = await getPatient("hospital-p12345");
      const tag = patient.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-type",
      );
      expect(tag?.code).toBe("ADT_A01");
    });
  });

  describe("Condition extraction from DG1", () => {
    test("creates Conditions from DG1 segments", async () => {
      const hl7Message = await loadFixture("adt-a01/with-conditions.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference!;
      const conditions = await getConditions(patientRef);

      expect(conditions.length).toBe(2);
    });

    test("sets Condition code from DG1-3", async () => {
      const hl7Message = await loadFixture("adt-a01/with-conditions.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const conditions = await getConditions(patientRef);

      const codes = conditions.map((c) => c.code?.coding?.[0]?.code).sort();
      expect(codes).toContain("I10");
      expect(codes).toContain("E11.9");
    });

    test("links Conditions to Patient", async () => {
      const hl7Message = await loadFixture("adt-a01/with-conditions.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const conditions = await getConditions(patientRef);

      conditions.forEach((cond) => {
        expect(cond.subject?.reference).toBe(patientRef);
      });
    });

    test("links Conditions to Encounter", async () => {
      const hl7Message = await loadFixture("adt-a01/with-conditions.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const conditions = await getConditions(patientRef);

      conditions.forEach((cond) => {
        expect(cond.encounter?.reference).toContain("Encounter/");
      });
    });
  });

  describe("AllergyIntolerance extraction from AL1", () => {
    test("creates AllergyIntolerances from AL1 segments", async () => {
      const hl7Message = await loadFixture("adt-a01/with-allergies.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference!;
      const allergies = await getAllergies(patientRef);

      expect(allergies.length).toBe(2);
    });

    test("sets AllergyIntolerance code from AL1-3", async () => {
      const hl7Message = await loadFixture("adt-a01/with-allergies.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const allergies = await getAllergies(patientRef);

      const codes = allergies.map((a) => a.code?.coding?.[0]?.code).sort();
      expect(codes).toContain("PCN");
      expect(codes).toContain("PEANUT");
    });

    test("links AllergyIntolerances to Patient", async () => {
      const hl7Message = await loadFixture("adt-a01/with-allergies.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const allergies = await getAllergies(patientRef);

      allergies.forEach((allergy) => {
        expect(allergy.patient?.reference).toBe(patientRef);
      });
    });

    test("sets reaction manifestation from AL1-5", async () => {
      const hl7Message = await loadFixture("adt-a01/with-allergies.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const allergies = await getAllergies(patientRef);

      const manifestations = allergies.map(
        (a) => a.reaction?.[0]?.manifestation?.[0]?.text,
      );
      expect(manifestations).toContain("Anaphylaxis");
      expect(manifestations).toContain("Hives");
    });
  });

  describe("Coverage extraction from IN1", () => {
    test("creates Coverages from IN1 segments", async () => {
      const hl7Message = await loadFixture("adt-a01/with-coverage.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference!;
      const coverages = await getCoverages(patientRef);

      expect(coverages.length).toBe(2);
    });

    test("links Coverages to Patient as beneficiary", async () => {
      const hl7Message = await loadFixture("adt-a01/with-coverage.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const coverages = await getCoverages(patientRef);

      coverages.forEach((coverage) => {
        expect(coverage.beneficiary?.reference).toBe(patientRef);
      });
    });
  });

  describe("RelatedPerson extraction from NK1", () => {
    test("creates RelatedPersons from NK1 segments", async () => {
      const hl7Message = await loadFixture("adt-a01/with-next-of-kin.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("processed");

      const patientRef = message.patient!.reference!;
      const relatedPersons = await getRelatedPersons(patientRef);

      expect(relatedPersons.length).toBe(2);
    });

    test("sets RelatedPerson name from NK1-2", async () => {
      const hl7Message = await loadFixture("adt-a01/with-next-of-kin.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const relatedPersons = await getRelatedPersons(patientRef);

      const families = relatedPersons.map((rp) => rp.name?.[0]?.family).sort();
      expect(families).toContain("SPOUSE");
      expect(families).toContain("PARENT");
    });

    test("links RelatedPersons to Patient", async () => {
      const hl7Message = await loadFixture("adt-a01/with-next-of-kin.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      const patientRef = message.patient!.reference!;
      const relatedPersons = await getRelatedPersons(patientRef);

      relatedPersons.forEach((rp) => {
        expect(rp.patient?.reference).toBe(patientRef);
      });
    });
  });

  describe("error handling", () => {
    test("sets error when PID segment is missing", async () => {
      const hl7Message = await loadFixture("adt-a01/error/missing-pid.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/PID/i);
    });
  });

  describe("PV1 Patient Class mapping errors", () => {
    test("sets mapping_error status when PV1-2 Patient Class is invalid", async () => {
      const hl7Message = await loadFixture("adt-a01/error/invalid-patient-class.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.status).toBe("mapping_error");
      expect(message.unmappedCodes).toBeDefined();
      expect(message.unmappedCodes).toHaveLength(1);
      expect(message.unmappedCodes![0]!.localCode).toBe("99");
      expect(message.unmappedCodes![0]!.localSystem).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0004",
      );
    });

    test("creates mapping Task for invalid PV1-2 Patient Class", async () => {
      const hl7Message = await loadFixture("adt-a01/error/invalid-patient-class.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      expect(message.unmappedCodes![0]!.mappingTask?.reference).toMatch(/^Task\//);

      const taskId = message.unmappedCodes![0]!.mappingTask!.reference!.replace("Task/", "");
      const task = await aidboxFetch<Task>(`/fhir/Task/${taskId}`);

      expect(task.status).toBe("requested");
      expect(task.code?.coding?.[0]?.code).toBe("patient-class");

      const localCodeInput = task.input?.find((i) => i.type?.text === "Local code");
      expect(localCodeInput?.valueString).toBe("99");
    });

    test("does not create Patient or Encounter when PV1 has mapping error", async () => {
      const hl7Message = await loadFixture("adt-a01/error/invalid-patient-class.hl7");
      const message = await submitAndProcessAdtA01(hl7Message);

      // Patient reference should not be set when there's a mapping error
      // (Patient will be created on successful reprocessing after mapping resolution)
      expect(message.patient).toBeUndefined();
    });
  });
});

describe("ADT_A08 E2E Integration", () => {
  describe("happy path - patient update", () => {
    test("processes base message and creates/updates Patient", async () => {
      const hl7Message = await loadFixture("adt-a08/base.hl7");
      const message = await submitAndProcessAdtA08(hl7Message);

      expect(message.status).toBe("processed");
      expect(message.patient?.reference).toBe("Patient/hospital-p-update");

      const patient = await getPatient("hospital-p-update");
      expect(patient.resourceType).toBe("Patient");
      expect(patient.name?.[0]?.family).toBe("UPDATEPATIENT");
    });

    test("updates patient demographics", async () => {
      const hl7Message = await loadFixture("adt-a08/demographics-update.hl7");
      const message = await submitAndProcessAdtA08(hl7Message);

      expect(message.status).toBe("processed");

      const patient = await getPatient("hospital-p-demo-update");
      expect(patient.name?.[0]?.family).toBe("NEWLASTNAME");
      expect(patient.name?.[0]?.given).toContain("NEWFIRST");
      expect(patient.gender).toBe("female");
    });

    test("tags Patient with message type ADT_A08", async () => {
      const hl7Message = await loadFixture("adt-a08/base.hl7");
      await submitAndProcessAdtA08(hl7Message);

      const patient = await getPatient("hospital-p-update");
      const tag = patient.meta?.tag?.find(
        (t) => t.system === "urn:aidbox:hl7v2:message-type",
      );
      expect(tag?.code).toBe("ADT_A08");
    });
  });

  describe("idempotency", () => {
    test("processing same A08 message twice updates patient without creating duplicate", async () => {
      const hl7Message = await loadFixture("adt-a08/base.hl7");

      // Process first time
      await submitAndProcessAdtA08(hl7Message);
      const patientAfterFirst = await getPatient("hospital-p-update");

      // Process second time
      await submitAndProcessAdtA08(hl7Message);
      const patientAfterSecond = await getPatient("hospital-p-update");

      // Should be same patient (updated, not duplicated)
      expect(patientAfterSecond.id).toBe(patientAfterFirst.id);
    });
  });
});

describe("patient identity system", () => {
  test("ASTRA message: UNIPAT in PID-2 produces unipat-prefixed Patient.id", async () => {
    // ASTRA puts the UNIPAT identifier in PID-2 (deprecated field).
    // Preprocessor move-pid2-into-pid3 migrates it into PID-3.
    // Rule {assigner: "UNIPAT"} matches → Patient.id = unipat-{value}.
    const hl7Message = await loadFixture("adt-a01/identity-system/astra-unipat-pid2.hl7");
    const message = await submitAndProcessAdtA01(hl7Message);

    expect(message.status).toBe("processed");
    expect(message.patient?.reference).toBe("Patient/unipat-11195429");

    const patient = await getPatient("unipat-11195429");
    expect(patient.resourceType).toBe("Patient");
    expect(patient.name?.[0]?.family).toBe("ASTRAPATIENT");
  });

  test("reprocessing same ASTRA message produces same Patient.id (idempotent)", async () => {
    const hl7Message = await loadFixture("adt-a01/identity-system/astra-unipat-pid2.hl7");

    // Process first time
    const message1 = await submitAndProcessAdtA01(hl7Message);
    expect(message1.patient?.reference).toBe("Patient/unipat-11195429");

    // Process second time — same Patient.id, upsert not duplicate
    const message2 = await submitAndProcessAdtA01(hl7Message);
    expect(message2.patient?.reference).toBe("Patient/unipat-11195429");

    const patient = await getPatient("unipat-11195429");
    expect(patient.id).toBe("unipat-11195429");
  });
});
