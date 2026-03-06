import { describe, test, expect } from "bun:test";
import {
  loadFixture,
  aidboxFetch,
  createTestConceptMapForType,
  getConditions,
  getCoverages,
  getEncounters,
  getMappingTasks,
  getMedicationRequests,
  getObservations,
  getPatient,
  getServiceRequests,
  submitAndProcess,
} from "../helpers";
import { processNextMessage } from "../../../src/v2-to-fhir/processor-service";
import { resolveTaskAndUpdateMessages } from "../../../src/api/task-resolution";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";

async function submitAndProcessOrm(hl7Message: string): Promise<IncomingHL7v2Message> {
  return submitAndProcess(hl7Message, "ORM^O01");
}

describe("ORM_O01 E2E Integration", () => {
  test("happy path OBR order creates ServiceRequest, Condition, and Patient", async () => {
    const hl7Message = await loadFixture("orm-o01/base-obr.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");
    expect(message.patient?.reference).toContain("Patient/");

    const patientRef = message.patient!.reference!;
    const patientId = patientRef.replace("Patient/", "");
    const patient = await getPatient(patientId);
    expect(patient.resourceType).toBe("Patient");

    const serviceRequests = await getServiceRequests(patientRef);
    expect(serviceRequests.length).toBe(1);
    expect(serviceRequests[0]!.status).toBe("active");

    const conditions = await getConditions(patientRef);
    expect(conditions.length).toBe(1);
  });

  test("happy path RXO order creates MedicationRequest", async () => {
    const hl7Message = await loadFixture("orm-o01/base-rxo.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");

    const patientRef = message.patient!.reference!;
    const medicationRequests = await getMedicationRequests(patientRef);
    expect(medicationRequests.length).toBe(1);
    expect(medicationRequests[0]!.intent).toBe("original-order");
  });

  test("multiple OBR orders produce two ServiceRequests", async () => {
    const hl7Message = await loadFixture("orm-o01/multi-obr.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");

    const patientRef = message.patient!.reference!;
    const serviceRequests = await getServiceRequests(patientRef);
    expect(serviceRequests.length).toBe(2);
  });

  test("multiple RXO orders with DG1/OBX/NTE create MedicationRequests, Conditions, and Observations", async () => {
    const hl7Message = await loadFixture("orm-o01/multi-rxo.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");

    const patientRef = message.patient!.reference!;
    const medicationRequests = await getMedicationRequests(patientRef);
    const conditions = await getConditions(patientRef);
    const observations = await getObservations(patientRef);

    expect(medicationRequests.length).toBe(2);
    expect(conditions.length).toBe(2);
    expect(observations.length).toBe(2);
    expect(medicationRequests.some((mr) => (mr.note?.[0]?.text ?? "").length > 0)).toBe(true);
  });

  test("non-standard ORC-5 triggers mapping_error status and Task creation", async () => {
    const hl7Message = await loadFixture("orm-o01/non-standard-orc5.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("mapping_error");

    const tasks = await getMappingTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.code?.coding?.[0]?.code).toBe("orc-status");
  });

  test("ORC-5 mapping resolution after ConceptMap created reprocesses message", async () => {
    const hl7Message = await loadFixture("orm-o01/non-standard-orc5.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("mapping_error");

    await createTestConceptMapForType("ORMAPP", "FACC", "orc-status", [
      {
        localCode: "Final",
        localSystem: "http://terminology.hl7.org/CodeSystem/v2-0038",
        targetCode: "completed",
        targetDisplay: "Completed",
      },
    ]);

    const tasks = await getMappingTasks();
    expect(tasks.length).toBe(1);
    const task = tasks[0]!;

    await resolveTaskAndUpdateMessages(task.id!, "completed", "Completed");
    await processNextMessage();

    const updated = await aidboxFetch<IncomingHL7v2Message>(`/fhir/IncomingHL7v2Message/${message.id}`);
    expect(updated.status).toBe("processed");

    const patientRef = updated.patient!.reference!;
    const serviceRequests = await getServiceRequests(patientRef);
    expect(serviceRequests.length).toBe(1);
    expect(serviceRequests[0]!.status).toBe("completed");
  });

  test("IN1 segments create Coverage resources", async () => {
    const hl7Message = await loadFixture("orm-o01/with-insurance.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");

    const patientRef = message.patient!.reference!;
    const coverages = await getCoverages(patientRef);
    expect(coverages.length).toBe(2);
  });

  test("missing PV1 processes normally and no Encounter is created", async () => {
    const hl7Message = await loadFixture("orm-o01/no-pv1.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");

    const patientRef = message.patient!.reference!;
    const encounters = await getEncounters(patientRef);
    expect(encounters.length).toBe(0);
  });

  test("unknown patient creates draft Patient with active=false", async () => {
    const hl7Message = await loadFixture("orm-o01/new-patient.hl7");
    const message = await submitAndProcessOrm(hl7Message);

    expect(message.status).toBe("processed");

    const patientRef = message.patient!.reference!;
    const patientId = patientRef.replace("Patient/", "");
    const patient = await getPatient(patientId);

    expect(patient.active).toBe(false);
  });
});
