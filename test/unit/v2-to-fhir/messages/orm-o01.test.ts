import { afterEach, describe, expect, test } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import type {
  Bundle,
  Condition,
  Encounter,
  MedicationRequest,
  Observation,
  ServiceRequest,
  Coverage,
} from "../../../../src/fhir/hl7-fhir-r4-core";
import { clearConfigCache } from "../../../../src/v2-to-fhir/config";
import { convertORM_O01 } from "../../../../src/v2-to-fhir/messages/orm-o01";
import { makeTestContext } from "../helpers";

const MSH = "MSH|^~\\&|ORMAPP|ORMFAC||DEST|20260101120000||ORM^O01|MSG-001|P|2.5.1";
const PID = "PID|1||PAT-001^^^ORMFAC^MR||DOE^JANE||19800101|F";
const PV1_VALID = "PV1|1|I|||||||||||||||||V12345^^^ORMFAC&urn:oid:1.2.3&ISO";
const PV1_NO_VISIT = "PV1|1|I";
const PV1_EMPTY = "PV1|";

function segment(name: string, fields: Record<number, string>): string {
  const indexes = Object.keys(fields).map((key) => parseInt(key, 10));
  const maxIndex = indexes.length > 0 ? Math.max(...indexes) : 0;
  const parts = new Array(maxIndex + 1).fill("");
  parts[0] = name;

  for (const [fieldIndex, value] of Object.entries(fields)) {
    parts[parseInt(fieldIndex, 10)] = value;
  }

  return parts.join("|");
}

function parseOrmMessage(lines: string[]) {
  return parseMessage(lines.join("\r"));
}

async function convert(lines: string[]) {
  const parsed = parseOrmMessage(lines);
  return await convertORM_O01(parsed, makeTestContext());
}

function getResources<T extends { resourceType: string }>(bundle: Bundle | undefined, resourceType: string): T[] {
  if (!bundle?.entry) {
    return [];
  }

  return bundle.entry
    .map((entry) => entry.resource)
    .filter((resource) => resource?.resourceType === resourceType) as T[];
}

afterEach(() => {
  clearConfigCache();
});

