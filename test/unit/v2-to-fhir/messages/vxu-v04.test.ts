/**
 * Unit tests for VXU_V04 message converter.
 * Tests the complete VXU conversion pipeline including:
 * - ORDER group extraction and Immunization creation
 * - PERSON_OBSERVATION handling
 * - Patient/Encounter handling (reusing ORU patterns)
 * - CDC IIS enrichment integration
 */

import { describe, test, expect, afterEach } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { generateImmunizationId, convertVXU_V04 } from "../../../../src/v2-to-fhir/messages/vxu-v04";
import type { ORC } from "../../../../src/hl7v2/generated/fields";
import type { Immunization, Patient, Encounter } from "../../../../src/fhir/hl7-fhir-r4-core";
import { clearConfigCache } from "../../../../src/v2-to-fhir/config";
import { makeTestContext } from "../helpers";
import { readFileSync } from "fs";
import { resolve } from "path";

afterEach(() => {
  clearConfigCache();
});

function readVXUFixture(name: string): string {
  return readFileSync(resolve("test/fixtures/hl7v2/vxu-v04", name), "utf-8");
}

type BundleLike = {
  bundle?: { entry?: Array<{ resource?: { resourceType?: string } }> };
};

function findResources<T>(result: BundleLike, type: string): T[] {
  return (result.bundle?.entry ?? [])
    .filter((e) => e.resource?.resourceType === type)
    .map((e) => e.resource as T);
}

const TODO = () => { /* placeholder */ };

