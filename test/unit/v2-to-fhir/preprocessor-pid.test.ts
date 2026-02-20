import { describe, test, expect } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { preprocessMessage } from "../../../src/v2-to-fhir/preprocessor";
import type { Hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";
import { fromPID } from "../../../src/hl7v2/generated/fields";

/** Minimal valid identity rules for tests that don't focus on identity validation. */
const minimalRules = [{ assigner: "UNIPAT" }];

function findPidSegment(parsed: ReturnType<typeof parseMessage>) {
  return parsed.find((s) => s.segment === "PID");
}

function getPid(parsed: ReturnType<typeof parseMessage>) {
  const seg = findPidSegment(parsed);
  if (!seg) throw new Error("PID segment not found");
  return fromPID(seg);
}

describe("move-pid2-into-pid3", () => {
  const configWithMovePid2: Hl7v2ToFhirConfig = {
    identitySystem: { patient: { rules: minimalRules } },
    messages: {
      "ADT-A01": {
        preprocess: { PID: { "2": ["move-pid2-into-pid3"] } },
      },
    },
  };

  test("PID-2 CX moved to PID-3, PID-2 cleared", () => {
    const rawMessage = [
      "MSH|^~\\&|ASTRA|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|11195429^^^UNIPAT^PI|645541^^^ST01W^MR~12345^^^ST01^PI",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithMovePid2);
    const pid = getPid(result);

    // PID-2 should be cleared
    expect(pid.$2_patientId?.$1_value).toBeUndefined();

    // PID-3 should now have 3 entries: original 2 + moved PID-2
    expect(pid.$3_identifier).toHaveLength(3);
    expect(pid.$3_identifier![2]!.$1_value).toBe("11195429");
    expect(pid.$3_identifier![2]!.$4_system?.$1_namespace).toBe("UNIPAT");
    expect(pid.$3_identifier![2]!.$5_type).toBe("PI");

    // Original PID-3 entries preserved
    expect(pid.$3_identifier![0]!.$1_value).toBe("645541");
    expect(pid.$3_identifier![1]!.$1_value).toBe("12345");
  });

  test("PID-2 empty — no-op", () => {
    const rawMessage = [
      "MSH|^~\\&|ASTRA|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||645541^^^ST01W^MR",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const pidBefore = getPid(parsed);
    const pid3CountBefore = pidBefore.$3_identifier?.length ?? 0;

    const result = preprocessMessage(parsed, configWithMovePid2);
    const pid = getPid(result);

    // PID-3 unchanged
    expect(pid.$3_identifier?.length).toBe(pid3CountBefore);
  });

  test("PID-3 already has repeats — PID-2 appended as additional repeat", () => {
    const rawMessage = [
      "MSH|^~\\&|ASTRA|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|99999^^^UNIPAT^PI|AAA^^^SYS1^MR~BBB^^^SYS2^PI~CCC^^^SYS3^AN",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithMovePid2);
    const pid = getPid(result);

    expect(pid.$3_identifier).toHaveLength(4);
    expect(pid.$3_identifier![3]!.$1_value).toBe("99999");
    expect(pid.$3_identifier![3]!.$4_system?.$1_namespace).toBe("UNIPAT");
  });

  test("PID-3 absent — PID-2 becomes the sole PID-3 entry", () => {
    const rawMessage = [
      "MSH|^~\\&|ASTRA|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|11195429^^^UNIPAT^PI",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithMovePid2);
    const pid = getPid(result);

    expect(pid.$2_patientId?.$1_value).toBeUndefined();
    expect(pid.$3_identifier).toHaveLength(1);
    expect(pid.$3_identifier![0]!.$1_value).toBe("11195429");
    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBe("UNIPAT");
  });
});

describe("inject-authority-from-msh", () => {
  const configWithInjectAuth: Hl7v2ToFhirConfig = {
    identitySystem: { patient: { rules: minimalRules } },
    messages: {
      "ADT-A01": {
        preprocess: { PID: { "3": ["inject-authority-from-msh"] } },
      },
    },
  };

  test("bare CX gets authority from MSH", () => {
    // CX = 12345^^^^MR — has CX.1 and CX.5 but no CX.4
    const rawMessage = [
      "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||12345^^^^MR",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithInjectAuth);
    const pid = getPid(result);

    expect(pid.$3_identifier![0]!.$1_value).toBe("12345");
    expect(pid.$3_identifier![0]!.$5_type).toBe("MR");
    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBe("LAB-HOSPITAL");
  });

  test("CX already has CX.4 — not overridden", () => {
    const rawMessage = [
      "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||12345^^^EXISTING^MR",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithInjectAuth);
    const pid = getPid(result);

    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBe("EXISTING");
  });

  test("CX with CX.9 populated — not overridden", () => {
    // Build a message where CX.9 (jurisdiction) is populated
    // CX.9 is at component position 9 — beyond CX.8, so we need all intermediate carets
    // CX: value ^ checkDigit ^ checkDigitScheme ^ authority ^ type ^ facility ^ start ^ end ^ jurisdiction
    const rawMessage = [
      "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||12345^^^^MR^^^^STATEX",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithInjectAuth);
    const pid = getPid(result);

    // Authority should not be injected — CX.9 is populated
    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBeUndefined();
    expect(pid.$3_identifier![0]!.$9_jurisdiction?.$1_code).toBe("STATEX");
  });

  test("MSH has no namespace — no-op", () => {
    const rawMessage = [
      "MSH|^~\\&||||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||12345^^^^MR",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithInjectAuth);
    const pid = getPid(result);

    // No namespace derivable from empty MSH-3/MSH-4
    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBeUndefined();
  });

  test("mixed CX entries: bare entries get authority, existing authorities preserved", () => {
    const rawMessage = [
      "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||11111^^^EXISTING^MR~22222^^^^PI",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithInjectAuth);
    const pid = getPid(result);

    // First CX already had authority — preserved
    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBe("EXISTING");
    // Second CX was bare — gets MSH authority
    expect(pid.$3_identifier![1]!.$4_system?.$1_namespace).toBe("LAB-HOSPITAL");
  });
});

describe("move-pid2-into-pid3 + inject-authority-from-msh combined", () => {
  const configWithBoth: Hl7v2ToFhirConfig = {
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

  test("PID-2 moved then bare CX entries get MSH authority", () => {
    // ASTRA pattern: PID-2 has UNIPAT (with authority), PID-3 has bare identifiers
    const rawMessage = [
      "MSH|^~\\&|ASTRA|HOSP||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|11195429^^^UNIPAT^PI|645541^^^^MR",
    ].join("\r");

    const parsed = parseMessage(rawMessage);
    const result = preprocessMessage(parsed, configWithBoth);
    const pid = getPid(result);

    // PID-2 cleared
    expect(pid.$2_patientId?.$1_value).toBeUndefined();

    // PID-3 should have 2 entries
    expect(pid.$3_identifier).toHaveLength(2);

    // First CX was bare (645541^^^^MR) — should get MSH authority
    expect(pid.$3_identifier![0]!.$1_value).toBe("645541");
    expect(pid.$3_identifier![0]!.$4_system?.$1_namespace).toBe("ASTRA-HOSP");

    // Second CX was moved from PID-2 — already has UNIPAT authority, should be preserved
    expect(pid.$3_identifier![1]!.$1_value).toBe("11195429");
    expect(pid.$3_identifier![1]!.$4_system?.$1_namespace).toBe("UNIPAT");
  });
});
