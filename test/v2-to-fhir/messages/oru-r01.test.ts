import { describe, test, expect, beforeEach, mock } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import type {
  Bundle,
  DiagnosticReport,
  Observation,
  Specimen,
} from "../../../src/fhir/hl7-fhir-r4-core";
import type { OBX } from "../../../src/hl7v2/generated/fields";
import type { SenderContext } from "../../../src/code-mapping/concept-map";

// Sample ORU_R01 message with single OBR and multiple OBX
const SIMPLE_ORU_MESSAGE = `MSH|^~\\&|LABSYS|TESTHOSP||RECV|20260106171422||ORU^R01|MSG123|P|2.5.1
PID|1||TEST-0001^^^HOSPITAL^MR||TESTPATIENT^ALPHA^^^^^D||20000101|F
PV1|1|I|WARD1^ROOM1^BED1||||PROV001^TEST^PROVIDER|||||||||VN001
ORC|RE|R26-0002636^External|26H-006MP0004^Beaker
OBR|1|R26-0002636^External|26H-006MP0004^Beaker|LAB5524^JAK 2 MUTATION^LABBEAP|||20260106154900|||||||Blood|PROV001^TEST^PROVIDER|||||||20260106171411||Lab|F
OBX|1|ST|1230148171^JAK2 V617F^LABBLRR^46342-2^JAK2 gene mutation^LN||Detected||||||F|||20260106154900
OBX|2|NM|1230148217^VAF %^LABBLRR^81246-9^Variant allelic frequency^LN||1.0|%|||||F|||20260106154900`;

// Message with LOINC codes in alternate coding
const MESSAGE_WITH_LOINC = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105091743||ORU^R01^ORU_R01|183316|P|2.5.1
PID|1||TEST-0002^^^HOSPITAL^MR||TESTPATIENT^BETA||20000202|F
PV1|1||UNIT1|||||||||||||||VN002
ORC|RE|R26-TEST00012^External|26ORM-005CH00006^Beaker
OBR|1|R26-TEST00012^External|26ORM-005CH00006^Beaker|LAB90^HEMOGLOBIN A1C^4MEAP|||20260105091000|||||||Blood|PROV002^TEST^LABTECH||||||||20260105091739||Lab|F
OBX|0|NM|1237770270^HBA1C^4MLRR^4548-4^Hemoglobin A1c^LN||6.2|%|4.0-6.0|H|||F|||20260105091000`;

// Message with SPM segment
const MESSAGE_WITH_SPM = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105091743||ORU^R01^ORU_R01|183317|P|2.5.1
PID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||20000303|M
PV1|1||ICU|||||||||||||||VN003
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB17^METABOLIC PANEL^LOCAL|||20260105091000|||||||Blood|PROV003^TEST^DOCTOR||||||||20260105091739||Lab|F
OBX|1|NM|51998^Potassium^LOCAL^2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F|||20260105091000
SPM|1|||Blood^Blood|||||||||||||||20260105091000|20260105091611`;

// Message with NTE segments
const MESSAGE_WITH_NTE = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260106||ORU^R01^ORU_R01|183318|P|2.5.1
PID|1||TEST-0004^^^HOSPITAL^MR||TESTPATIENT^DELTA||20000404|F
PV1|1||MED|||||||||||||||VN004
ORC|RE|ORD002|FIL002
OBR|1|ORD002|FIL002|56117^eGFR^LOCAL|||20260106091000|||||||||||||||||20260106095000||Lab|F
OBX|1|SN|56117^eGFR^LOCAL^98979-8^eGFR^LN||>^90|mL/min/1.73 sq.m.|>60.0||||F|||20260106091000
NTE|1|L|eGFR calculation based on CKD-EPI equation.
NTE|2|L|
NTE|3|L|This test is not validated for acute illness.`;

// Message with multiple OBR groups
const MESSAGE_MULTIPLE_OBR = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260107||ORU^R01|183319|P|2.5.1
PID|1||TEST-0005^^^HOSPITAL^MR||TESTPATIENT^EPSILON||20000505|F
PV1|1||ER|||||||||||||||VN005
ORC|RE|ORD003|FIL003A
OBR|1|ORD003|FIL003A|LAB100^CBC^LOCAL|||20260107080000|||||||||||||||||20260107090000||Lab|F
OBX|1|NM|52100^WBC^LOCAL^6690-2^Leukocytes^LN||8.5|10*9/L|4.5-11.0||||F
OBX|2|NM|52101^RBC^LOCAL^789-8^Erythrocytes^LN||4.8|10*12/L|4.2-5.4||||F
ORC|RE|ORD003|FIL003B
OBR|2|ORD003|FIL003B|LAB101^BMP^LOCAL|||20260107080000|||||||||||||||||20260107091000||Lab|F
OBX|1|NM|51998^Potassium^LOCAL^2823-3^Potassium^LN||4.0|mmol/L|3.5-5.5||||F
OBX|2|NM|52098^Sodium^LOCAL^2951-2^Sodium^LN||140|mmol/L|133-145||||F`;

