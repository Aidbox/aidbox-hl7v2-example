import { describe, test, expect } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { preprocessMessage } from "../../../src/v2-to-fhir/preprocessor";
import type { Hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";
import { clearConfigCache, hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";
import { fromPID, fromPV1 } from "../../../src/hl7v2/generated/fields";

/** Minimal valid identity rules for tests that don't focus on identity validation. */
const minimalRules = [{ assigner: "UNIPAT" }];

// Config with fix-authority-with-msh preprocessor enabled for both message types
const configWithMshFallback: Hl7v2ToFhirConfig = {
  identitySystem: { patient: { rules: minimalRules } },
  messages: {
    "ORU-R01": {
      preprocess: { PV1: { "19": ["fix-authority-with-msh"] } },
      converter: { PV1: { required: false } },
    },
    "ADT-A01": {
      preprocess: { PV1: { "19": ["fix-authority-with-msh"] } },
      converter: { PV1: { required: true } },
    },
  },
};

// Config without preprocess section
const configWithoutPreprocess: Hl7v2ToFhirConfig = {
  identitySystem: { patient: { rules: minimalRules } },
  messages: {
    "ORU-R01": {
      converter: { PV1: { required: false } },
    },
    "ADT-A01": {
      converter: { PV1: { required: true } },
    },
  },
};

function findPv1Segment(parsed: ReturnType<typeof parseMessage>) {
  return parsed.find((s) => s.segment === "PV1");
}

function getPv1_19Authority(parsed: ReturnType<typeof parseMessage>): string | undefined {
  const pv1Segment = findPv1Segment(parsed);
  if (!pv1Segment) return undefined;
  const pv1 = fromPV1(pv1Segment);
  return pv1.$19_visitNumber?.$4_system?.$1_namespace;
}

describe("preprocessMessage", () => {
  describe("message with no preprocess config", () => {
    test("returns message unchanged when no preprocess config exists", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithoutPreprocess);

      expect(result).toBe(parsed); // Same reference
      expect(getPv1_19Authority(result)).toBeUndefined();
    });

    test("returns message unchanged for unsupported message type", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORM^O01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(result).toBe(parsed);
    });
  });

  describe("ORU with missing PV1-19 authority and fix-authority-with-msh enabled", () => {
    test("populates CX.4 from MSH-3 and MSH-4 namespaces when PV1-19 has no authority", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(getPv1_19Authority(result)).toBe("LAB-HOSPITAL");
    });

    test("uses only namespace even when universal ID is present in MSH", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB&1.2.3.4&ISO|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      // PV1-19 gets namespace only, universal ID is not copied to authority
      expect(getPv1_19Authority(result)).toBe("LAB-HOSPITAL");
    });

    test("uses MSH-4 namespace when MSH-3 has no namespace", () => {
      const rawMessage = [
        "MSH|^~\\&||HOSPITAL&2.3.4.5&ISO||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      // Only MSH-4 namespace used (MSH-3 has no namespace)
      expect(getPv1_19Authority(result)).toBe("HOSPITAL");
    });
  });

  describe("ORU with existing CX.4 authority", () => {
    test("does not overwrite existing CX.4", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345^^^EXISTING&9.9.9.9&ISO",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(getPv1_19Authority(result)).toBe("EXISTING");
    });

    test("does not overwrite when CX.4 has only namespace", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345^^^ExistingNS",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(getPv1_19Authority(result)).toBe("ExistingNS");
    });
  });

  describe("ADT with missing PV1-19 authority and fix-authority-with-msh enabled", () => {
    test("populates CX.4 from MSH-3 and MSH-4 for ADT-A01", () => {
      const rawMessage = [
        "MSH|^~\\&|ADMISSIONS|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||ENC-789",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(getPv1_19Authority(result)).toBe("ADMISSIONS-HOSPITAL");
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

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(result).toBe(parsed);
    });
  });

  describe("edge cases", () => {
    test("handles empty MSH-3 and MSH-4 gracefully", () => {
      const rawMessage = [
        "MSH|^~\\&||||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      // No MSH authority available
      expect(getPv1_19Authority(result)).toBeUndefined();
    });

    test("handles PV1-19 with empty value", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      // No visit number value to attach authority to
      expect(getPv1_19Authority(result)).toBeUndefined();
    });
  });

  describe("preprocessor composition", () => {
    test("empty preprocessor list returns message unchanged", () => {
      const config: Hl7v2ToFhirConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ORU-R01": {
            preprocess: { PV1: { "19": [] } },
          },
        },
      };

      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, config);

      expect(getPv1_19Authority(result)).toBeUndefined();
    });

    test("processes only when configured field is present", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1", // PV1-19 not present
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      expect(getPv1_19Authority(result)).toBeUndefined();
    });
  });

  describe("message type extraction", () => {
    test("extracts ORU-R01 from MSH-9", () => {
      const rawMessage = [
        "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      // Should have processed (config key is "ORU-R01")
      expect(getPv1_19Authority(result)).toBe("LAB-HOSPITAL");
    });

    test("extracts ADT-A01 from MSH-9", () => {
      const rawMessage = [
        "MSH|^~\\&|ADMISSIONS|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
        "PID|1||TEST-001^^^HOSP^MR||DOE^JOHN||19800101|M",
        "PV1|1|I|WARD1||||||||||||||||V12345",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, configWithMshFallback);

      // Should have processed (config key is "ADT-A01")
      expect(getPv1_19Authority(result)).toBe("ADMISSIONS-HOSPITAL");
    });
  });

  describe("PID preprocessors via preprocessMessage", () => {
    test("PID.2 and PID.3 preprocessors fire in order on full message", () => {
      const config: Hl7v2ToFhirConfig = {
        identitySystem: { patient: { rules: minimalRules } },
        messages: {
          "ADT-A01": {
            preprocess: {
              PID: {
                "2": ["move-pid2-into-pid3"],
                "3": ["inject-authority-from-msh"],
              },
            },
          },
        },
      };

      const rawMessage = [
        "MSH|^~\\&|ASTRA|HOSP||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
        "PID|1|99999^^^UNIPAT^PI|12345^^^^MR",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, config);
      const pidSeg = result.find((s) => s.segment === "PID");
      const pid = fromPID(pidSeg!);

      // PID-2 cleared by move-pid2-into-pid3
      expect(pid.$2_patientId?.$1_value).toBeUndefined();

      // PID-3 has 2 entries (original bare CX + moved PID-2)
      expect(pid.$3_identifier).toHaveLength(2);

      // Bare CX (12345^^^^MR) should have MSH authority injected
      expect(pid.$3_identifier![0]!.$1_value).toBe("12345");
      expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBe("ASTRA-HOSP");

      // Moved PID-2 (99999^^^UNIPAT^PI) should keep UNIPAT authority
      expect(pid.$3_identifier![1]!.$1_value).toBe("99999");
      expect(pid.$3_identifier![1]!.$4_system?.$1_namespace).toBe("UNIPAT");
    });

    test("unknown PID preprocessor ID throws at config load time", () => {
      const tmpDir = require("os").tmpdir();
      const tmpPath = `${tmpDir}/hl7v2-test-unknown-pid-preproc-${Date.now()}.json`;

      const invalidConfig = {
        identitySystem: { patient: { rules: [{ assigner: "UNIPAT" }] } },
        messages: {
          "ADT-A01": {
            preprocess: {
              PID: { "2": ["nonexistent-pid-preprocessor"] },
            },
          },
        },
      };

      require("fs").writeFileSync(tmpPath, JSON.stringify(invalidConfig));
      process.env.HL7V2_TO_FHIR_CONFIG = tmpPath;
      clearConfigCache();

      try {
        expect(() => hl7v2ToFhirConfig()).toThrow("Unknown preprocessor ID");
      } finally {
        delete process.env.HL7V2_TO_FHIR_CONFIG;
        clearConfigCache();
        require("fs").unlinkSync(tmpPath);
      }
    });
  });
});
