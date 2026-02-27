import { describe, test, expect } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { preprocessMessage } from "../../../src/v2-to-fhir/preprocessor";
import type { Hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";
import { clearConfigCache, hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";
import { fromORC, fromPID, fromPV1, fromRXA } from "../../../src/hl7v2/generated/fields";

/** Minimal valid identity rules for tests that don't focus on identity validation. */
const minimalRules = [{ assigner: "UNIPAT" }];

// Config with fix-pv1-authority-with-msh preprocessor enabled for both message types
const configWithMshFallback: Hl7v2ToFhirConfig = {
  identitySystem: { patient: { rules: minimalRules } },
  messages: {
    "ORU-R01": {
      preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh"] } },
      converter: { PV1: { required: false } },
    },
    "ADT-A01": {
      preprocess: { PV1: { "19": ["fix-pv1-authority-with-msh"] } },
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

  describe("ORU with missing PV1-19 authority and fix-pv1-authority-with-msh enabled", () => {
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

  describe("ADT with missing PV1-19 authority and fix-pv1-authority-with-msh enabled", () => {
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

  describe("inject-authority-into-orc3", () => {
    const vxuConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: {
        "VXU-V04": {
          preprocess: { ORC: { "3": ["inject-authority-into-orc3"] } },
        },
      },
    };

    function getOrc3(parsed: ReturnType<typeof parseMessage>) {
      const orcSegment = parsed.find((s) => s.segment === "ORC");
      if (!orcSegment) return undefined;
      return fromORC(orcSegment).$3_fillerOrderNumber;
    }

    test("injects MSH namespace into ORC-3 EI.2 when authority is missing", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "ORC|RE||65930",
        "RXA|0|1|20260101||08^HEPB^CVX",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, vxuConfig);
      const orc3 = getOrc3(result);

      expect(orc3?.$1_value).toBe("65930");
      expect(orc3?.$2_namespace).toBe("MyEMR-DE-000001");
    });

    test("does not override existing EI.2 authority", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "ORC|RE||65930^ExistingNS",
        "RXA|0|1|20260101||08^HEPB^CVX",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, vxuConfig);
      const orc3 = getOrc3(result);

      expect(orc3?.$1_value).toBe("65930");
      expect(orc3?.$2_namespace).toBe("ExistingNS");
    });

    test("does not override existing EI.3 universal ID", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "ORC|RE||65930^^1.2.3.4.5",
        "RXA|0|1|20260101||08^HEPB^CVX",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, vxuConfig);
      const orc3 = getOrc3(result);

      expect(orc3?.$1_value).toBe("65930");
      expect(orc3?.$2_namespace).toBeUndefined();
      expect(orc3?.$3_system).toBe("1.2.3.4.5");
    });

    test("no change when ORC-3 is empty (no EI.1 value)", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "ORC|RE||",
        "RXA|0|1|20260101||08^HEPB^CVX",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, vxuConfig);
      const orc3 = getOrc3(result);

      expect(orc3).toBeUndefined();
    });

    test("no error when ORC segment is absent", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|DE-000001||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, vxuConfig);

      expect(getOrc3(result)).toBeUndefined();
    });
  });

  describe("normalize-rxa6-dose", () => {
    const doseConfig: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: {
        "VXU-V04": {
          preprocess: { RXA: { "6": ["normalize-rxa6-dose"] } },
        },
      },
    };

    function getRxaFields(parsed: ReturnType<typeof parseMessage>) {
      const rxaSegment = parsed.find((s) => s.segment === "RXA");
      if (!rxaSegment) return undefined;
      const rxa = fromRXA(rxaSegment);
      return {
        dose: rxa.$6_administeredAmount,
        unit: rxa.$7_administeredUnit,
      };
    }

    test('"999" sentinel is cleared (no doseQuantity)', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);

      expect(getRxaFields(result)?.dose).toBeUndefined();
    });

    test('"0" is preserved (valid zero dose)', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|0",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);

      expect(getRxaFields(result)?.dose).toBe("0");
    });

    test('"0.3 mL" extracts numeric and moves unit to RXA-7 when empty', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|0.3 mL",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);
      const fields = getRxaFields(result);

      expect(fields?.dose).toBe("0.3");
      expect(fields?.unit?.$1_code).toBe("mL");
    });

    test('"0.3 mL" with existing RXA-7 does not overwrite unit', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|0.3 mL|mL^milliliter^UCUM",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);
      const fields = getRxaFields(result);

      expect(fields?.dose).toBe("0.3");
      expect(fields?.unit?.$1_code).toBe("mL");
      expect(fields?.unit?.$2_text).toBe("milliliter");
      expect(fields?.unit?.$3_system).toBe("UCUM");
    });

    test('"0.3" is preserved as-is (already numeric)', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|0.3",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);

      expect(getRxaFields(result)?.dose).toBe("0.3");
    });

    test('"abc" unparseable is cleared', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|abc",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);

      expect(getRxaFields(result)?.dose).toBeUndefined();
    });

    test("empty RXA-6 is no-op", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, doseConfig);

      expect(getRxaFields(result)?.dose).toBeUndefined();
    });
  });

  describe("normalize-rxa9-nip001", () => {
    const nip001Config: Hl7v2ToFhirConfig = {
      identitySystem: { patient: { rules: minimalRules } },
      messages: {
        "VXU-V04": {
          preprocess: { RXA: { "9": ["normalize-rxa9-nip001"] } },
        },
      },
    };

    function getRxa9(parsed: ReturnType<typeof parseMessage>) {
      const rxaSegment = parsed.find((s) => s.segment === "RXA");
      if (!rxaSegment) return undefined;
      return fromRXA(rxaSegment).$9_administrationNotes;
    }

    test('bare "00" without system gets NIP001 injected', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999|||00",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);
      const notes = getRxa9(result);

      expect(notes).toHaveLength(1);
      expect(notes![0]!.$1_code).toBe("00");
      expect(notes![0]!.$3_system).toBe("NIP001");
    });

    test('bare "01" without system gets NIP001 injected', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999|||01^Historical",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);
      const notes = getRxa9(result);

      expect(notes).toHaveLength(1);
      expect(notes![0]!.$1_code).toBe("01");
      expect(notes![0]!.$2_text).toBe("Historical");
      expect(notes![0]!.$3_system).toBe("NIP001");
    });

    test('"00" with NIP001 already set is unchanged', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999|||00^New Record^NIP001",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);
      const notes = getRxa9(result);

      expect(notes).toHaveLength(1);
      expect(notes![0]!.$1_code).toBe("00");
      expect(notes![0]!.$3_system).toBe("NIP001");
    });

    test('"02" without system is not modified (not a NIP001 code)', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999|||02^Other",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);
      const notes = getRxa9(result);

      expect(notes).toHaveLength(1);
      expect(notes![0]!.$1_code).toBe("02");
      expect(notes![0]!.$3_system).toBeUndefined();
    });

    test("empty RXA-9 is no error", () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);

      expect(getRxa9(result)).toBeUndefined();
    });

    test("repeating RXA-9: injects NIP001 into bare 01, leaves non-NIP001 code unchanged", () => {
      // ~ is the HL7v2 repeat separator
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999|||01~02^Other",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);
      const notes = getRxa9(result);

      expect(notes).toHaveLength(2);
      expect(notes![0]!.$1_code).toBe("01");
      expect(notes![0]!.$3_system).toBe("NIP001");
      expect(notes![1]!.$1_code).toBe("02");
      expect(notes![1]!.$3_system).toBeUndefined();
    });

    test('"00" with non-NIP001 system is not overwritten', () => {
      const rawMessage = [
        "MSH|^~\\&|MyEMR|HOSP||DEST|20260105||VXU^V04|MSG001|P|2.5.1",
        "PID|1||PA123^^^MYEMR^MR||DOE^JOHN||19800101|M",
        "RXA|0|1|20260101||08^HEPB^CVX|999|||00^New^OTHERSYS",
      ].join("\r");

      const parsed = parseMessage(rawMessage);
      const result = preprocessMessage(parsed, nip001Config);
      const notes = getRxa9(result);

      expect(notes).toHaveLength(1);
      expect(notes![0]!.$1_code).toBe("00");
      expect(notes![0]!.$3_system).toBe("OTHERSYS");
    });
  });
});