// Mock aidbox module to avoid actual API calls
// All test messages have inline LOINC, so ConceptMap lookup is not needed
const mockAidbox = {
  aidboxFetch: mock(() =>
    Promise.reject(new Error("HTTP 404: ConceptMap not found")),
  ),
};

// Apply mock before importing the module
mock.module("../../../src/aidbox", () => mockAidbox);

describe("convertORU_R01", () => {
  beforeEach(() => {
    mockAidbox.aidboxFetch.mockClear();
  });

  describe("happy path - basic message processing", () => {
    test("converts simple ORU_R01 to FHIR Bundle", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;

      expect(bundle.resourceType).toBe("Bundle");
      expect(bundle.type).toBe("transaction");
      expect(bundle.entry).toBeDefined();
      expect(bundle.entry!.length).toBeGreaterThan(0);
    });

    test("creates DiagnosticReport from OBR segment", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const diagnosticReports = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "DiagnosticReport")
        .map((e) => e.resource as DiagnosticReport);

      expect(diagnosticReports).toHaveLength(1);
      expect(diagnosticReports?.[0]?.id).toBe("26h-006mp0004");
      expect(diagnosticReports?.[0]?.status).toBe("final");
      expect(diagnosticReports?.[0]?.code?.coding?.[0]?.code).toBe("LAB5524");
    });

    test("creates Observations from OBX segments", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const observations = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation);

      expect(observations).toHaveLength(2);
      expect(observations?.[0]?.id).toBe("26h-006mp0004-obx-1");
      expect(observations?.[1]?.id).toBe("26h-006mp0004-obx-2");
    });

    test("links Observations to DiagnosticReport via result array", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const diagnosticReport = bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;

      expect(diagnosticReport.result).toHaveLength(2);
      expect(diagnosticReport.result?.[0]?.reference).toContain("Observation/");
    });

    test("uses PUT requests with deterministic IDs for idempotency", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;

      bundle.entry?.forEach((entry) => {
        expect(entry.request?.method).toBe("PUT");
        expect(entry.request?.url).toContain(entry.resource?.id);
      });
    });

    test("tags all resources with message control ID", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;

      bundle.entry?.forEach((entry) => {
        const tag = entry.resource?.meta?.tag?.find(
          (t: { system?: string }) =>
            t.system === "urn:aidbox:hl7v2:message-id",
        );
        expect(tag?.code).toBe("MSG123");
      });
    });
  });

  describe("LOINC code handling", () => {
    test("extracts LOINC from OBX-3 alternate coding", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_LOINC)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      const loincCoding = observation.code.coding?.find(
        (c) => c.system === "http://loinc.org",
      );
      expect(loincCoding?.code).toBe("4548-4");
    });
  });

  describe("SPM segment handling", () => {
    test("creates Specimen from SPM segment", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_SPM)))
        .bundle;
      const specimens = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Specimen")
        .map((e) => e.resource as Specimen);

      expect(specimens).toHaveLength(1);
      expect(specimens?.[0]?.type?.coding?.[0]?.code).toBe("Blood");
    });

    test("links Specimen to DiagnosticReport", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_SPM)))
        .bundle;
      const diagnosticReport = bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;

      expect(diagnosticReport.specimen).toHaveLength(1);
      expect(diagnosticReport.specimen?.[0]?.reference).toContain("Specimen/");
    });

    test("links Specimen to Observations", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_SPM)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation.specimen?.reference).toContain("Specimen/");
    });
  });

  describe("NTE segment handling", () => {
    test("attaches NTE comments to preceding Observation as notes", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_NTE)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation.note).toHaveLength(1);
      expect(observation.note?.[0]?.text).toContain("eGFR calculation");
    });

    test("creates paragraph breaks for empty NTE-3", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_NTE)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      // Should have paragraph break between first and third NTE
      expect(observation.note?.[0]?.text).toContain("\n\n");
    });
  });

  describe("multiple OBR groups", () => {
    test("creates multiple DiagnosticReports for multiple OBR groups", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_MULTIPLE_OBR)))
        .bundle;
      const diagnosticReports = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "DiagnosticReport")
        .map((e) => e.resource as DiagnosticReport);

      expect(diagnosticReports).toHaveLength(2);
      expect(diagnosticReports?.[0]?.id).toBe("fil003a");
      expect(diagnosticReports?.[1]?.id).toBe("fil003b");
    });

    test("links OBX to correct parent OBR", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_MULTIPLE_OBR)))
        .bundle;
      const observations = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation);

      // First two OBX belong to first OBR (CBC)
      expect(observations?.[0]?.id).toContain("fil003a");
      expect(observations?.[1]?.id).toContain("fil003a");

      // Second two OBX belong to second OBR (BMP)
      expect(observations?.[2]?.id).toContain("fil003b");
      expect(observations?.[3]?.id).toContain("fil003b");
    });
  });

  describe("idempotency", () => {
    test("same OBR-3 with different MSH-10 updates resources in place", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const message1 = SIMPLE_ORU_MESSAGE.replace("MSG123", "MSG001");
      const message2 = SIMPLE_ORU_MESSAGE.replace("MSG123", "MSG002");

      const bundle1 = (await convertORU_R01(parseMessage(message1))).bundle;
      const bundle2 = (await convertORU_R01(parseMessage(message2))).bundle;

      // Same resource IDs
      const dr1 = bundle1.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      );
      const dr2 = bundle2.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      );

      expect(dr1?.resource?.id).toBe(dr2?.resource?.id);

      // Different message tags
      const tag1 = dr1?.resource?.meta?.tag?.find(
        (t: { system?: string }) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      const tag2 = dr2?.resource?.meta?.tag?.find(
        (t: { system?: string }) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      expect(tag1?.code).toBe("MSG001");
      expect(tag2?.code).toBe("MSG002");
    });
  });

  describe("OBX value type handling", () => {
    test("converts NM value type to valueQuantity", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const observation = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation)
        .find((o) => o.id?.includes("obx-2"));

      expect(observation?.valueQuantity?.value).toBe(1.0);
      expect(observation?.valueQuantity?.unit).toBe("%");
    });

    test("converts ST value type to valueString", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const observation = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation)
        .find((o) => o.id?.includes("obx-1"));

      expect(observation?.valueString).toBe("Detected");
    });

    test("converts SN with comparator to valueQuantity", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_NTE)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation?.valueQuantity?.value).toBe(90);
      expect(observation?.valueQuantity?.comparator).toBe(">");
    });
  });

  describe("interpretation and reference range", () => {
    test("converts OBX-8 abnormal flag H to interpretation", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_LOINC)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation?.interpretation?.[0]?.coding?.[0]?.code).toBe("H");
    });

    test("converts OBX-7 reference range", async () => {
      const { convertORU_R01 } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_LOINC)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation?.referenceRange?.[0]?.low?.value).toBe(4.0);
      expect(observation?.referenceRange?.[0]?.high?.value).toBe(6.0);
    });
  });
});