describe("convertVXU_V04", () => {
  describe("base conversion", () => {
    test("single ORDER produces Immunization with vaccineCode, status=completed, occurrenceDateTime", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      // "warning" because PV1|1|R has no PV1-19 visit number → identifier warning
      expect(result.messageUpdate.status).toBe("warning");
      expect(result.bundle).toBeDefined();

      const immunizations = findResources<Immunization>(result, "Immunization");
      expect(immunizations).toHaveLength(1);

      const imm = immunizations[0]!;
      expect(imm.status).toBe("completed");
      expect(imm.vaccineCode.coding?.[0]?.code).toBe("08");
      expect(imm.vaccineCode.coding?.[0]?.system).toBe("http://hl7.org/fhir/sid/cvx");
      expect(imm.occurrenceDateTime).toBe("2016-07-01");
    });

    test("Immunization.id is deterministic from ORC-3 with authority scoping", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const immunizations = findResources<Immunization>(result, "Immunization");
      expect(immunizations[0]!.id).toBe("dcs-65930");
    });

    test("doseQuantity populated from RXA-6/7 when valid numeric", async () => {
      // multiple-orders.hl7 has RXA-6=0.5, RXA-7=mL (valid numeric)
      const msg = readVXUFixture("multiple-orders.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.doseQuantity).toBeDefined();
      expect(imm.doseQuantity!.value).toBe(0.5);
      expect(imm.doseQuantity!.unit).toBe("mL");
    });

    test("route from RXR-1, site from RXR-2", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.route?.coding?.[0]?.code).toBe("IM");
      expect(imm.site?.coding?.[0]?.code).toBe("LA");
    });

    test("identifiers: ORC-3 -> type=FILL", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      const fillId = imm.identifier?.find((id) => id.type?.coding?.[0]?.code === "FILL");
      expect(fillId).toBeDefined();
      expect(fillId!.value).toBe("65930");
    });

    test("recorded from ORC-9 (primary)", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.recorded).toBe("2016-07-01");
    });

    test("CDC IIS OBX fields applied (programEligibility, fundingSource, education)", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.programEligibility).toBeDefined();
      expect(imm.programEligibility?.[0]?.coding?.[0]?.code).toBe("V02");
      expect(imm.fundingSource).toBeDefined();
      expect(imm.fundingSource?.coding?.[0]?.code).toBe("VXC1");
      expect(imm.education).toBeDefined();
      expect(imm.education).toHaveLength(1);
    });

    test("RXA-9 NIP001 source applied (primarySource/reportOrigin)", async () => {
      // base.hl7 has RXA-9 = 01^HISTORICAL^NIP001 → primarySource=false
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.primarySource).toBe(false);
      expect(imm.reportOrigin).toBeDefined();
      expect(imm.reportOrigin?.coding?.[0]?.code).toBe("01");
    });
  });

  describe("multiple orders", () => {
    test("multiple ORDER groups produce multiple Immunization resources with distinct IDs", async () => {
      const msg = readVXUFixture("multiple-orders.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      // "warning" because PV1|1|R has no PV1-19 visit number → identifier warning
      expect(result.messageUpdate.status).toBe("warning");

      const immunizations = findResources<Immunization>(result, "Immunization");
      expect(immunizations).toHaveLength(2);

      // Different ORC-3 filler numbers → different IDs
      const ids = immunizations.map((imm) => imm.id);
      expect(ids[0]).not.toBe(ids[1]);
      expect(ids[0]).toBe("dcs-65930");
      expect(ids[1]).toBe("dcs-65934");

      // Different vaccines
      expect(immunizations[0]!.vaccineCode.coding?.[0]?.code).toBe("08");
      expect(immunizations[1]!.vaccineCode.coding?.[0]?.code).toBe("10");
    });
  });

  describe("patient handling", () => {
    test("unknown patient creates draft with active=false", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const patients = findResources<Patient>(result, "Patient");
      expect(patients).toHaveLength(1);
      expect(patients[0]!.active).toBe(false);
    });

    test("existing patient is referenced, not recreated", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const context = makeTestContext({
        lookupPatient: async () => ({ resourceType: "Patient", id: "myemr-pa123456" }),
      });
      const result = await convertVXU_V04(parsed, context);

      const patients = findResources<Patient>(result, "Patient");
      expect(patients).toHaveLength(0);

      // Immunization still references the patient
      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.patient.reference).toContain("Patient/");
    });
  });

  describe("encounter handling", () => {
    test("PV1 optional: missing PV1 produces processed status, no Encounter", async () => {
      // Build a message without PV1
      const msg = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20160701||VXU^V04^VXU_V04|CA0099|P|2.5.1",
        "PID|1||PA123456^^^MYEMR^MR||JONES^GEORGE||20140227|M",
        "ORC|RE||65930^DCS||||||20160701",
        "RXA|0|1|20160701||08^HEPB^CVX|999|||00^NEW^NIP001|||||||||||CP|A",
      ].join("\r");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      expect(result.messageUpdate.status).toBe("processed");

      const encounters = findResources<Encounter>(result, "Encounter");
      expect(encounters).toHaveLength(0);

      // Immunization.encounter omitted
      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.encounter).toBeUndefined();
    });

    test("valid PV1 creates Encounter, Immunization.encounter references it", async () => {
      const msg = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20160701||VXU^V04^VXU_V04|CA0099|P|2.5.1",
        "PID|1||PA123456^^^MYEMR^MR||JONES^GEORGE||20140227|M",
        "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||V12345^^^HOSPITAL&urn:oid:1.2.3&ISO",
        "ORC|RE||65930^DCS||||||20160701",
        "RXA|0|1|20160701||08^HEPB^CVX|999|||00^NEW^NIP001|||||||||||CP|A",
      ].join("\r");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      expect(result.messageUpdate.status).toBe("processed");

      const encounters = findResources<Encounter>(result, "Encounter");
      expect(encounters).toHaveLength(1);

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.encounter).toBeDefined();
      expect(imm.encounter!.reference).toContain("Encounter/");
    });
  });

  describe("error conditions", () => {
    test("missing RXA in ORDER group returns error", async () => {
      const msg = readVXUFixture("error/missing-rxa.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      expect(result.messageUpdate.status).toBe("error");
      expect(result.messageUpdate.error).toContain("RXA");
    });
  });

  describe("ID generation", () => {
    // Default fallback args for ORC-based tests (ORC paths don't use these)
    const fallbackArgs = { patientId: "patient-1", cvxCode: "08", adminDateTime: "20160701" };

    test("ORC-3 with namespace authority produces scoped Immunization ID", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "65930", $2_namespace: "DCS" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("dcs-65930");
    });

    test("ORC-3 with system authority (EI.3) when namespace (EI.2) empty", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "65930", $3_system: "urn:oid:1.2.3" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("urn-oid-1-2-3-65930");
    });

    test("ORC-2 used when ORC-3 is missing", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $2_placerOrderNumber: { $1_value: "PL-100", $2_namespace: "CLINIC" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("clinic-pl-100");
    });

    test("ORC present but ORC-3 and ORC-2 both empty uses natural-key fallback", () => {
      const orc: ORC = { $1_orderControl: "RE" };
      const id = generateImmunizationId(orc, "MyEMR", "patient-1", "08", "20160701");
      expect(id).toBe("myemr-patient-1-08-20160701");
    });

    test("ORC absent uses natural-key fallback (patient + vaccine + date)", () => {
      const id = generateImmunizationId(undefined, "MyEMR", "patient-1", "08", "20160701");
      expect(id).toBe("myemr-patient-1-08-20160701");
    });

    test("same vaccine+patient+date in two calls produces same ID (cross-message idempotency)", () => {
      const id1 = generateImmunizationId(undefined, "MyEMR", "patient-1", "08", "20160701");
      const id2 = generateImmunizationId(undefined, "MyEMR", "patient-1", "08", "20160701");
      expect(id1).toBe(id2);
    });

    test("different vaccine same date produces different ID", () => {
      const id1 = generateImmunizationId(undefined, "MyEMR", "patient-1", "08", "20160701");
      const id2 = generateImmunizationId(undefined, "MyEMR", "patient-1", "21", "20160701");
      expect(id1).not.toBe(id2);
    });

    test("same vaccine different date produces different ID", () => {
      const id1 = generateImmunizationId(undefined, "MyEMR", "patient-1", "08", "20160701");
      const id2 = generateImmunizationId(undefined, "MyEMR", "patient-1", "08", "20170315");
      expect(id1).not.toBe(id2);
    });

    test("ORC-3 without authority still uses value (no authority prefix)", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "65930" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("65930");
    });

    test("sanitizes special characters in ID", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "ORDER #123", $2_namespace: "MY EMR" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("my-emr-order--123");
    });

    test("ORC-3 preferred over ORC-2 when both present", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $2_placerOrderNumber: { $1_value: "PL-100", $2_namespace: "CLINIC" },
        $3_fillerOrderNumber: { $1_value: "65930", $2_namespace: "DCS" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("dcs-65930");
    });

    test("whitespace-only EI value falls through to natural-key fallback", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "   " },
      };
      const id = generateImmunizationId(orc, "MyEMR", "patient-1", "08", "20160701");
      expect(id).toBe("myemr-patient-1-08-20160701");
    });

    test("whitespace-only namespace falls through to system authority", () => {
      const orc: ORC = {
        $1_orderControl: "RE",
        $3_fillerOrderNumber: { $1_value: "65930", $2_namespace: "  ", $3_system: "urn:oid:1.2.3" },
      };
      const id = generateImmunizationId(orc, "MyEMR", fallbackArgs.patientId, fallbackArgs.cvxCode, fallbackArgs.adminDateTime);
      expect(id).toBe("urn-oid-1-2-3-65930");
    });

    test.todo("ORDER group without ORC: no FILL/PLAC identifiers, no ordering provider", TODO);
    test.todo("ORDER group without ORC: recorded from RXA-22 fallback if RXA-21=A", TODO);
  });

  describe("performers", () => {
    test("RXA-10 creates performer with function=AP, ORC-12 with function=OP", async () => {
      const msg = readVXUFixture("base.hl7");
      const parsed = parseMessage(msg);
      const result = await convertVXU_V04(parsed, makeTestContext());

      const imm = findResources<Immunization>(result, "Immunization")[0]!;
      expect(imm.performer).toBeDefined();
      expect(imm.performer!.length).toBeGreaterThanOrEqual(1);

      // ORC-12 ordering provider
      const opPerformer = imm.performer!.find((p) => p.function?.coding?.[0]?.code === "OP");
      expect(opPerformer).toBeDefined();
      expect(opPerformer!.actor.reference).toContain("PractitionerRole/");
    });
  });

  describe("status derivation", () => {
    test.todo("RXA-20=CP produces status=completed", TODO);
    test.todo("RXA-20=PA produces status=completed with isSubpotent=true", TODO);
    test.todo("RXA-20=RE produces status=not-done with statusReason from RXA-18", TODO);
    test.todo("RXA-20=NA produces status=not-done without statusReason", TODO);
    test.todo("RXA-20 empty/missing defaults to status=completed", TODO);
    test.todo("RXA-21=D overrides RXA-20, produces status=entered-in-error", TODO);
  });

  describe("CDC IIS enrichment", () => {
    test.todo("RXA-9 NIP001 code '00' sets primarySource=true", TODO);
    test.todo("RXA-9 NIP001 code '01' sets primarySource=false, reportOrigin populated", TODO);
    test.todo("OBX 64994-7 maps to programEligibility", TODO);
    test.todo("OBX 30963-3 maps to fundingSource", TODO);
    test.todo("VIS OBX group (69764-9 + 29768-9 + 29769-7) grouped by OBX-4 into education[]", TODO);
    test.todo("OBX 30973-2 maps to protocolApplied.doseNumber", TODO);
    test.todo("unknown ORDER OBX LOINC code produces error status", TODO);
    test.todo("ORDER OBX without LOINC coding system produces error", TODO);
    test.todo("enrichment works for ORC-less ORDER group with OBX via positional matching", TODO);
  });

  describe("PERSON_OBSERVATION", () => {
    test.todo("OBX before first ORC/RXA creates standalone Observation with subject=Patient", TODO);
    test.todo("PERSON_OBSERVATION OBX uses normal LOINC resolution pipeline", TODO);
  });

  describe("preprocessors", () => {
    test.todo("RXA-6 preprocessor: '999' cleared, no doseQuantity", TODO);
    test.todo("RXA-6 preprocessor: '0.3 mL' extracts value=0.3, unit=mL in RXA-7", TODO);
    test.todo("RXA-6 preprocessor: '0' preserved, doseQuantity.value=0", TODO);
    test.todo("RXA-9 preprocessor: bare '00' gets NIP001 system injected", TODO);
    test.todo("RXR with empty RXR-1: route omitted, site preserved", TODO);
  });
});
