/**
 * Integration tests for VXU_V04 message processing.
 *
 * These tests verify end-to-end message processing against a real Aidbox instance.
 * They test the complete pipeline: message submission -> processing -> resource creation.
 *
 * Note: Fixtures with minimal PV1 (PV1|1|R, no PV1-19) produce "warning" status
 * because the encounter handler warns about missing visit number. This is expected
 * behavior — FHIR resources are still created.
 */

import { describe, test, expect } from "bun:test";
import {
  loadFixture,
  getImmunizations,
  getObservations,
  getPatient,
  submitAndProcess,
} from "../helpers";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";

async function submitAndProcessVxu(hl7Message: string): Promise<IncomingHL7v2Message> {
  return submitAndProcess(hl7Message, "VXU^V04");
}

/** Asserts message processed successfully (warning is acceptable — PV1 without PV1-19 warns) */
function expectSuccessStatus(message: IncomingHL7v2Message): void {
  expect(message.status === "processed" || message.status === "warning").toBe(true);
  expect(message.patient?.reference).toContain("Patient/");
}

describe("VXU_V04 E2E Integration", () => {
  describe("happy path", () => {
    test("processes base VXU and creates Immunization + Patient in Aidbox", async () => {
      const hl7Message = await loadFixture("vxu-v04/base.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientRef = message.patient!.reference!;
      const immunizations = await getImmunizations(patientRef);
      expect(immunizations.length).toBe(1);

      const imm = immunizations[0]!;
      // vaccineCode — CVX 08
      expect(imm.vaccineCode.coding?.[0]?.code).toBe("08");
      expect(imm.vaccineCode.coding?.[0]?.system).toBe("http://hl7.org/fhir/sid/cvx");
      // status — RXA-20 empty defaults to completed
      expect(imm.status).toBe("completed");
      // occurrenceDateTime — RXA-3
      expect(imm.occurrenceDateTime).toBe("2016-07-01");
      // RXA-6=999 → no doseQuantity (preprocessor clears)
      expect(imm.doseQuantity).toBeUndefined();
      // route — RXR-1
      expect(imm.route?.coding?.[0]?.code).toBe("IM");
      // site — RXR-2
      expect(imm.site?.coding?.[0]?.code).toBe("LA");

      // ORC-3 provides FILL identifier
      const fillId = imm.identifier?.find((id) => id.type?.coding?.[0]?.code === "FILL");
      expect(fillId?.value).toBe("65930");

      // Performers
      expect(imm.performer).toBeDefined();
      expect(imm.performer!.length).toBeGreaterThanOrEqual(1);

      // CDC IIS fields from ORDER OBX
      expect(imm.programEligibility).toBeDefined();
      expect(imm.programEligibility![0]?.coding?.[0]?.code).toBe("V02");
      expect(imm.fundingSource?.coding?.[0]?.code).toBe("VXC1");
      // VIS education
      expect(imm.education).toBeDefined();
      expect(imm.education!.length).toBeGreaterThanOrEqual(1);

      // RXA-9 NIP001 "01" → historical
      expect(imm.primarySource).toBe(false);
      expect(imm.reportOrigin).toBeDefined();
    });

    test("creates draft Patient with correct demographics", async () => {
      const hl7Message = await loadFixture("vxu-v04/base.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientId = message.patient!.reference!.split("/")[1]!;
      const patient = await getPatient(patientId);

      expect(patient.active).toBe(false);
      expect(patient.name?.[0]?.family).toBe("JONES");
      expect(patient.name?.[0]?.given).toContain("GEORGE");
      expect(patient.gender).toBe("male");
      expect(patient.birthDate).toBe("2014-02-27");
    });
  });

  describe("idempotent reprocessing", () => {
    test("same VXU processed twice produces same resources (no duplicates)", async () => {
      const hl7Message = await loadFixture("vxu-v04/base.hl7");

      // Process first time
      const message1 = await submitAndProcessVxu(hl7Message);
      expectSuccessStatus(message1);
      const patientRef = message1.patient!.reference!;

      const immAfterFirst = await getImmunizations(patientRef);
      expect(immAfterFirst.length).toBe(1);
      const firstImmId = immAfterFirst[0]!.id;

      // Process second time
      await submitAndProcessVxu(hl7Message);

      const immAfterSecond = await getImmunizations(patientRef);
      // Should still be only 1 Immunization (idempotent)
      expect(immAfterSecond.length).toBe(1);
      expect(immAfterSecond[0]!.id).toBe(firstImmId);
    });
  });

  describe("CDC IIS fields", () => {
    test("base fixture has programEligibility, fundingSource, and education on Immunization", async () => {
      const hl7Message = await loadFixture("vxu-v04/base.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientRef = message.patient!.reference!;
      const immunizations = await getImmunizations(patientRef);
      const imm = immunizations[0]!;

      // programEligibility from OBX 64994-7
      expect(imm.programEligibility).toBeDefined();
      expect(imm.programEligibility![0]?.coding?.[0]?.code).toBe("V02");

      // fundingSource from OBX 30963-3
      expect(imm.fundingSource).toBeDefined();
      expect(imm.fundingSource!.coding?.[0]?.code).toBe("VXC1");

      // education from VIS OBX group (69764-9 + 29768-9 + 29769-7)
      expect(imm.education).toBeDefined();
      expect(imm.education!.length).toBe(1);
      const edu = imm.education![0]!;
      expect(edu.documentType).toBeDefined();
      expect(edu.publicationDate).toBe("2012-02-02");
      expect(edu.presentationDate).toBe("2016-07-01");
    });
  });

  describe("PERSON_OBSERVATION", () => {
    test("VXU with PERSON_OBSERVATION OBX creates standalone Observation", async () => {
      const hl7Message = await loadFixture("vxu-v04/with-person-observations.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientRef = message.patient!.reference!;
      const observations = await getObservations(patientRef);

      // Should have at least 1 standalone Observation from PERSON_OBSERVATION OBX
      expect(observations.length).toBeGreaterThanOrEqual(1);
      const obs = observations[0]!;
      expect(obs.code?.coding?.[0]?.code).toBe("59784-9");
      expect(obs.subject?.reference).toBe(patientRef);
    });
  });

  describe("multiple orders", () => {
    test("VXU with multiple ORDER groups creates multiple Immunizations with distinct IDs", async () => {
      const hl7Message = await loadFixture("vxu-v04/multiple-orders.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientRef = message.patient!.reference!;
      const immunizations = await getImmunizations(patientRef);

      expect(immunizations.length).toBe(2);

      // Distinct IDs
      const ids = immunizations.map((i) => i.id);
      expect(ids[0]).not.toBe(ids[1]);

      // Different vaccines
      const codes = immunizations.map((i) => i.vaccineCode.coding?.[0]?.code).sort();
      expect(codes).toContain("08"); // HEPB
      expect(codes).toContain("10"); // IPV
    });
  });

  describe("no ORC (real-world pattern)", () => {
    test("VXU without ORC creates Immunization with fallback ID", async () => {
      const hl7Message = await loadFixture("vxu-v04/no-orc.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientRef = message.patient!.reference!;
      const immunizations = await getImmunizations(patientRef);

      expect(immunizations.length).toBe(1);
      const imm = immunizations[0]!;

      // No FILL/PLAC identifiers when ORC absent
      const fillId = imm.identifier?.find((id) => id.type?.coding?.[0]?.code === "FILL");
      const placId = imm.identifier?.find((id) => id.type?.coding?.[0]?.code === "PLAC");
      expect(fillId).toBeUndefined();
      expect(placId).toBeUndefined();

      // Still has correct vaccine
      expect(imm.vaccineCode.coding?.[0]?.code).toBe("08");
      expect(imm.status).toBe("completed");
    });
  });

  describe("not-administered", () => {
    test("RXA-20=RE creates Immunization with status=not-done", async () => {
      const hl7Message = await loadFixture("vxu-v04/not-administered.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expectSuccessStatus(message);

      const patientRef = message.patient!.reference!;
      const immunizations = await getImmunizations(patientRef);

      expect(immunizations.length).toBe(1);
      expect(immunizations[0]!.status).toBe("not-done");
    });
  });

  describe("error conditions", () => {
    test("VXU with unknown ORDER OBX LOINC code results in error status", async () => {
      const hl7Message = await loadFixture("vxu-v04/error/unknown-order-obx.hl7");
      const message = await submitAndProcessVxu(hl7Message);

      expect(message.status).toBe("error");
      expect(message.error).toMatch(/99999-9|Unknown OBX/i);
    });
  });
});