describe("error handling", () => {
  test("throws error when MSH segment is missing", () => {
    const invalidMessage = `PID|1||TEST-ERR1||TESTPATIENT^ERROR
OBR|1|||LAB123|||20260101`;

    // parseMessage throws when message doesn't start with MSH
    expect(() => parseMessage(invalidMessage)).toThrow(/MSH/);
  });

  test("throws error when MSH-3 (sending application) is missing", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const invalidMessage = `MSH|^~\\&||HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR||TESTPATIENT^ERROR
OBR|1||FIL001|LAB123|||20260101
OBX|1|NM|2345-7^Glucose^LN||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /MSH-3/,
    );
  });

  test("throws error when MSH-4 (sending facility) is missing", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const invalidMessage = `MSH|^~\\&|LAB|||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR||TESTPATIENT^ERROR
OBR|1||FIL001|LAB123|||20260101
OBX|1|NM|2345-7^Glucose^LN||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /MSH-4/,
    );
  });

  test("throws error when OBR segment is missing", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const invalidMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR2||TESTPATIENT^ERROR
OBX|1|NM|TEST||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /OBR/,
    );
  });

  test("throws error when OBR-3 filler order number is missing", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const invalidMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR3||TESTPATIENT^ERROR
OBR|1|ORD001||LAB123|||20260101
OBX|1|NM|TEST||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /OBR-3/,
    );
  });
});

