import { describe, test, expect, beforeAll, afterAll, afterEach } from "bun:test";
import { join } from "path";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { convertADT_A01 } from "../../../../src/v2-to-fhir/messages/adt-a01";
import type { Encounter } from "../../../../src/fhir/hl7-fhir-r4-core";
import { clearConfigCache } from "../../../../src/v2-to-fhir/config";
import { defaultPatientIdResolver } from "../../../../src/v2-to-fhir/identity-system/patient-id";

const TEST_CONFIG = join(__dirname, "../../../fixtures/config/hl7v2-to-fhir.json");

afterEach(() => {
  clearConfigCache();
});

// ADT message with valid PV1-19 authority (CX.4 populated)
const adtWithValidPV1 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG-ADT-T01|P|2.5.1|||AL|AL",
  "EVN|A01|20231215143000|||OPERATOR",
  "PID|1||PAT-001^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||V12345^^^HOSPITAL&urn:oid:1.2.3&ISO|||||||||||||||||||||||||||20231215140000",
].join("\r");

// ADT message without PV1 segment
const adtWithoutPV1 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG-ADT-T02|P|2.5.1|||AL|AL",
  "EVN|A01|20231215143000|||OPERATOR",
  "PID|1||PAT-002^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
].join("\r");

// ADT message with PV1-19 but missing authority (CX.4/9/10 all empty)
const adtWithInvalidAuthority = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG-ADT-T03|P|2.5.1|||AL|AL",
  "EVN|A01|20231215143000|||OPERATOR",
  "PID|1||PAT-003^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||V12345|||||||||||||||||||||||||||20231215140000",
].join("\r");

describe("convertADT_A01 - config-driven PV1 policy", () => {
  test("ADT with valid PV1 creates Encounter with unified ID", async () => {
    const parsed = parseMessage(adtWithValidPV1);
    const result = await convertADT_A01(parsed, defaultPatientIdResolver());

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

  describe("PV1 required=false", () => {
    let savedConfig: string | undefined;

    beforeAll(() => {
      savedConfig = process.env.HL7V2_TO_FHIR_CONFIG;
      process.env.HL7V2_TO_FHIR_CONFIG = TEST_CONFIG;
      clearConfigCache();
    });

    afterAll(() => {
      if (savedConfig === undefined) {
        delete process.env.HL7V2_TO_FHIR_CONFIG;
      } else {
        process.env.HL7V2_TO_FHIR_CONFIG = savedConfig;
      }
      clearConfigCache();
    });

    test("ADT with missing PV1 returns warning, skips Encounter", async () => {
      const parsed = parseMessage(adtWithoutPV1);
      const result = await convertADT_A01(parsed, defaultPatientIdResolver());

      expect(result.messageUpdate.status).toBe("warning");
      expect(result.messageUpdate.error).toContain("PV1");
      expect(result.bundle).toBeDefined();

      const encounterEntry = result.bundle!.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      expect(encounterEntry).toBeUndefined();
    });

    test("ADT with invalid PV1-19 authority returns warning, skips Encounter", async () => {
      const parsed = parseMessage(adtWithInvalidAuthority);
      const result = await convertADT_A01(parsed, defaultPatientIdResolver());

      expect(result.messageUpdate.status).toBe("warning");
      expect(result.messageUpdate.error).toContain("authority");
      expect(result.bundle).toBeDefined();

      const encounterEntry = result.bundle!.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      expect(encounterEntry).toBeUndefined();
    });
  });
});
