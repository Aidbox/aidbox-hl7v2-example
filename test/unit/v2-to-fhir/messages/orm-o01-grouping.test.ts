import { describe, test, expect } from "bun:test";
import { parseMessage } from "@atomic-ehr/hl7v2";
import { fromORC, fromOBR } from "../../../../src/hl7v2/generated/fields";
import {
  groupORMOrders,
  resolveOrderNumber,
  isEmptyPV1,
} from "../../../../src/v2-to-fhir/messages/orm-o01";
import { parsePV1 } from "../../../../src/v2-to-fhir/segments/pv1-encounter";
import type { ORC, EI } from "../../../../src/hl7v2/generated/fields";

// ============================================================================
// groupORMOrders
// ============================================================================

describe("groupORMOrders", () => {
  test("single ORC + OBR groups correctly", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC|NW|ORD001",
      "OBR|1|ORD001||LAB123^CBC^LN",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.orc.segment).toBe("ORC");
    expect(groups[0]!.orderChoice?.segment).toBe("OBR");
    expect(groups[0]!.orderChoiceType).toBe("OBR");
    expect(groups[0]!.ntes).toHaveLength(0);
    expect(groups[0]!.dg1s).toHaveLength(0);
    expect(groups[0]!.observations).toHaveLength(0);
  });

  test("two ORC + OBR groups (multi-order)", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC|NW|ORD001",
      "OBR|1|ORD001||LAB123^CBC^LN",
      "DG1|1|I10|E11.9^Diabetes^I10",
      "ORC|NW|ORD002",
      "OBR|2|ORD002||80061^Lipid Panel^LN",
      "DG1|1|I10|I10^HTN^I10",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.orderChoiceType).toBe("OBR");
    expect(groups[0]!.dg1s).toHaveLength(1);
    expect(groups[1]!.orderChoiceType).toBe("OBR");
    expect(groups[1]!.dg1s).toHaveLength(1);
  });

  test("ORC + RXO groups correctly", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC||ORD001|||SC",
      "RXO|med-code^Med Name^SYS|10||mg^milligrams^UCUM",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.orderChoice?.segment).toBe("RXO");
    expect(groups[0]!.orderChoiceType).toBe("RXO");
  });

  test("mixed ORC+OBR and ORC+RXO in one message", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC|NW|ORD001",
      "OBR|1|ORD001||LAB123^CBC^LN",
      "ORC||ORD002|||SC",
      "RXO|med-code^Med Name^SYS|5||mg",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.orderChoiceType).toBe("OBR");
    expect(groups[1]!.orderChoiceType).toBe("RXO");
  });

  test("NTEs before OBX attach to order, NTEs after OBX attach to observation", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC||ORD001|||SC",
      "RXO|med-code^Med Name^SYS|10||mg",
      "NTE|1||Order-level note 1",
      "NTE|2||Order-level note 2",
      "OBX|1|ST|Q001||answer-1",
      "NTE|3||Observation note 1",
      "OBX|2|ST|Q002||answer-2",
      "NTE|4||Observation note 2",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(1);
    const group = groups[0]!;

    // Order-level NTEs: 2 (before any OBX)
    expect(group.ntes).toHaveLength(2);

    // Observations: 2 OBX, each with 1 NTE
    expect(group.observations).toHaveLength(2);
    expect(group.observations[0]!.ntes).toHaveLength(1);
    expect(group.observations[1]!.ntes).toHaveLength(1);
  });

  test("DG1 attaches to current order group", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC|NW|ORD001",
      "OBR|1|ORD001||LAB123^CBC^LN",
      "DG1|1|I10|E11.9^Diabetes^I10",
      "DG1|2|I10|I10^HTN^I10",
      "ORC|NW|ORD002",
      "OBR|2|ORD002||80061^Lipid^LN",
      "DG1|1|I10|Z00.0^Checkup^I10",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups[0]!.dg1s).toHaveLength(2);
    expect(groups[1]!.dg1s).toHaveLength(1);
  });

  test("OBX starts new observation entry", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC||ORD001|||SC",
      "RXO|med-code^Med^SYS|10||mg",
      "OBX|1|ST|Q001||val1",
      "OBX|2|ST|Q002||val2",
      "OBX|3|ST|Q003||val3",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups[0]!.observations).toHaveLength(3);
    expect(groups[0]!.observations[0]!.ntes).toHaveLength(0);
    expect(groups[0]!.observations[1]!.ntes).toHaveLength(0);
    expect(groups[0]!.observations[2]!.ntes).toHaveLength(0);
  });

  test("segments before first ORC are ignored", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "PV1|1|I|WARD1",
      "IN1|1||INS001|Insurer",
      "ORC|NW|ORD001",
      "OBR|1|ORD001||LAB123^CBC^LN",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(1);
    // The PV1, IN1, PID are NOT in any group
    expect(groups[0]!.orderChoiceType).toBe("OBR");
  });

  test("ORC without order choice has type unknown", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "ORC|NW|ORD001",
    ].join("\r"));

    const groups = groupORMOrders(msg);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.orderChoice).toBeUndefined();
    expect(groups[0]!.orderChoiceType).toBe("unknown");
  });
});

