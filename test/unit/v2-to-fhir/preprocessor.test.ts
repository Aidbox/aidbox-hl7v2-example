import { describe, test, expect } from "bun:test";
import { preprocessIncomingMessage } from "../../../src/v2-to-fhir/preprocessor";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";
import type { Hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";

// Helper to create a minimal IncomingHL7v2Message
function createMessage(
  rawMessage: string,
  type: string,
  overrides: Partial<IncomingHL7v2Message> = {},
): IncomingHL7v2Message {
  return {
    resourceType: "IncomingHL7v2Message",
    message: rawMessage,
    type,
    ...overrides,
  };
}

// Config with MSH fallback enabled for both message types
const configWithMshFallback: Hl7v2ToFhirConfig = {
  "ORU-R01": {
    preprocess: { PV1: { "19": { authorityFallback: { source: "msh" } } } },
    converter: { PV1: { required: false } },
  },
  "ADT-A01": {
    preprocess: { PV1: { "19": { authorityFallback: { source: "msh" } } } },
    converter: { PV1: { required: true } },
  },
};

// Config without preprocess section
const configWithoutPreprocess: Hl7v2ToFhirConfig = {
  "ORU-R01": {
    converter: { PV1: { required: false } },
  },
  "ADT-A01": {
    converter: { PV1: { required: true } },
  },
};

describe("preprocessIncomingMessage", () => {
  describe("message with no preprocess config", () => {
    test("returns message unchanged when no preprocess config exists", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithoutPreprocess);

      expect(result).toBe(message); // Same reference, unchanged
      expect(result.message).toBe(rawMessage);
    });

    test("returns message unchanged for unsupported message type", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORM^O01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
      ].join("\r");

      const message = createMessage(rawMessage, "ORM^O01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message);
    });
  });

  describe("ORU with missing PV1-19 authority and MSH fallback enabled", () => {
    test("populates CX.4 from MSH-3 namespace when PV1-19 has no authority", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).not.toBe(message); // New object
      expect(result.message).toContain("V12345^^^LAB");
    });

    test("populates CX.4 with MSH-3 system (universal ID) when available", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB&1.2.3.4&ISO|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result.message).toContain("V12345^^^LAB&1.2.3.4&ISO");
    });

    test("uses MSH-4 when MSH-3 has no namespace", () => {
      const rawMessage = [
        "MSH|^~\\&||HOSPITAL&2.3.4.5&ISO||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result.message).toContain("V12345^^^HOSPITAL&2.3.4.5&ISO");
    });
  });

  describe("ORU with existing CX.4 authority", () => {
    test("does not overwrite existing CX.4", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345^^^EXISTING&9.9.9.9&ISO",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message); // Unchanged
      expect(result.message).toContain("V12345^^^EXISTING&9.9.9.9&ISO");
    });

    test("does not overwrite when CX.4 has only namespace", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345^^^ExistingNS",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message);
      expect(result.message).toContain("V12345^^^ExistingNS");
    });
  });

  describe("ADT with missing PV1-19 authority and MSH fallback enabled", () => {
    test("populates CX.4 from MSH-3 for ADT-A01", () => {
      const rawMessage = [
        "MSH|^~\\&|ADMISSIONS|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||ENC-789",
      ].join("\r");

      const message = createMessage(rawMessage, "ADT^A01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).not.toBe(message);
      expect(result.message).toContain("ENC-789^^^ADMISSIONS");
    });
  });

  describe("message with no PV1 segment", () => {
    test("returns message unchanged when no PV1 segment", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "ORC|RE|ORD001|FIL001",
        "OBR|1|ORD001|FIL001|LAB123|||20260101",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message);
    });
  });

  describe("preprocessor never modifies status/error fields", () => {
    test("preserves existing status field", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01", { status: "received" });
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result.status).toBe("received");
    });

    test("preserves existing error field", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01", { error: "previous error" });
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result.error).toBe("previous error");
    });

    test("does not add status field when message is modified", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      delete (message as { status?: string }).status;

      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result.status).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    test("handles empty MSH-3 and MSH-4 gracefully", () => {
      const rawMessage = [
        "MSH|^~\\&||||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message); // No MSH authority, unchanged
    });

    test("handles PV1-19 with empty value", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||",
      ].join("\r");

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message); // No visit number value, unchanged
    });

    test("handles malformed message gracefully", () => {
      const rawMessage = "not a valid HL7v2 message";

      const message = createMessage(rawMessage, "ORU^R01");
      const result = preprocessIncomingMessage(message, configWithMshFallback);

      expect(result).toBe(message); // Returns unchanged on parse error
    });
  });
});
