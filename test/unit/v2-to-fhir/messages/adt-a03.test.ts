import { describe, test, expect, afterEach } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { convertADT_A03 } from "../../../../src/v2-to-fhir/messages/adt-a03";
import type { Encounter, Patient } from "../../../../src/fhir/hl7-fhir-r4-core";
import { clearConfigCache } from "../../../../src/v2-to-fhir/config";
import { makeTestContext } from "../helpers";

const TEST_CONFIG = join(__dirname, "../../../fixtures/config/hl7v2-to-fhir.json");

afterEach(() => {
  clearConfigCache();
});

// ADT-A03 message with valid PV1-19 authority (CX.4 populated) and PV1-44/45 dates
const adtA03WithValidPV1 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20260301143000||ADT^A03^ADT_A03|MSG-A03-T01|P|2.5.1|||AL|AL",
  "EVN|A03|20260301143000|||OPERATOR",
  "PID|1||PAT-001^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|E|WARD1^ROOM1^BED1||||||||||||||||V12345^^^HOSPITAL&urn:oid:1.2.3&ISO|||||||||||||||||||||||||||20260301090000|20260301101500",
].join("\r");

// ADT-A03 message without PV1 segment
const adtA03WithoutPV1 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20260301143000||ADT^A03^ADT_A03|MSG-A03-T02|P|2.5.1|||AL|AL",
  "EVN|A03|20260301143000|||OPERATOR",
  "PID|1||PAT-002^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
].join("\r");

// ADT-A03 message with PV1-19 but missing authority
const adtA03WithInvalidAuthority = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20260301143000||ADT^A03^ADT_A03|MSG-A03-T03|P|2.5.1|||AL|AL",
  "EVN|A03|20260301143000|||OPERATOR",
  "PID|1||PAT-003^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|E|WARD1^ROOM1^BED1||||||||||||||||V12345|||||||||||||||||||||||||||20260301090000|20260301101500",
].join("\r");

// ADT-A03 with optional segments (NK1, DG1, AL1, IN1)
const adtA03WithOptionalSegments = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20260301143000||ADT^A03^ADT_A03|MSG-A03-T04|P|2.5.1|||AL|AL",
  "EVN|A03|20260301143000|||OPERATOR",
  "PID|1||PAT-004^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|E|WARD1^ROOM1^BED1||||||||||||||||V12345^^^HOSPITAL&urn:oid:1.2.3&ISO|||||||||||||||||||||||||||20260301090000|20260301101500",
  "NK1|1|SPOUSE^JOHN||SPO",
  "DG1|1|I9C|E11.9||Type 2 diabetes",
  "AL1|1||06^PENICILLIN",
  "IN1|1|HMO|PLAN123|HEALTH PLAN INC",
].join("\r");

describe("convertADT_A03 - discharge converter", () => {
  test("ADT-A03 with valid PV1-19 creates Encounter with status finished", async () => {
    const parsed = parseMessage(adtA03WithValidPV1);
    const result = await convertADT_A03(parsed, makeTestContext());

    expect(result.messageUpdate.status).toBe("processed");
    expect(result.entries).toBeDefined();

    const patient = result.entries!.find(
      (r) => r.resourceType === "Patient",
    ) as Patient | undefined;
    expect(patient).toBeDefined();

    const encounter = result.entries!.find(
      (r) => r.resourceType === "Encounter",
    ) as Encounter | undefined;
    expect(encounter).toBeDefined();
    expect(encounter!.status).toBe("finished");
  });

  describe("PV1 required=true (default)", () => {
    test("ADT-A03 with missing PV1 returns conversion_error", async () => {
      const parsed = parseMessage(adtA03WithoutPV1);
      const result = await convertADT_A03(parsed, makeTestContext());

      expect(result.messageUpdate.status).toBe("conversion_error");
      expect(result.messageUpdate.error).toContain("PV1");
    });

    test("ADT-A03 with invalid PV1-19 authority returns conversion_error", async () => {
      const parsed = parseMessage(adtA03WithInvalidAuthority);
      const result = await convertADT_A03(parsed, makeTestContext());

      expect(result.messageUpdate.status).toBe("conversion_error");
      expect(result.messageUpdate.error).toContain("authority");
    });
  });

  test("ADT-A03 with valid NK1/DG1/AL1/IN1 includes all resource types", async () => {
    const parsed = parseMessage(adtA03WithOptionalSegments);
    const result = await convertADT_A03(parsed, makeTestContext());

    expect(result.messageUpdate.status).toBe("processed");
    expect(result.entries).toBeDefined();

    const resourceTypes = new Set(result.entries!.map((r) => r.resourceType));
    expect(resourceTypes.has("Patient")).toBe(true);
    expect(resourceTypes.has("Encounter")).toBe(true);
    expect(resourceTypes.has("RelatedPerson")).toBe(true);
    expect(resourceTypes.has("Condition")).toBe(true);
    expect(resourceTypes.has("AllergyIntolerance")).toBe(true);
    expect(resourceTypes.has("Coverage")).toBe(true);

    const relatedPersons = result.entries!.filter(
      (r) => r.resourceType === "RelatedPerson",
    );
    expect(relatedPersons.length).toBeGreaterThanOrEqual(1);

    const conditions = result.entries!.filter((r) => r.resourceType === "Condition");
    expect(conditions.length).toBeGreaterThanOrEqual(1);

    const allergies = result.entries!.filter(
      (r) => r.resourceType === "AllergyIntolerance",
    );
    expect(allergies.length).toBeGreaterThanOrEqual(1);

    const coverages = result.entries!.filter((r) => r.resourceType === "Coverage");
    expect(coverages.length).toBeGreaterThanOrEqual(1);
  });

  test("smoke: ADT_A03 discharge from example message", async () => {
    const examplePath = join(
      __dirname,
      "../../../../test/fixtures/hl7v2/adt-a03/example-01.hl7",
    );
    const messageText = readFileSync(examplePath, "utf-8");

    // Example message lacks PV1-19, so configure with required=false for smoke test
    const config = JSON.parse(readFileSync(TEST_CONFIG, "utf-8"));
    config.messages["ADT-A03"] = config.messages["ADT-A03"] || {};
    config.messages["ADT-A03"].converter = {
      PV1: { required: false },
    };

    const parsed = parseMessage(messageText);
    const result = await convertADT_A03(parsed, makeTestContext({ config }));

    expect(
      result.messageUpdate.status === "processed" ||
        result.messageUpdate.status === "warning",
    ).toBe(true);

    expect(result.entries).toBeDefined();

    const patient = result.entries!.find((r) => r.resourceType === "Patient");
    expect(patient).toBeDefined();

    const encounter = result.entries!.find((r) => r.resourceType === "Encounter");
    if (encounter) {
      const enc = encounter as Encounter;
      expect(enc.status).toBe("finished");
      expect(enc.period?.end).toBeDefined();
    }
  });
});
