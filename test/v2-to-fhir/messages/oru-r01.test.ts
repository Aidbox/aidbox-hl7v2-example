import { describe, test, expect, beforeEach, mock } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import type {
  Bundle,
  DiagnosticReport,
  Observation,
  Specimen,
  Encounter,
  Task,
} from "../../../src/fhir/hl7-fhir-r4-core";
import type { OBX } from "../../../src/hl7v2/generated/fields";
import type { SenderContext } from "../../../src/code-mapping/concept-map";
import {
  LoincResolutionError,
  MissingLocalSystemError,
} from "../../../src/code-mapping/concept-map";
import {
  convertORU_R01,
  convertOBXToObservationResolving,
} from "../../../src/v2-to-fhir/messages/oru-r01";
import { HttpError } from "../../../src/aidbox";

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
OBR|1|R26-TEST00012^External|26ORM-005CH00006^Beaker|LAB90^HEMOGLOBIN A1C^4MEAP|||20260105091000|||||||Blood|PROV002^TEST^LABTECH|||||||20260105091739||Lab|F
OBX|0|NM|1237770270^HBA1C^4MLRR^4548-4^Hemoglobin A1c^LN||6.2|%|4.0-6.0|H|||F|||20260105091000`;

// Message with SPM segment
const MESSAGE_WITH_SPM = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105091743||ORU^R01^ORU_R01|183317|P|2.5.1
PID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||20000303|M
PV1|1||ICU|||||||||||||||VN003
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB17^METABOLIC PANEL^LOCAL|||20260105091000|||||||Blood|PROV003^TEST^DOCTOR|||||||20260105091739||Lab|F
OBX|1|NM|51998^Potassium^LOCAL^2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F|||20260105091000
SPM|1|||Blood^Blood|||||||||||||||20260105091000|20260105091611`;

// Message with NTE segments
const MESSAGE_WITH_NTE = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260106||ORU^R01^ORU_R01|183318|P|2.5.1
PID|1||TEST-0004^^^HOSPITAL^MR||TESTPATIENT^DELTA||20000404|F
PV1|1||MED|||||||||||||||VN004
ORC|RE|ORD002|FIL002
OBR|1|ORD002|FIL002|56117^eGFR^LOCAL|||20260106091000|||||||||||||||20260106095000||Lab|F
OBX|1|SN|56117^eGFR^LOCAL^98979-8^eGFR^LN||>^90|mL/min/1.73 sq.m.|>60.0||||F|||20260106091000
NTE|1|L|eGFR calculation based on CKD-EPI equation.
NTE|2|L|
NTE|3|L|This test is not validated for acute illness.`;

// Message with multiple OBR groups
const MESSAGE_MULTIPLE_OBR = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260107||ORU^R01|183319|P|2.5.1
PID|1||TEST-0005^^^HOSPITAL^MR||TESTPATIENT^EPSILON||20000505|F
PV1|1||ER|||||||||||||||VN005
ORC|RE|ORD003|FIL003A
OBR|1|ORD003|FIL003A|LAB100^CBC^LOCAL|||20260107080000|||||||||||||||20260107090000||Lab|F
OBX|1|NM|52100^WBC^LOCAL^6690-2^Leukocytes^LN||8.5|10*9/L|4.5-11.0||||F
OBX|2|NM|52101^RBC^LOCAL^789-8^Erythrocytes^LN||4.8|10*12/L|4.2-5.4||||F
ORC|RE|ORD003|FIL003B
OBR|2|ORD003|FIL003B|LAB101^BMP^LOCAL|||20260107080000|||||||||||||||20260107091000||Lab|F
OBX|1|NM|51998^Potassium^LOCAL^2823-3^Potassium^LN||4.0|mmol/L|3.5-5.5||||F
OBX|2|NM|52098^Sodium^LOCAL^2951-2^Sodium^LN||140|mmol/L|133-145||||F`;

// Mock aidbox module to avoid actual API calls
// All test messages have inline LOINC, so ConceptMap lookup is not needed
class MockNotFoundError extends Error {
  constructor(resourceType: string, id: string) {
    super(`${resourceType}/${id} not found`);
    this.name = "NotFoundError";
  }
}

const mockAidbox = {
  // Used by oru-r01.ts for patient lookup
  getResourceWithETag: mock(() => {
    throw new MockNotFoundError("Patient", "unknown");
  }),
  NotFoundError: MockNotFoundError,
  HttpError: HttpError,
  // Used by code-mapping/concept-map/service.ts for ConceptMap lookup
  aidboxFetch: mock(() =>
    Promise.reject(new HttpError(404, "ConceptMap not found")),
  ),
  putResource: mock(() => Promise.resolve({})),
};