describe("convertORM_O01", () => {
  test("ORM with single OBR order produces ServiceRequest with intent=order, code, and identifiers", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const serviceRequests = getResources<ServiceRequest>(result.bundle, "ServiceRequest");

    expect(serviceRequests).toHaveLength(1);
    expect(serviceRequests[0]!.intent).toBe("order");
    expect(serviceRequests[0]!.code?.coding?.[0]?.code).toBe("12345");
    expect(serviceRequests[0]!.identifier?.some((id) => id.type?.coding?.[0]?.code === "PLAC")).toBe(true);
  });

  test("ORM with single RXO order produces MedicationRequest with intent=original-order and medication code", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "RX-001", 5: "SC" }),
      segment("RXO", { 1: "RX001^Amoxicillin^NDC", 2: "1", 4: "TAB^Tablet^UCUM" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const medicationRequests = getResources<MedicationRequest>(result.bundle, "MedicationRequest");

    expect(medicationRequests).toHaveLength(1);
    expect(medicationRequests[0]!.intent).toBe("original-order");
    expect(medicationRequests[0]!.medicationCodeableConcept?.coding?.[0]?.code).toBe("RX001");
  });

  test("ORM with multiple OBR orders produces multiple ServiceRequests with distinct IDs", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "11111^CBC^LN" }),
      segment("ORC", { 1: "NW", 2: "ORD-002", 5: "SC" }),
      segment("OBR", { 1: "2", 2: "ORD-002", 4: "22222^BMP^LN" }),
    ]);

    const serviceRequests = getResources<ServiceRequest>(result.bundle, "ServiceRequest");
    expect(serviceRequests).toHaveLength(2);
    expect(new Set(serviceRequests.map((sr) => sr.id)).size).toBe(2);
  });

  test("ORM with multiple RXO orders produces multiple MedicationRequests", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "RX-001", 5: "SC" }),
      segment("RXO", { 1: "RX001^Amoxicillin^NDC" }),
      segment("ORC", { 1: "NW", 2: "RX-002", 5: "SC" }),
      segment("RXO", { 1: "RX002^Ibuprofen^NDC" }),
    ]);

    const medicationRequests = getResources<MedicationRequest>(result.bundle, "MedicationRequest");
    expect(medicationRequests).toHaveLength(2);
  });

  test("DG1 segments produce Conditions linked via ServiceRequest.reasonReference", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("DG1", { 1: "1", 3: "E11.9^Type 2 diabetes mellitus^I10" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    const conditions = getResources<Condition>(result.bundle, "Condition");

    expect(conditions).toHaveLength(1);
    expect(serviceRequest.reasonReference).toHaveLength(1);
    expect(serviceRequest.reasonReference?.[0]?.reference).toBe("Condition/ord-001-dg1-1");
  });

  test("NTE segments produce ServiceRequest.note entries", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("NTE", { 1: "1", 3: "Clinical note" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.note).toHaveLength(1);
    expect(serviceRequest.note?.[0]?.text).toContain("Clinical note");
  });

  test("OBX segments produce Observations linked via ServiceRequest.supportingInfo", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("OBX", { 1: "1", 2: "ST", 3: "Q001^Question^99LOCAL", 5: "YES", 11: "F" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    const observations = getResources<Observation>(result.bundle, "Observation");

    expect(observations).toHaveLength(1);
    expect(serviceRequest.supportingInfo).toHaveLength(1);
    expect(String(serviceRequest.supportingInfo?.[0]?.reference)).toBe("Observation/ord-001-obx-1");
  });

  test("IN1 segments produce Coverage resources", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("IN1", { 1: "1", 2: "PLAN001^Commercial", 3: "PAYOR001", 4: "Acme Health" }),
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    const coverages = getResources<Coverage>(result.bundle, "Coverage");
    expect(coverages.length).toBeGreaterThan(0);
  });

  test("OBX in ORM context does not trigger LOINC resolution", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("OBX", { 1: "1", 2: "ST", 3: "LOCAL-OBS^Ask At Order^99LOCAL", 5: "YES", 11: "F" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const observation = getResources<Observation>(result.bundle, "Observation")[0]!;

    expect(observation.code.coding?.[0]?.code).toBe("LOCAL-OBS");
    expect(observation.code.coding?.[0]?.system).toBe("99LOCAL");
  });

  test("missing OBX-11 defaults to Observation.status=registered", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("OBX", { 1: "1", 2: "ST", 3: "Q001^Question^99LOCAL", 5: "YES" }),
    ]);

    const observation = getResources<Observation>(result.bundle, "Observation")[0]!;
    expect(observation.status).toBe("registered");
  });

  test("ServiceRequest.status from ORC-5 standard value SC -> active", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.status).toBe("active");
  });

  test("ServiceRequest.status from ORC-1 NW when ORC-5 empty -> active", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.status).toBe("active");
  });

  test("ServiceRequest.status unknown when both ORC-1 and ORC-5 empty", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 2: "ORD-001" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.status).toBe("unknown");
  });

  test("missing PID rejects message with status=error", async () => {
    const result = await convert([
      MSH,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("error");
    expect(result.messageUpdate.error).toContain("PID");
  });

  test("missing ORC-2 and OBR-2 rejects order group", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 5: "SC" }),
      segment("OBR", { 1: "1", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("error");
    expect(result.messageUpdate.error).toContain("No processable order groups");
  });

  test("ORM without PV1 processes normally", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const encounters = getResources<Encounter>(result.bundle, "Encounter");
    expect(encounters).toHaveLength(0);
  });

  test("ORM with empty PV1 processes normally (treated as absent)", async () => {
    const result = await convert([
      MSH,
      PID,
      PV1_EMPTY,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const encounters = getResources<Encounter>(result.bundle, "Encounter");
    expect(encounters).toHaveLength(0);
  });

  test("ORM with valid PV1-19 creates Encounter", async () => {
    const result = await convert([
      MSH,
      PID,
      PV1_VALID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const encounters = getResources<Encounter>(result.bundle, "Encounter");
    expect(encounters).toHaveLength(1);
  });

  test("ORM with PV1 but no PV1-19 skips Encounter with processed status", async () => {
    const result = await convert([
      MSH,
      PID,
      PV1_NO_VISIT,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    expect(result.messageUpdate.status).toBe("processed");
    const encounters = getResources<Encounter>(result.bundle, "Encounter");
    expect(encounters).toHaveLength(0);
  });

  test("deterministic ServiceRequest ID from ORC-2", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-ABC-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-ABC-001", 4: "12345^CBC^LN" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.id).toBe("ord-abc-001");
  });

  test("deterministic Condition ID from order + position", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("DG1", { 1: "1", 3: "E11.9^Type 2 diabetes mellitus^I10" }),
    ]);

    const condition = getResources<Condition>(result.bundle, "Condition")[0]!;
    expect(condition.id).toBe("ord-001-dg1-1");
  });

  test("deterministic Observation ID from order + position", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("OBX", { 1: "1", 2: "ST", 3: "Q001^Question^99LOCAL", 5: "YES", 11: "F" }),
    ]);

    const observation = getResources<Observation>(result.bundle, "Observation")[0]!;
    expect(observation.id).toBe("ord-001-obx-1");
  });

  test("OBR-11 G overrides ServiceRequest.intent to reflex-order", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN", 11: "G" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.intent).toBe("reflex-order");
  });

  test("ORC-12 maps to ServiceRequest.requester", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC", 12: "1234^Primary^Provider" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.requester?.display).toContain("Primary");
  });

  test("OBR-16 used as requester fallback when ORC-12 is empty", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN", 16: "5678^Fallback^Provider" }),
    ]);

    const serviceRequest = getResources<ServiceRequest>(result.bundle, "ServiceRequest")[0]!;
    expect(serviceRequest.requester?.display).toContain("Fallback");
  });

  test("mixed order types in one message produces one ServiceRequest and one MedicationRequest", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "ORD-001", 5: "SC" }),
      segment("OBR", { 1: "1", 2: "ORD-001", 4: "12345^CBC^LN" }),
      segment("ORC", { 1: "NW", 2: "RX-001", 5: "SC" }),
      segment("RXO", { 1: "RX001^Amoxicillin^NDC" }),
    ]);

    expect(getResources<ServiceRequest>(result.bundle, "ServiceRequest")).toHaveLength(1);
    expect(getResources<MedicationRequest>(result.bundle, "MedicationRequest")).toHaveLength(1);
  });

  test("NTE in RXO order maps to MedicationRequest.note", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "RX-001", 5: "SC" }),
      segment("RXO", { 1: "RX001^Amoxicillin^NDC" }),
      segment("NTE", { 1: "1", 3: "Pharmacy note" }),
    ]);

    const medicationRequest = getResources<MedicationRequest>(result.bundle, "MedicationRequest")[0]!;
    expect(medicationRequest.note).toHaveLength(1);
    expect(medicationRequest.note?.[0]?.text).toContain("Pharmacy note");
  });

  test("DG1 in RXO order maps to MedicationRequest.reasonReference", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "RX-001", 5: "SC" }),
      segment("RXO", { 1: "RX001^Amoxicillin^NDC" }),
      segment("DG1", { 1: "1", 3: "J20.9^Acute bronchitis^I10" }),
    ]);

    const medicationRequest = getResources<MedicationRequest>(result.bundle, "MedicationRequest")[0]!;
    expect(medicationRequest.reasonReference).toHaveLength(1);
    expect(medicationRequest.reasonReference?.[0]?.reference).toBe("Condition/rx-001-dg1-1");
  });

  test("OBX in RXO order maps to MedicationRequest.supportingInformation", async () => {
    const result = await convert([
      MSH,
      PID,
      segment("ORC", { 1: "NW", 2: "RX-001", 5: "SC" }),
      segment("RXO", { 1: "RX001^Amoxicillin^NDC" }),
      segment("OBX", { 1: "1", 2: "ST", 3: "Q001^Question^99LOCAL", 5: "YES", 11: "F" }),
    ]);

    const medicationRequest = getResources<MedicationRequest>(result.bundle, "MedicationRequest")[0]!;
    expect(medicationRequest.supportingInformation).toHaveLength(1);
    expect(String(medicationRequest.supportingInformation?.[0]?.reference)).toBe("Observation/rx-001-obx-1");
  });
});
