import { describe, test, expect, afterEach } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { convertORU_R01 } from "../../../../src/v2-to-fhir/messages/oru-r01";
import type { Patient, Encounter } from "../../../../src/fhir/hl7-fhir-r4-core";
import { clearConfigCache } from "../../../../src/v2-to-fhir/config";
import { defaultPatientIdResolver } from "../../../../src/v2-to-fhir/identity-system/patient-id";

afterEach(() => {
  clearConfigCache();
});

// Mock lookups that always return null (no existing resources)
const noExistingPatient = async () => null;
const noExistingEncounter = async () => null;

// ORU message with valid PV1-19 authority (CX.4 populated)
const oruWithValidPV1 = [
  "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG-001|P|2.5.1",
  "PID|1||PAT-001^^^HOSPITAL^MR||TEST^PATIENT||20000101|F",
  "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||V12345^^^HOSPITAL&urn:oid:1.2.3&ISO",
  "OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F",
  "OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F",
].join("\r");

// ORU message without PV1 segment
const oruWithoutPV1 = [
  "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG-002|P|2.5.1",
  "PID|1||PAT-002^^^HOSPITAL^MR||TEST^PATIENT||20000101|F",
  "OBR|1|ORD001|FIL002|LAB123|||20260101|||||||||||||||20260101||Lab|F",
  "OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F",
].join("\r");

// ORU message with PV1-19 but missing authority (CX.4/9/10 all empty)
const oruWithInvalidAuthority = [
  "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG-003|P|2.5.1",
  "PID|1||PAT-003^^^HOSPITAL^MR||TEST^PATIENT||20000101|F",
  "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||V12345",
  "OBR|1|ORD001|FIL003|LAB123|||20260101|||||||||||||||20260101||Lab|F",
  "OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F",
].join("\r");

describe("convertORU_R01 - config-driven PV1 policy", () => {
  test("ORU with valid PV1 creates Encounter with unified ID", async () => {
    const parsed = parseMessage(oruWithValidPV1);
    const result = await convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver());

    expect(result.messageUpdate.status).toBe("processed");
    expect(result.bundle).toBeDefined();

    const encounterEntry = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "Encounter",
    );
    expect(encounterEntry).toBeDefined();

    const encounter = encounterEntry!.resource as Encounter;
    expect(encounter.id).toBe("urn-oid-1-2-3-v12345");
    expect(encounter.identifier?.[0]?.type?.coding?.[0]?.code).toBe("VN");
    expect(encounter.identifier?.[0]?.value).toBe("V12345");
  });

  test("ORU without PV1 (config: required=false) creates clinical data, no Encounter", async () => {
    const parsed = parseMessage(oruWithoutPV1);
    const result = await convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver());

    // No warning for missing PV1 when not required (PV1 absence is normal for ORU)
    expect(result.messageUpdate.status).toBe("processed");
    expect(result.bundle).toBeDefined();

    const encounterEntry = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "Encounter",
    );
    expect(encounterEntry).toBeUndefined();

    // Clinical data (DiagnosticReport, Observation) should still be created
    const reportEntry = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "DiagnosticReport",
    );
    expect(reportEntry).toBeDefined();
  });

  test("ORU with invalid PV1-19 authority (config: required=false) sets warning, preserves clinical data", async () => {
    const parsed = parseMessage(oruWithInvalidAuthority);
    const result = await convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver());

    expect(result.messageUpdate.status).toBe("warning");
    expect(result.messageUpdate.error).toBeDefined();
    expect(result.messageUpdate.error).toContain("CX.4");
    expect(result.bundle).toBeDefined();

    // No Encounter created
    const encounterEntry = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "Encounter",
    );
    expect(encounterEntry).toBeUndefined();

    // DiagnosticReport and Observations still created
    const reportEntry = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "DiagnosticReport",
    );
    expect(reportEntry).toBeDefined();

    const obsEntries = result.bundle!.entry?.filter(
      (e) => e.resource?.resourceType === "Observation",
    );
    expect(obsEntries?.length).toBeGreaterThan(0);
  });

  test("clinical data preserved when Encounter skipped due to warning", async () => {
    const parsed = parseMessage(oruWithInvalidAuthority);
    const result = await convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver());

    expect(result.bundle).toBeDefined();

    // Patient draft should still be created
    const patientEntry = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "Patient",
    );
    expect(patientEntry).toBeDefined();

    // DiagnosticReport should not reference an Encounter
    const report = result.bundle!.entry?.find(
      (e) => e.resource?.resourceType === "DiagnosticReport",
    )?.resource as any;
    expect(report?.encounter).toBeUndefined();
  });
});