describe("LOINC validation", () => {
  test("returns mapping_error status when OBX-3 has no LOINC code (local code only)", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const messageWithoutLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL||4.2|mmol/L|3.5-5.5||||F`;

    const result = await convertORU_R01(parseMessage(messageWithoutLoinc));
    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toBeDefined();
    expect(result.messageUpdate.unmappedCodes!.length).toBe(1);
  });

  test("accepts message when OBX-3 has LOINC in primary coding", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const messageWithPrimaryLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium SerPl-sCnc^LN||4.2|mmol/L|3.5-5.5||||F`;

    const result = await convertORU_R01(parseMessage(messageWithPrimaryLoinc));
    expect(result.messageUpdate.status).toBe("processed");
  });

  test("accepts message when OBX-3 has LOINC in alternate coding", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const messageWithAltLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL^2823-3^Potassium SerPl-sCnc^LN||4.2|mmol/L|3.5-5.5||||F`;

    const result = await convertORU_R01(parseMessage(messageWithAltLoinc));
    expect(result.messageUpdate.status).toBe("processed");
  });

  test("unmappedCodes contains local code for debugging", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const messageWithoutLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||||20260101||Lab|F
OBX|3|NM|MYCODE^MyTest^LOCALLAB||100|mg/dL||||F`;

    const result = await convertORU_R01(parseMessage(messageWithoutLoinc));
    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0].localCode).toBe("MYCODE");
  });

  test("collects all unmapped codes when multiple OBX lack LOINC", async () => {
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");
    const mixedMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL^2823-3^Potassium^LN||4.2|mmol/L||||F
OBX|2|NM|67890^Sodium^LOCAL||140|mmol/L||||F`;

    const result = await convertORU_R01(parseMessage(mixedMessage));
    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0].localCode).toBe("67890");
  });
});

describe("ConceptMap code resolution", () => {
  test("resolves local code via ConceptMap when no inline LOINC", async () => {
    // Setup mock to return a ConceptMap with the local code mapping
    const mockConceptMap = {
      resourceType: "ConceptMap",
      id: "hl7v2-lab-hosp-to-loinc",
      status: "active",
      group: [
        {
          source: "LOCAL",
          target: "http://loinc.org",
          element: [
            {
              code: "12345",
              display: "Potassium",
              target: [
                {
                  code: "2823-3",
                  display: "Potassium SerPl-sCnc",
                  equivalence: "equivalent",
                },
              ],
            },
          ],
        },
      ],
    };

    const mockAidboxWithMapping = {
      aidboxFetch: mock(() => Promise.resolve(mockConceptMap)),
    };

    mock.module("../../../src/aidbox", () => mockAidboxWithMapping);

    // Re-import to use new mock
    const { convertORU_R01 } =
      await import("../../../src/v2-to-fhir/messages/oru-r01");

    const messageWithLocalCode = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL||4.2|mmol/L|3.5-5.5||||F`;

    const bundle = (await convertORU_R01(parseMessage(messageWithLocalCode)))
      .bundle;
    const observation = bundle.entry?.find(
      (e) => e.resource?.resourceType === "Observation",
    )?.resource as Observation;

    // Should have resolved to LOINC
    const loincCoding = observation.code.coding?.find(
      (c) => c.system === "http://loinc.org",
    );
    expect(loincCoding?.code).toBe("2823-3");

    // Should also include local coding
    const localCoding = observation.code.coding?.find(
      (c) => c.system === "LOCAL",
    );
    expect(localCoding?.code).toBe("12345");
  });
});

