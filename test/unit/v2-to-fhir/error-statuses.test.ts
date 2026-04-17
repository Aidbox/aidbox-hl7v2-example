/**
 * Tests for the 4 error status types in the HL7v2→FHIR pipeline.
 *
 * - parsing_error:      malformed HL7v2, parseMessage() fails
 * - conversion_error:   valid HL7v2 but converter rejects (missing required data)
 * - code_mapping_error: unmapped code, Tasks created for resolution
 * - sending_error:      submitBundle() fails (tested via parseSendingAttempt helper)
 */
import { describe, test, expect, afterEach } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { convertMessage, parseSendingAttempt } from "../../../src/v2-to-fhir/processor-service";
import { convertADT_A01 } from "../../../src/v2-to-fhir/messages/adt-a01";
import { convertORU_R01 } from "../../../src/v2-to-fhir/messages/oru-r01";
import { buildMappingErrorResult } from "../../../src/code-mapping/mapping-errors";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import { clearConfigCache } from "../../../src/v2-to-fhir/config";
import { makeTestContext } from "./helpers";

afterEach(() => {
  clearConfigCache();
});

// ============================================================================
// Test Messages
// ============================================================================

const VALID_ADT_A01 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG001|P|2.5.1|||AL|AL",
  "EVN|A01|20231215143000",
  "PID|1||PAT-001^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||V12345^^^HOSPITAL&urn:oid:1.2.3&ISO|||||||||||||||||||||||||||20231215140000",
].join("\r");

// Missing PV1 segment — conversion_error when PV1 required
const ADT_A01_MISSING_PV1 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG002|P|2.5.1|||AL|AL",
  "EVN|A01|20231215143000",
  "PID|1||PAT-002^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
].join("\r");

// PV1-19 empty — conversion_error (visit number required but missing)
const ADT_A01_EMPTY_PV1_19 = [
  "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ADT^A01^ADT_A01|MSG003|P|2.5.1|||AL|AL",
  "EVN|A01|20231215143000",
  "PID|1||PAT-003^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
  "PV1|1|I|WARD1^ROOM1^BED1||||||||||||||||||||||||||||||||||||||||20231215140000",
].join("\r");

// ============================================================================
// 1. parsing_error — malformed HL7v2
// ============================================================================

describe("parsing_error", () => {
  function makeMessage(rawContent: string): IncomingHL7v2Message {
    return {
      resourceType: "IncomingHL7v2Message",
      message: rawContent,
      type: "UNKNOWN",
      status: "received",
    };
  }

  test("empty message body returns parsing_error", async () => {
    const result = await convertMessage(makeMessage(""));
    expect(result.messageUpdate.status).toBe("parsing_error");
    expect(result.messageUpdate.error).toContain("MSH");
    expect(result.bundle).toBeUndefined();
  });

  test("garbage string returns parsing_error", async () => {
    const result = await convertMessage(makeMessage("not a valid hl7v2 message at all"));
    expect(result.messageUpdate.status).toBe("parsing_error");
    expect(result.messageUpdate.error).toBeDefined();
  });

  test("random text without MSH returns parsing_error", async () => {
    const result = await convertMessage(makeMessage("PID|1||PAT-001^^^HOSPITAL^MR\rPV1|1|I"));
    expect(result.messageUpdate.status).toBe("parsing_error");
    expect(result.messageUpdate.error).toContain("MSH");
  });

  test("valid HL7v2 does NOT return parsing_error", async () => {
    const result = await convertMessage(makeMessage(VALID_ADT_A01));
    expect(result.messageUpdate.status).not.toBe("parsing_error");
  });
});

// ============================================================================
// 2. conversion_error — valid HL7v2, missing/invalid data
// ============================================================================

