/**
 * Tests the full pipeline from raw HL7v2 message through PID preprocessing
 * to Patient.identifier. Verifies that preprocessor modifications (PID-2→PID-3
 * migration, authority injection) correctly propagate into FHIR Identifiers.
 *
 * This covers the boundary between raw FieldValue manipulation (preprocessors)
 * and typed PID → Patient conversion (convertPIDToPatient), which is not
 * exercised by either layer's unit tests alone.
 */
import { describe, test, expect } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { preprocessMessage } from "../../../src/v2-to-fhir/preprocessor";
import { fromPID } from "../../../src/hl7v2/generated/fields";
import { convertPIDToPatient } from "../../../src/v2-to-fhir/segments/pid-patient";
import type { Hl7v2ToFhirConfig } from "../../../src/v2-to-fhir/config";
import type { Identifier } from "../../../src/fhir/hl7-fhir-r4-core";

/** Minimal identity rules — not under test here. */
const minimalRules = [{ assigner: "UNIPAT" }];

const adtA01Config: Hl7v2ToFhirConfig = {
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

function preprocessAndConvertPatient(rawMessage: string, config: Hl7v2ToFhirConfig) {
  const parsed = parseMessage(rawMessage);
  const preprocessed = preprocessMessage(parsed, config);
  const pidSegment = preprocessed.find((s) => s.segment === "PID");
  if (!pidSegment) throw new Error("PID segment not found");
  const pid = fromPID(pidSegment);
  return convertPIDToPatient(pid);
}

function findIdentifier(
  identifiers: Identifier[] | undefined,
  value: string,
): Identifier | undefined {
  return identifiers?.find((id) => id.value === value);
}

describe("Patient.identifier after PID preprocessing", () => {
  test("PID-2 UNIPAT migrated to PID-3 appears in Patient.identifier", () => {
    // ASTRA pattern: UNIPAT in PID-2, other identifiers in PID-3
    const rawMessage = [
      "MSH|^~\\&|ASTRA|ASTRAFAC||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|11195429^^^UNIPAT^PI|645541^^^ST01W^MR~87001^^^ST01^PI||TESTPATIENT^ALPHA",
    ].join("\r");

    const patient = preprocessAndConvertPatient(rawMessage, adtA01Config);

    // All 3 identifiers present (2 from PID-3 + 1 moved from PID-2)
    expect(patient.identifier).toHaveLength(3);

    // Original PID-3 entries
    const st01w = findIdentifier(patient.identifier, "645541");
    expect(st01w?.system).toBe("ST01W");
    expect(st01w?.type?.coding?.[0]?.code).toBe("MR");

    const st01 = findIdentifier(patient.identifier, "87001");
    expect(st01?.system).toBe("ST01");
    expect(st01?.type?.coding?.[0]?.code).toBe("PI");

    // Moved PID-2 entry — now in Patient.identifier via PID-3
    const unipat = findIdentifier(patient.identifier, "11195429");
    expect(unipat?.system).toBe("UNIPAT");
    expect(unipat?.type?.coding?.[0]?.code).toBe("PI");
  });

  test("PID-2 cleared after migration — no double-counting", () => {
    const rawMessage = [
      "MSH|^~\\&|ASTRA|ASTRAFAC||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|11195429^^^UNIPAT^PI|645541^^^ST01W^MR||TESTPATIENT^ALPHA",
    ].join("\r");

    const patient = preprocessAndConvertPatient(rawMessage, adtA01Config);

    // Exactly 2 identifiers (1 original PID-3 + 1 moved from PID-2), not 3
    expect(patient.identifier).toHaveLength(2);

    const values = patient.identifier!.map((id) => id.value).sort();
    expect(values).toEqual(["11195429", "645541"]);
  });

  test("bare CX in PID-3 gets MSH authority in Patient.identifier.system", () => {
    // CX has value and type but no authority — inject-authority-from-msh fills it
    const rawMessage = [
      "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||12345^^^^MR||TESTPATIENT^ALPHA",
    ].join("\r");

    const patient = preprocessAndConvertPatient(rawMessage, adtA01Config);

    expect(patient.identifier).toHaveLength(1);

    const id = patient.identifier![0]!;
    expect(id.value).toBe("12345");
    expect(id.system).toBe("LAB-HOSPITAL");
    expect(id.type?.coding?.[0]?.code).toBe("MR");
  });

  test("combined: PID-2 migration + authority injection on bare PID-3 entries", () => {
    // ASTRA pattern variant: PID-2 has UNIPAT (with authority), PID-3 has bare CX
    const rawMessage = [
      "MSH|^~\\&|ASTRA|HOSP||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1|11195429^^^UNIPAT^PI|645541^^^^MR||TESTPATIENT^ALPHA",
    ].join("\r");

    const patient = preprocessAndConvertPatient(rawMessage, adtA01Config);

    expect(patient.identifier).toHaveLength(2);

    // Bare PID-3 entry got MSH authority injected
    const mr = findIdentifier(patient.identifier, "645541");
    expect(mr?.system).toBe("ASTRA-HOSP");
    expect(mr?.type?.coding?.[0]?.code).toBe("MR");

    // Moved PID-2 entry — UNIPAT authority preserved (not overridden by MSH)
    const unipat = findIdentifier(patient.identifier, "11195429");
    expect(unipat?.system).toBe("UNIPAT");
    expect(unipat?.type?.coding?.[0]?.code).toBe("PI");
  });

  test("existing authority not overridden by MSH injection", () => {
    const rawMessage = [
      "MSH|^~\\&|LAB|HOSPITAL||DEST|20260105||ADT^A01|MSG001|P|2.5.1",
      "PID|1||11111^^^EXISTING^MR~22222^^^^PI||TESTPATIENT^ALPHA",
    ].join("\r");

    const patient = preprocessAndConvertPatient(rawMessage, adtA01Config);

    expect(patient.identifier).toHaveLength(2);

    // CX with existing authority — preserved
    const existing = findIdentifier(patient.identifier, "11111");
    expect(existing?.system).toBe("EXISTING");

    // Bare CX — gets MSH authority
    const injected = findIdentifier(patient.identifier, "22222");
    expect(injected?.system).toBe("LAB-HOSPITAL");
  });
});