// ============================================================================
// resolveOrderNumber
// ============================================================================

describe("resolveOrderNumber", () => {
  function makeORC(overrides: Partial<ORC> = {}): ORC {
    return {
      $1_orderControl: "NW",
      ...overrides,
    };
  }

  test("ORC-2 present -> uses ORC-2.1", () => {
    const orc = makeORC({ $2_placerOrderNumber: { $1_value: "ORD-001" } });

    const result = resolveOrderNumber(orc);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("ord-001");
  });

  test("ORC-2 with namespace suffix when ORC-2.2 present", () => {
    const orc = makeORC({
      $2_placerOrderNumber: { $1_value: "ORD-001", $2_namespace: "AUTH-SYS" },
    });

    const result = resolveOrderNumber(orc);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("ord-001-auth-sys");
  });

  test("ORC-2 with namespace same as value is not duplicated", () => {
    const orc = makeORC({
      $2_placerOrderNumber: { $1_value: "ORD-001", $2_namespace: "ORD-001" },
    });

    const result = resolveOrderNumber(orc);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("ord-001");
  });

  test("ORC-2 empty, OBR-2 present -> uses OBR-2.1", () => {
    const orc = makeORC({ $2_placerOrderNumber: undefined });
    const obrPlacer: EI = { $1_value: "OBR-ORD-002" };

    const result = resolveOrderNumber(orc, obrPlacer);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("obr-ord-002");
  });

  test("ORC-2 empty, OBR-2 with namespace", () => {
    const orc = makeORC({ $2_placerOrderNumber: undefined });
    const obrPlacer: EI = { $1_value: "123", $2_namespace: "LabSys" };

    const result = resolveOrderNumber(orc, obrPlacer);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("123-labsys");
  });

  test("both empty -> returns error", () => {
    const orc = makeORC({ $2_placerOrderNumber: undefined });

    const result = resolveOrderNumber(orc);

    expect(result.error).toBeDefined();
    expect(result.orderNumber).toBeUndefined();
  });

  test("ORC-2 with empty value string -> falls through to OBR-2", () => {
    const orc = makeORC({ $2_placerOrderNumber: { $1_value: "" } });
    const obrPlacer: EI = { $1_value: "FALLBACK-001" };

    const result = resolveOrderNumber(orc, obrPlacer);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("fallback-001");
  });

  test("ORC-2 with whitespace-only value -> falls through to OBR-2", () => {
    const orc = makeORC({ $2_placerOrderNumber: { $1_value: "  " } });
    const obrPlacer: EI = { $1_value: "FALLBACK-002" };

    const result = resolveOrderNumber(orc, obrPlacer);

    expect(result.error).toBeUndefined();
    expect(result.orderNumber).toBe("fallback-002");
  });

  test("sanitization applied correctly (special characters replaced)", () => {
    const orc = makeORC({
      $2_placerOrderNumber: { $1_value: "ORD 001/Test.v2" },
    });

    const result = resolveOrderNumber(orc);

    expect(result.error).toBeUndefined();
    // sanitizeForId lowercases and replaces non-alphanumeric (except hyphen) with hyphens
    expect(result.orderNumber).toBe("ord-001-test-v2");
  });
});

// ============================================================================
// isEmptyPV1
// ============================================================================

describe("isEmptyPV1", () => {
  test("empty PV1 segment (PV1|) returns true", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "PV1|",
    ].join("\r"));

    const pv1 = parsePV1(msg);
    expect(pv1).toBeDefined();
    expect(isEmptyPV1(pv1!)).toBe(true);
  });

  test("PV1 with patient class returns false", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "PV1|1|I",
    ].join("\r"));

    const pv1 = parsePV1(msg);
    expect(pv1).toBeDefined();
    expect(isEmptyPV1(pv1!)).toBe(false);
  });

  test("PV1 with visit number returns false", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "PV1|1||||||||||||||||||V12345^^^HOSP&urn:oid:1.2.3&ISO",
    ].join("\r"));

    const pv1 = parsePV1(msg);
    expect(pv1).toBeDefined();
    expect(isEmptyPV1(pv1!)).toBe(false);
  });

  test("PV1 with both patient class and visit number returns false", () => {
    const msg = parseMessage([
      "MSH|^~\\&|APP|FAC||DEST|20260101||ORM^O01|1|P|2.5",
      "PID|1||PAT-001^^^HOSP^MR",
      "PV1|1|I|WARD1^ROOM1||||||||||||||||V12345^^^HOSP&urn:oid:1.2.3&ISO",
    ].join("\r"));

    const pv1 = parsePV1(msg);
    expect(pv1).toBeDefined();
    expect(isEmptyPV1(pv1!)).toBe(false);
  });
});