describe("conversion_error", () => {
  test("missing PV1 when required returns conversion_error", async () => {
    const parsed = parseMessage(ADT_A01_MISSING_PV1);
    const result = await convertADT_A01(parsed, makeTestContext());
    expect(result.messageUpdate.status).toBe("conversion_error");
    expect(result.messageUpdate.error).toContain("PV1");
  });

  test("empty PV1-19 with fix-authority preprocessor returns conversion_error", async () => {
    const result = await convertMessage({
      resourceType: "IncomingHL7v2Message",
      message: ADT_A01_EMPTY_PV1_19,
      type: "ADT^A01",
      status: "received",
    });
    expect(result.messageUpdate.status).toBe("conversion_error");
    expect(result.messageUpdate.error).toContain("PV1-19");
  });

  test("unsupported message type throws (caught as conversion_error by processNextMessage)", async () => {
    const unsupportedMsg = [
      "MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|20231215143000||ZZZ^Z99|MSG099|P|2.5.1|||AL|AL",
      "PID|1||PAT-099^^^HOSPITAL^MR||TEST^PATIENT||20000101|M",
    ].join("\r");

    // convertMessage lets this throw — processNextMessage catches it and sets conversion_error
    await expect(
      convertMessage({
        resourceType: "IncomingHL7v2Message",
        message: unsupportedMsg,
        type: "ZZZ^Z99",
        status: "received",
      }),
    ).rejects.toThrow("Unsupported message type");
  });
});

// ============================================================================
// 3. code_mapping_error — unmapped codes
// ============================================================================

describe("code_mapping_error", () => {
  test("buildMappingErrorResult returns code_mapping_error with Tasks", () => {
    const result = buildMappingErrorResult(
      { sendingApplication: "APP", sendingFacility: "FAC" },
      [
        {
          localCode: "XY",
          localDisplay: "Unknown Patient Class",
          localSystem: "http://terminology.hl7.org/CodeSystem/v2-0004",
          mappingType: "patient-class",
        },
      ],
    );

    expect(result.messageUpdate.status).toBe("code_mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0]!.localCode).toBe("XY");
    expect(result.bundle?.entry).toHaveLength(1);
    expect(result.bundle!.entry![0]!.resource?.resourceType).toBe("Task");
  });

  test("multiple unmapped codes produce multiple Tasks", () => {
    const result = buildMappingErrorResult(
      { sendingApplication: "APP", sendingFacility: "FAC" },
      [
        {
          localCode: "XY",
          localSystem: "http://terminology.hl7.org/CodeSystem/v2-0004",
          mappingType: "patient-class",
        },
        {
          localCode: "LOCAL123",
          localSystem: "urn:local:lab-codes",
          mappingType: "observation-code-loinc",
        },
      ],
    );

    expect(result.messageUpdate.status).toBe("code_mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(2);
    expect(result.bundle?.entry).toHaveLength(2);
  });
});

// ============================================================================
// 4. sending_error — submitBundle() failure + auto-retry
// ============================================================================

describe("sending_error", () => {
  describe("parseSendingAttempt", () => {
    test("returns 0 for undefined (no previous attempts)", () => {
      expect(parseSendingAttempt(undefined)).toBe(0);
    });

    test("returns 0 for unrelated error message", () => {
      expect(parseSendingAttempt("PV1-19 is required but missing")).toBe(0);
    });

    test("returns 0 for empty string", () => {
      expect(parseSendingAttempt("")).toBe(0);
    });

    test("parses attempt 1", () => {
      expect(
        parseSendingAttempt("Sending failed (attempt 1/3): Connection refused"),
      ).toBe(1);
    });

    test("parses attempt 2", () => {
      expect(
        parseSendingAttempt("Sending failed (attempt 2/3): timeout"),
      ).toBe(2);
    });

    test("parses attempt 3 (max)", () => {
      expect(
        parseSendingAttempt("Sending failed (attempt 3/3): 422 Unprocessable Entity"),
      ).toBe(3);
    });
  });

  // Note: full sending_error integration (actual submitBundle failure + auto-retry)
  // requires a running Aidbox instance and is tested in integration tests.
  // The parseSendingAttempt + handleSendingError logic is the unit-testable part.
});