describe("convertOBXToObservationResolving", () => {
  const senderContext: SenderContext = {
    sendingApplication: "LAB",
    sendingFacility: "HOSPITAL",
  };

  const baseOBX: OBX = {
    $1_setIdObx: "1",
    $2_valueType: "NM",
    $5_observationValue: ["4.2"],
    $6_unit: { $1_code: "mmol/L" },
    $11_observationResultStatus: "F",
  };

  describe("with LOINC in primary coding", () => {
    test("returns observation with LOINC code from primary coding", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "2823-3",
          $2_text: "Potassium SerPl-sCnc",
          $3_system: "LN",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "FIL001",
        senderContext,
      );

      expect(observation.resourceType).toBe("Observation");
      expect(observation.code.coding).toHaveLength(1);
      expect(observation.code.coding?.[0]?.code).toBe("2823-3");
      expect(observation.code.coding?.[0]?.system).toBe("http://loinc.org");
    });

    test("preserves other observation fields from OBX", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "2823-3",
          $2_text: "Potassium",
          $3_system: "LN",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "FIL001",
        senderContext,
      );

      expect(observation.status).toBe("final");
      expect(observation.valueQuantity?.value).toBe(4.2);
      expect(observation.valueQuantity?.unit).toBe("mmol/L");
    });
  });

  describe("with LOINC in alternate coding", () => {
    test("returns observation with LOINC from alternate and local from primary", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "51998",
          $2_text: "Potassium",
          $3_system: "LOCAL",
          $4_altCode: "2823-3",
          $5_altDisplay: "Potassium SerPl-sCnc",
          $6_altSystem: "LN",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "FIL001",
        senderContext,
      );

      expect(observation.code.coding).toHaveLength(2);

      const loincCoding = observation.code.coding?.find(
        (c) => c.system === "http://loinc.org",
      );
      expect(loincCoding?.code).toBe("2823-3");
      expect(loincCoding?.display).toBe("Potassium SerPl-sCnc");

      const localCoding = observation.code.coding?.find(
        (c) => c.system === "LOCAL",
      );
      expect(localCoding?.code).toBe("51998");
    });

    test("LOINC coding comes first in the coding array", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "51998",
          $2_text: "Potassium",
          $3_system: "LOCAL",
          $4_altCode: "2823-3",
          $5_altDisplay: "Potassium SerPl-sCnc",
          $6_altSystem: "LN",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "FIL001",
        senderContext,
      );

      expect(observation.code.coding?.[0]?.system).toBe("http://loinc.org");
      expect(observation.code.coding?.[1]?.system).toBe("LOCAL");
    });
  });

  describe("with ConceptMap lookup", () => {
    test("resolves local code to LOINC via ConceptMap", async () => {
      const mockConceptMap = {
        resourceType: "ConceptMap",
        id: "hl7v2-lab-hospital-to-loinc",
        status: "active",
        group: [
          {
            source: "LOCALLAB",
            target: "http://loinc.org",
            element: [
              {
                code: "K123",
                display: "Potassium Local",
                target: [
                  {
                    code: "2823-3",
                    display: "Potassium SerPl-sCnc",
                    equivalence: "equivalent",
                  },
                ],
              },
            ],
          },
        ],
      };

      mock.module("../../../src/aidbox", () => ({
        aidboxFetch: mock(() => Promise.resolve(mockConceptMap)),
      }));

      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "K123",
          $2_text: "Potassium Local",
          $3_system: "LOCALLAB",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "FIL001",
        senderContext,
      );

      expect(observation.code.coding).toHaveLength(2);

      const loincCoding = observation.code.coding?.find(
        (c) => c.system === "http://loinc.org",
      );
      expect(loincCoding?.code).toBe("2823-3");

      const localCoding = observation.code.coding?.find(
        (c) => c.system === "LOCALLAB",
      );
      expect(localCoding?.code).toBe("K123");
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      mock.module("../../../src/aidbox", () => ({
        aidboxFetch: mock(() =>
          Promise.reject(new Error("HTTP 404: ConceptMap not found")),
        ),
      }));
    });

    test("throws LoincResolutionError when no LOINC and no ConceptMap", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");
      const { LoincResolutionError } =
        await import("../../../src/code-mapping/concept-map");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "UNKNOWN",
          $2_text: "Unknown Test",
          $3_system: "LOCAL",
        },
      };

      await expect(
        convertOBXToObservationResolving(obx, "FIL001", senderContext),
      ).rejects.toBeInstanceOf(LoincResolutionError);
    });

    test("error includes sender context for debugging", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "LOCAL123",
          $2_text: "Local Test",
          $3_system: "MYLAB",
        },
      };

      await expect(
        convertOBXToObservationResolving(obx, "FIL001", senderContext),
      ).rejects.toThrow(/LAB/);
    });
  });

  describe("ID generation", () => {
    test("generates deterministic ID from filler order number and OBX-1", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $1_setIdObx: "5",
        $3_observationIdentifier: {
          $1_code: "2823-3",
          $2_text: "Potassium",
          $3_system: "LN",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "26H-006MP0004",
        senderContext,
      );

      expect(observation.id).toBe("26h-006mp0004-obx-5");
    });

    test("includes OBX-4 sub-ID in generated ID when present", async () => {
      const { convertOBXToObservationResolving } =
        await import("../../../src/v2-to-fhir/messages/oru-r01");

      const obx: OBX = {
        ...baseOBX,
        $1_setIdObx: "1",
        $4_observationSubId: "a",
        $3_observationIdentifier: {
          $1_code: "2823-3",
          $2_text: "Potassium",
          $3_system: "LN",
        },
      };

      const observation = await convertOBXToObservationResolving(
        obx,
        "FIL001",
        senderContext,
      );

      expect(observation.id).toBe("fil001-obx-1-a");
    });
  });
});