// Apply mock before importing the module
mock.module("../../../src/aidbox", () => mockAidbox);

describe("convertORU_R01", () => {
  beforeEach(() => {
    mockAidbox.getResourceWithETag.mockClear();
  });

  describe("happy path - basic message processing", () => {
    test("converts simple ORU_R01 to FHIR Bundle", async () => {
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;

      expect(bundle.resourceType).toBe("Bundle");
      expect(bundle.type).toBe("transaction");
      expect(bundle.entry).toBeDefined();
      expect(bundle.entry!.length).toBeGreaterThan(0);
    });

    test("creates DiagnosticReport from OBR segment", async () => {
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
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const diagnosticReport = bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;

      expect(diagnosticReport.result).toHaveLength(2);
      expect(diagnosticReport.result?.[0]?.reference).toContain("Observation/");
    });

    test("uses PUT requests with deterministic IDs for idempotency (except Patient uses conditional POST)", async () => {
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;

      bundle.entry?.forEach((entry) => {
        if (entry.resource?.resourceType === "Patient") {
          // Patient uses POST with If-None-Exist for race condition safety
          expect(entry.request?.method).toBe("POST");
          expect(entry.request?.url).toBe("Patient");
          expect(entry.request?.ifNoneExist).toBe(`_id=${entry.resource?.id}`);
        } else {
          expect(entry.request?.method).toBe("PUT");
          expect(entry.request?.url).toContain(entry.resource?.id);
        }
      });
    });

    test("tags all resources with message control ID", async () => {
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

    test("tags all resources with sender from PID-3 MR identifier", async () => {
      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );

      result.bundle.entry?.forEach((entry) => {
        const senderTag = entry.resource?.meta?.tag?.find(
          (t: { system?: string }) => t.system === "urn:aidbox:hl7v2:sender",
        );
        expect(senderTag).toBeDefined();
        // PID-3 has "HOSPITAL" as assigning authority, lowercased
        expect(senderTag?.code).toBe("hospital");
      });
    });
  });

  describe("LOINC code handling", () => {
    test("extracts LOINC from OBX-3 alternate coding", async () => {
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
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_SPM)))
        .bundle;
      const specimens = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Specimen")
        .map((e) => e.resource as Specimen);

      expect(specimens).toHaveLength(1);
      expect(specimens?.[0]?.type?.coding?.[0]?.code).toBe("Blood");
    });

    test("links Specimen to DiagnosticReport", async () => {
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_SPM)))
        .bundle;
      const diagnosticReport = bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;

      expect(diagnosticReport.specimen).toHaveLength(1);
      expect(diagnosticReport.specimen?.[0]?.reference).toContain("Specimen/");
    });

    test("links Specimen to Observations", async () => {
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
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_NTE)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation.note).toHaveLength(1);
      expect(observation.note?.[0]?.text).toContain("eGFR calculation");
    });

    test("creates paragraph breaks for empty NTE-3", async () => {
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
      const bundle = (await convertORU_R01(parseMessage(SIMPLE_ORU_MESSAGE)))
        .bundle;
      const observation = bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation)
        .find((o) => o.id?.includes("obx-1"));

      expect(observation?.valueString).toBe("Detected");
    });

    test("converts SN with comparator to valueQuantity", async () => {
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
      const bundle = (await convertORU_R01(parseMessage(MESSAGE_WITH_LOINC)))
        .bundle;
      const observation = bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;

      expect(observation?.interpretation?.[0]?.coding?.[0]?.code).toBe("H");
    });

    test("converts OBX-7 reference range", async () => {
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

describe("OBR-25 and OBX-11 status validation", () => {
  describe("OBR-25 Result Status validation", () => {
    test("throws Error when OBR-25 is missing", async () => {
      const messageWithMissingOBR25 = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

      await expect(
        convertORU_R01(parseMessage(messageWithMissingOBR25)),
      ).rejects.toThrow(/OBR-25/);
    });

    test("throws Error when OBR-25 is Y", async () => {
      const messageWithOBR25Y = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|Y
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

      await expect(
        convertORU_R01(parseMessage(messageWithOBR25Y)),
      ).rejects.toThrow(/OBR-25/);
    });

    test("throws Error when OBR-25 is Z", async () => {
      const messageWithOBR25Z = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|Z
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

      await expect(
        convertORU_R01(parseMessage(messageWithOBR25Z)),
      ).rejects.toThrow(/OBR-25/);
    });

  });

  describe("OBX-11 Observation Result Status validation", () => {
    test("throws Error when OBX-11 is missing", async () => {
      const messageWithMissingOBX11 = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||`;

      await expect(
        convertORU_R01(parseMessage(messageWithMissingOBX11)),
      ).rejects.toThrow(/OBX-11/);
    });

    test("throws Error when OBX-11 is N", async () => {
      const messageWithOBX11N = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||N`;

      await expect(
        convertORU_R01(parseMessage(messageWithOBX11N)),
      ).rejects.toThrow(/OBX-11/);
    });

  });

  describe("valid statuses", () => {
    test("processes message with valid OBR-25 F and OBX-11 F", async () => {
      const validMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

      const result = await convertORU_R01(parseMessage(validMessage));
      expect(result.messageUpdate.status).toBe("processed");
    });

    test("processes message with OBR-25 P (preliminary)", async () => {
      const validMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|P
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||P`;

      const result = await convertORU_R01(parseMessage(validMessage));
      expect(result.messageUpdate.status).toBe("processed");

      const diagnosticReport = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;
      expect(diagnosticReport.status).toBe("preliminary");
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
    const invalidMessage = `MSH|^~\\&||HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR||TESTPATIENT^ERROR
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2345-7^Glucose^LN||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /MSH-3/,
    );
  });

  test("throws error when MSH-4 (sending facility) is missing", async () => {
    const invalidMessage = `MSH|^~\\&|LAB|||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR||TESTPATIENT^ERROR
OBR|1||FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2345-7^Glucose^LN||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /MSH-4/,
    );
  });

  test("throws error when OBR segment is missing", async () => {
    const invalidMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR2||TESTPATIENT^ERROR
OBX|1|NM|TEST||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /OBR/,
    );
  });

  test("throws error when both OBR-2 and OBR-3 are missing", async () => {
    const invalidMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-ERR3||TESTPATIENT^ERROR
OBR|1|||LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|TEST||100|mg/dL||||F`;

    await expect(convertORU_R01(parseMessage(invalidMessage))).rejects.toThrow(
      /OBR-3.*OBR-2/,
    );
  });

  test("uses OBR-2 as fallback when OBR-3 is missing", async () => {
    const messageWithOBR2Only = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5
PID|1||TEST-PLACER||TESTPATIENT^PLACER
OBR|1|PLACER123||85025^CBC^LN|||20260101|||||||||||||||||Lab|F
OBX|1|NM|718-7^Hemoglobin^LN||14.5|g/dL|12.0-16.0||||F`;

    const result = await convertORU_R01(parseMessage(messageWithOBR2Only));
    expect(result.messageUpdate.status).toBe("processed");

    const diagnosticReport = result.bundle.entry?.find(
      (e) => e.resource?.resourceType === "DiagnosticReport"
    )?.resource;
    expect(diagnosticReport?.id).toBe("placer123");

    const observation = result.bundle.entry?.find(
      (e) => e.resource?.resourceType === "Observation"
    )?.resource;
    expect(observation?.id).toContain("placer123-obx");
  });
});

describe("LOINC validation", () => {
  test("returns mapping_error status when OBX-3 has no LOINC code (local code only)", async () => {
    const messageWithoutLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL||4.2|mmol/L|3.5-5.5||||F`;

    const result = await convertORU_R01(parseMessage(messageWithoutLoinc));
    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toBeDefined();
    expect(result.messageUpdate.unmappedCodes!.length).toBe(1);
  });

  test("accepts message when OBX-3 has LOINC in primary coding", async () => {
    const messageWithPrimaryLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium SerPl-sCnc^LN||4.2|mmol/L|3.5-5.5||||F`;

    const result = await convertORU_R01(parseMessage(messageWithPrimaryLoinc));
    expect(result.messageUpdate.status).toBe("processed");
  });

  test("accepts message when OBX-3 has LOINC in alternate coding", async () => {
    const messageWithAltLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL^2823-3^Potassium SerPl-sCnc^LN||4.2|mmol/L|3.5-5.5||||F`;

    const result = await convertORU_R01(parseMessage(messageWithAltLoinc));
    expect(result.messageUpdate.status).toBe("processed");
  });

  test("unmappedCodes contains local code for debugging", async () => {
    const messageWithoutLoinc = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|3|NM|MYCODE^MyTest^LOCALLAB||100|mg/dL|||||F`;

    const result = await convertORU_R01(parseMessage(messageWithoutLoinc));
    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0].localCode).toBe("MYCODE");
  });

  test("collects all unmapped codes when multiple OBX lack LOINC", async () => {
    const mixedMessage = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|12345^Potassium^LOCAL^2823-3^Potassium^LN||4.2|mmol/L|||||F
OBX|2|NM|67890^Sodium^LOCAL||140|mmol/L|||||F`;

    const result = await convertORU_R01(parseMessage(mixedMessage));
    expect(result.messageUpdate.status).toBe("mapping_error");
    expect(result.messageUpdate.unmappedCodes).toHaveLength(1);
    expect(result.messageUpdate.unmappedCodes![0].localCode).toBe("67890");
  });

  test("throws MissingLocalSystemError when OBX-3 has no system (only code and display)", async () => {
    // OBX-3 is "BFTYPE^BF Type" - no third component (system)
    // Messages without local code system are rejected with error (not mapping_error)
    const messageWithoutSystem = `MSH|^~\\&|MILL|MCHS||DEST|20260104||ORU^R01|MSG1|T|2.3
PID|1||6163072|||||||||||||||||||
ORC|RE||||
OBR|1|4566983397||PH-BF^pH Body Fluid|||20260104110000|||||||||||||||||General Lab|F
OBX|1|TXT|BFTYPE^BF Type||Other|||N/A|||F|||20260104112732`;

    try {
      await convertORU_R01(parseMessage(messageWithoutSystem));
      expect.unreachable("Should have thrown MissingLocalSystemError");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingLocalSystemError);
      const missingSystemError = error as MissingLocalSystemError;
      expect(missingSystemError.localCode).toBe("BFTYPE");
      expect(missingSystemError.localDisplay).toBe("BF Type");
      expect(missingSystemError.sendingApplication).toBe("MILL");
      expect(missingSystemError.sendingFacility).toBe("MCHS");
    }
  });

  test("throws MissingLocalSystemError on first OBX without system (multiple OBX)", async () => {
    // Both OBX-3 segments have no system component
    // Message is rejected on first missing system - entire message fails
    const messageWithMultipleNoSystem = `MSH|^~\\&|MILL|MCHS||DEST|20260104||ORU^R01|MSG1|T|2.3
PID|1||6163072|||||||||||||||||||
ORC|RE||||
OBR|1|4566983397||PH-BF^pH Body Fluid|||20260104110000|||||||||||||||||General Lab|F
OBX|1|TXT|BFTYPE^BF Type||Other|||N/A|||F|||20260104112732
OBX|2|NUM|PH-O^pH BF||6.9|||N/A|||F|||20260104112732`;

    try {
      await convertORU_R01(parseMessage(messageWithMultipleNoSystem));
      expect.unreachable("Should have thrown MissingLocalSystemError");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingLocalSystemError);
      const missingSystemError = error as MissingLocalSystemError;
      // First OBX without system causes the failure
      expect(missingSystemError.localCode).toBe("BFTYPE");
    }
  });

  test("throws MissingLocalSystemError even when patient exists and OBX has no system", async () => {
    // Simulates the case where patient already exists
    // but OBX-3 has no system - message is rejected with error
    const messageWithoutSystem = `MSH|^~\\&|MILL|MCHS||DEST|20260104||ORU^R01|MSG1|T|2.3
PID|1||EXISTING-PATIENT|||||||||||||||||||
ORC|RE||||
OBR|1|4566983397||PH-BF^pH Body Fluid|||20260104110000|||||||||||||||||General Lab|F
OBX|1|TXT|BFTYPE^BF Type||Other|||N/A|||F|||20260104112732`;

    // Mock patient lookup to return existing patient
    const existingPatient = {
      resourceType: "Patient" as const,
      id: "EXISTING-PATIENT",
      active: true,
    };
    const mockPatientLookup = mock(() => Promise.resolve(existingPatient));

    await expect(
      convertORU_R01(parseMessage(messageWithoutSystem), mockPatientLookup),
    ).rejects.toThrow(MissingLocalSystemError);
  });

  test("MissingLocalSystemError includes helpful error message", async () => {
    // OBX-3 is "BFTYPE^BF Type" - no third component (system)
    // Error message should explain why the message was rejected
    const messageWithoutSystem = `MSH|^~\\&|MILL|MCHS||DEST|20260104||ORU^R01|MSG1|T|2.3
PID|1||6163072|||||||||||||||||||
ORC|RE||||
OBR|1|4566983397||PH-BF^pH Body Fluid|||20260104110000|||||||||||||||||General Lab|F
OBX|1|TXT|BFTYPE^BF Type||Other|||N/A|||F|||20260104112732`;

    try {
      await convertORU_R01(parseMessage(messageWithoutSystem));
      expect.unreachable("Should have thrown MissingLocalSystemError");
    } catch (error) {
      expect(error).toBeInstanceOf(MissingLocalSystemError);
      const missingSystemError = error as MissingLocalSystemError;
      expect(missingSystemError.message).toContain("BFTYPE");
      expect(missingSystemError.message).toContain("missing coding system");
      expect(missingSystemError.message).toContain("component 3");
    }
  });
});

describe("ConceptMap code resolution", () => {
  test("resolves local code via ConceptMap when no inline LOINC", async () => {
    // Setup mock to return a successful $translate response
    const mockTranslateResponse = {
      resourceType: "Parameters",
      parameter: [
        { name: "result", valueBoolean: true },
        {
          name: "match",
          part: [
            { name: "relationship", valueCode: "equivalent" },
            {
              name: "concept",
              valueCoding: {
                system: "http://loinc.org",
                code: "2823-3",
                display: "Potassium SerPl-sCnc",
              },
            },
          ],
        },
      ],
    };

    const mockAidboxWithMapping = {
      aidboxFetch: mock(() => Promise.resolve(mockTranslateResponse)),
    };

    mock.module("../../../src/aidbox", () => mockAidboxWithMapping);

    // Re-import to use new mock

    const messageWithLocalCode = `MSH|^~\\&|LAB|HOSP||DEST|20260101||ORU^R01|MSG1|P|2.5.1
PID|1||TEST001||PATIENT^TEST
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
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
      // Setup mock to return a successful $translate response
      const mockTranslateResponse = {
        resourceType: "Parameters",
        parameter: [
          { name: "result", valueBoolean: true },
          {
            name: "match",
            part: [
              { name: "relationship", valueCode: "equivalent" },
              {
                name: "concept",
                valueCoding: {
                  system: "http://loinc.org",
                  code: "2823-3",
                  display: "Potassium SerPl-sCnc",
                },
              },
            ],
          },
        ],
      };

      mock.module("../../../src/aidbox", () => ({
        aidboxFetch: mock(() => Promise.resolve(mockTranslateResponse)),
      }));


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
        HttpError: HttpError,
        aidboxFetch: mock(() =>
          Promise.reject(new HttpError(404, "ConceptMap not found")),
        ),
      }));
    });

    test("throws LoincResolutionError when no LOINC and no ConceptMap", async () => {

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

describe("patient handling", () => {
  // Message without PID segment for error testing
  const MESSAGE_WITHOUT_PID = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  // Message with PID-2 for patient ID
  const MESSAGE_WITH_PID2 = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG002|P|2.5.1
PID|1|PAT-FROM-PID2||||||F
ORC|RE|ORD001|FIL002
OBR|1|ORD001|FIL002|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  // Message with PID-3 only (no PID-2) for patient ID
  const MESSAGE_WITH_PID3_ONLY = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG003|P|2.5.1
PID|1||PAT-FROM-PID3^^^HOSPITAL^MR||PATIENT^TEST||20000101|M
ORC|RE|ORD001|FIL003
OBR|1|ORD001|FIL003|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  // Message with empty PID-2 and PID-3 for error testing
  const MESSAGE_WITH_EMPTY_PID = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG004|P|2.5.1
PID|1||||PATIENT^TEST||20000101|M
ORC|RE|ORD001|FIL004
OBR|1|ORD001|FIL004|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  describe("PID segment validation", () => {
    test("throws error when PID segment is missing", async () => {

      await expect(
        convertORU_R01(parseMessage(MESSAGE_WITHOUT_PID)),
      ).rejects.toThrow("PID segment is required for ORU_R01 messages");
    });

    test("throws error when both PID-2 and PID-3 are empty", async () => {

      await expect(
        convertORU_R01(parseMessage(MESSAGE_WITH_EMPTY_PID)),
      ).rejects.toThrow("Patient ID (PID-2 or PID-3) is required");
    });
  });

  describe("patient ID extraction", () => {
    // Mock patient not found for draft creation tests
    const mockPatientNotFound = () => Promise.resolve(null);

    test("extracts patient ID from PID-2", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_PID2),
        mockPatientNotFound,
      );

      expect(result.messageUpdate.patient?.reference).toBe(
        "Patient/PAT-FROM-PID2",
      );
    });

    test("extracts patient ID from PID-3.1 when PID-2 is empty", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_PID3_ONLY),
        mockPatientNotFound,
      );

      expect(result.messageUpdate.patient?.reference).toBe(
        "Patient/PAT-FROM-PID3",
      );
    });
  });

  describe("patient lookup and draft creation", () => {
    test("creates draft Patient with active=false when patient not found", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );

      const patientEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      );

      expect(patientEntry).toBeDefined();
      expect(patientEntry?.resource?.id).toBe("TEST-0001");
      expect((patientEntry?.resource as { active?: boolean })?.active).toBe(
        false,
      );
      // Uses POST with If-None-Exist for race condition safety
      expect(patientEntry?.request?.method).toBe("POST");
      expect(patientEntry?.request?.url).toBe("Patient");
      expect(patientEntry?.request?.ifNoneExist).toBe("_id=TEST-0001");
    });

    test("does not include Patient in bundle when patient exists", async () => {

      const existingPatient = {
        resourceType: "Patient",
        id: "TEST-0001",
        active: true,
      };
      const mockPatientFound = () => Promise.resolve(existingPatient);

      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientFound,
      );

      const patientEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      );

      expect(patientEntry).toBeUndefined();
    });

    test("sets patient reference in messageUpdate regardless of lookup result", async () => {

      const existingPatient = {
        resourceType: "Patient",
        id: "TEST-0001",
        active: true,
      };
      const mockPatientFound = () => Promise.resolve(existingPatient);

      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientFound,
      );

      expect(result.messageUpdate.patient?.reference).toBe("Patient/TEST-0001");
    });

    test("does not update existing patient data (ADT is source of truth)", async () => {

      // Existing patient has different demographics than PID segment
      const existingPatient = {
        resourceType: "Patient",
        id: "TEST-0001",
        active: true,
        name: [{ family: "DIFFERENT", given: ["NAME"] }],
        gender: "male",
        birthDate: "1990-01-01",
      };
      const mockPatientFound = () => Promise.resolve(existingPatient);

      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientFound,
      );

      // No Patient in bundle - existing patient is NOT updated
      const patientEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      );
      expect(patientEntry).toBeUndefined();

      // Resources still reference the existing patient
      expect(result.messageUpdate.patient?.reference).toBe("Patient/TEST-0001");
    });
  });

  describe("subject reference linking", () => {
    test("links DiagnosticReport to Patient via subject", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );

      const diagnosticReport = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;

      expect(diagnosticReport.subject?.reference).toBe("Patient/TEST-0001");
    });

    test("links all Observations to Patient via subject", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );

      const observations = result.bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation);

      expect(observations).toHaveLength(2);
      observations?.forEach((obs) => {
        expect(obs.subject?.reference).toBe("Patient/TEST-0001");
      });
    });

    test("links Specimen to Patient via subject", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_SPM),
        mockPatientNotFound,
      );

      const specimen = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Specimen",
      )?.resource as Specimen;

      expect(specimen.subject?.reference).toBe("Patient/TEST-0003");
    });
  });

  describe("draft patient demographics", () => {
    test("draft patient includes demographics from PID segment", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_PID3_ONLY),
        mockPatientNotFound,
      );

      const patient = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      )?.resource as { name?: Array<{ family?: string; given?: string[] }>; gender?: string; birthDate?: string };

      expect(patient.name?.[0]?.family).toBe("PATIENT");
      expect(patient.name?.[0]?.given).toContain("TEST");
      expect(patient.gender).toBe("male");
      expect(patient.birthDate).toBe("2000-01-01");
    });

    test("draft patient is tagged with message ID", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);
      const result = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );

      const patient = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      )?.resource;

      const messageTag = patient?.meta?.tag?.find(
        (t: { system?: string }) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      expect(messageTag?.code).toBe("MSG123");
    });
  });

  describe("idempotency", () => {
    test("same message processed twice creates same patient ID (PUT idempotency)", async () => {

      const mockPatientNotFound = () => Promise.resolve(null);

      const result1 = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );
      const result2 = await convertORU_R01(
        parseMessage(SIMPLE_ORU_MESSAGE),
        mockPatientNotFound,
      );

      const patient1 = result1.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      );
      const patient2 = result2.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Patient",
      );

      expect(patient1?.resource?.id).toBe(patient2?.resource?.id);
      // Both use POST with If-None-Exist - server handles race condition
      expect(patient1?.request?.method).toBe("POST");
      expect(patient2?.request?.method).toBe("POST");
      expect(patient1?.request?.ifNoneExist).toBe("_id=TEST-0001");
      expect(patient2?.request?.ifNoneExist).toBe("_id=TEST-0001");
    });
  });
});

describe("encounter handling", () => {
  // Message without PV1 segment
  const MESSAGE_WITHOUT_PV1 = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG001|P|2.5.1
PID|1||TEST-0001^^^HOSPITAL^MR||TESTPATIENT^ALPHA||20000101|F
ORC|RE|ORD001|FIL001
OBR|1|ORD001|FIL001|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  // Message with PV1 but no PV1-19 (visit number)
  // PV1 has fields 1-7 only, no visit number at position 19
  const MESSAGE_WITH_PV1_NO_VISIT_NUMBER = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG002|P|2.5.1
PID|1||TEST-0002^^^HOSPITAL^MR||TESTPATIENT^BETA||20000202|M
PV1|1|I|WARD1^ROOM1^BED1||||PROV001^TEST^PROVIDER
ORC|RE|ORD001|FIL002
OBR|1|ORD001|FIL002|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  // Message with PV1-19 (full encounter info)
  // PV1-19 is Visit Number - need 12 empty fields between PV1-7 and PV1-19
  const MESSAGE_WITH_ENCOUNTER = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG003|P|2.5.1
PID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||20000303|F
PV1|1|I|WARD1^ROOM1^BED1||||PROV001^TEST^PROVIDER||||||||||||ENC-12345
ORC|RE|ORD001|FIL003
OBR|1|ORD001|FIL003|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F`;

  const mockPatientNotFound = () => Promise.resolve(null);
  const mockEncounterNotFound = () => Promise.resolve(null);

  describe("PV1 segment handling", () => {
    test("proceeds without encounter reference when PV1 segment is missing", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITHOUT_PV1),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      // No Encounter in bundle
      const encounterEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      expect(encounterEntry).toBeUndefined();

      // DiagnosticReport has no encounter reference
      const diagnosticReport = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;
      expect(diagnosticReport.encounter).toBeUndefined();

      // Observations have no encounter reference
      const observation = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Observation",
      )?.resource as Observation;
      expect(observation.encounter).toBeUndefined();

      // Message still processed successfully
      expect(result.messageUpdate.status).toBe("processed");
    });

    test("proceeds without encounter reference when PV1-19 (Visit Number) is empty", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_PV1_NO_VISIT_NUMBER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      // No Encounter in bundle
      const encounterEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      expect(encounterEntry).toBeUndefined();

      // DiagnosticReport has no encounter reference
      const diagnosticReport = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;
      expect(diagnosticReport.encounter).toBeUndefined();
    });
  });

  describe("encounter lookup and draft creation", () => {
    test("creates draft Encounter with status=unknown when encounter not found", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const encounterEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );

      expect(encounterEntry).toBeDefined();
      expect(encounterEntry?.resource?.id).toBe("lab-hospital-enc-12345");
      expect((encounterEntry?.resource as Encounter)?.status).toBe("unknown");
      // Uses POST with If-None-Exist for race condition safety
      expect(encounterEntry?.request?.method).toBe("POST");
      expect(encounterEntry?.request?.url).toBe("Encounter");
      expect(encounterEntry?.request?.ifNoneExist).toBe("_id=lab-hospital-enc-12345");
    });

    test("does not include Encounter in bundle when encounter exists", async () => {

      const existingEncounter = {
        resourceType: "Encounter",
        id: "ENC-12345",
        status: "in-progress",
        class: { code: "IMP" },
      };
      const mockEncounterFound = () => Promise.resolve(existingEncounter);

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterFound,
      );

      const encounterEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );

      expect(encounterEntry).toBeUndefined();
    });

    test("does not update existing encounter data (ADT is source of truth)", async () => {

      // Existing encounter has different data than PV1 segment
      const existingEncounter = {
        resourceType: "Encounter",
        id: "ENC-12345",
        status: "finished",
        class: { code: "AMB" },
      };
      const mockEncounterFound = () => Promise.resolve(existingEncounter);

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterFound,
      );

      // No Encounter in bundle - existing encounter is NOT updated
      const encounterEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      expect(encounterEntry).toBeUndefined();

      // Resources still reference the existing encounter
      const diagnosticReport = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;
      expect(diagnosticReport.encounter?.reference).toBe("Encounter/lab-hospital-enc-12345");
    });
  });

  describe("encounter reference linking", () => {
    test("links DiagnosticReport to Encounter when encounter available", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const diagnosticReport = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "DiagnosticReport",
      )?.resource as DiagnosticReport;

      expect(diagnosticReport.encounter?.reference).toBe("Encounter/lab-hospital-enc-12345");
    });

    test("links all Observations to Encounter when encounter available", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const observations = result.bundle.entry
        ?.filter((e) => e.resource?.resourceType === "Observation")
        .map((e) => e.resource as Observation);

      expect(observations?.length).toBeGreaterThan(0);
      observations?.forEach((obs) => {
        expect(obs.encounter?.reference).toBe("Encounter/lab-hospital-enc-12345");
      });
    });

    test("draft encounter has correct subject reference to Patient", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const encounter = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      )?.resource as Encounter;

      expect(encounter.subject?.reference).toBe("Patient/TEST-0003");
    });
  });

  describe("draft encounter demographics", () => {
    test("draft encounter includes data from PV1 segment", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const encounter = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      )?.resource as Encounter;

      // PV1-2 class should be preserved (I = inpatient)
      expect(encounter.class?.code).toBe("IMP");
    });

    test("draft encounter is tagged with message ID", async () => {

      const result = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const encounter = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      )?.resource;

      const messageTag = encounter?.meta?.tag?.find(
        (t: { system?: string }) => t.system === "urn:aidbox:hl7v2:message-id",
      );
      expect(messageTag?.code).toBe("MSG003");
    });
  });

  describe("idempotency", () => {
    test("same message processed twice creates same encounter ID", async () => {

      const result1 = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );
      const result2 = await convertORU_R01(
        parseMessage(MESSAGE_WITH_ENCOUNTER),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      const encounter1 = result1.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      const encounter2 = result2.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );

      expect(encounter1?.resource?.id).toBe(encounter2?.resource?.id);
      // Both use POST with If-None-Exist - server handles race condition
      expect(encounter1?.request?.method).toBe("POST");
      expect(encounter2?.request?.method).toBe("POST");
      expect(encounter1?.request?.ifNoneExist).toBe("_id=lab-hospital-enc-12345");
      expect(encounter2?.request?.ifNoneExist).toBe("_id=lab-hospital-enc-12345");
    });
  });

  describe("encounter lookup error handling", () => {
    test("propagates non-404 errors from encounter lookup", async () => {
      const networkError = new Error("Network connection failed");
      const mockEncounterLookupError = () => Promise.reject(networkError);

      await expect(
        convertORU_R01(
          parseMessage(MESSAGE_WITH_ENCOUNTER),
          mockPatientNotFound,
          mockEncounterLookupError,
        ),
      ).rejects.toThrow("Network connection failed");
    });
  });

  describe("interaction with mapping errors", () => {
    test("includes draft encounter in bundle even when mapping_error occurs", async () => {

      // Message with encounter but no LOINC code (will cause mapping_error)
      // PV1-19 has ENC-99999 at correct position
      const messageWithMappingError = `MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ORU^R01|MSG004|P|2.5.1
PID|1||TEST-0004^^^HOSPITAL^MR||TESTPATIENT^DELTA||20000404|F
PV1|1|I|WARD1^ROOM1^BED1||||PROV001^TEST^PROVIDER||||||||||||ENC-99999
ORC|RE|ORD001|FIL004
OBR|1|ORD001|FIL004|LAB123|||20260101|||||||||||||||20260101||Lab|F
OBX|1|NM|LOCAL123^LocalTest^LOCAL||4.2|mmol/L|3.5-5.5||||F`;

      const result = await convertORU_R01(
        parseMessage(messageWithMappingError),
        mockPatientNotFound,
        mockEncounterNotFound,
      );

      expect(result.messageUpdate.status).toBe("mapping_error");

      // Draft encounter should still be in bundle
      const encounterEntry = result.bundle.entry?.find(
        (e) => e.resource?.resourceType === "Encounter",
      );
      expect(encounterEntry).toBeDefined();
      expect(encounterEntry?.resource?.id).toBe("lab-hospital-enc-99999");
    });
  });
});
