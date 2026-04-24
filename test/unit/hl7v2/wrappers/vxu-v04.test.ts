import { describe, test, expect } from "bun:test";
import {
  groupVXUOrders,
  extractPersonObservations,
  type VXUOrderGroup,
} from "../../../../src/hl7v2/wrappers/vxu-v04";
import type { HL7v2Segment, HL7v2Message } from "../../../../src/hl7v2/generated/types";

function seg(name: string, fields: Record<number, string> = {}): HL7v2Segment {
  return { segment: name, fields };
}

/** Extract groups from result or throw on error. */
function expectGroups(result: ReturnType<typeof groupVXUOrders>): VXUOrderGroup[] {
  if ("error" in result) {throw new Error(result.error);}
  return result.groups;
}

describe("VXU_V04 wrapper", () => {
  describe("groupVXUOrders", () => {
    test("single ORC+RXA+RXR+OBX produces one group with all parts", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
        seg("RXR", { 1: "IM" }),
        seg("OBX", { 1: "1", 3: "64994-7" }),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(1);
      const group = groups[0]!;
      expect(group.orc).toBeDefined();
      expect(group.orc!.segment).toBe("ORC");
      expect(group.rxa.segment).toBe("RXA");
      expect(group.rxr).toBeDefined();
      expect(group.rxr!.segment).toBe("RXR");
      expect(group.observations).toHaveLength(1);
      expect(group.observations[0]!.obx.segment).toBe("OBX");
    });

    test("RXA without ORC produces valid group with orc=undefined", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("RXA", { 3: "20160701" }),
        seg("RXR", { 1: "IM" }),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(1);
      const group = groups[0]!;
      expect(group.orc).toBeUndefined();
      expect(group.rxa.segment).toBe("RXA");
      expect(group.rxr).toBeDefined();
    });

    test("multiple ORDER groups with correct count and contents", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("ORC", { 1: "RE", 3: "ORDER1" }),
        seg("RXA", { 3: "20160701", 5: "CVX1" }),
        seg("RXR", { 1: "IM" }),
        seg("ORC", { 1: "RE", 3: "ORDER2" }),
        seg("RXA", { 3: "20160801", 5: "CVX2" }),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(2);
      const first = groups[0]!;
      const second = groups[1]!;
      expect(first.orc!.fields[3]).toBe("ORDER1");
      expect(first.rxa.fields[5]).toBe("CVX1");
      expect(first.rxr).toBeDefined();
      expect(second.orc!.fields[3]).toBe("ORDER2");
      expect(second.rxa.fields[5]).toBe("CVX2");
      expect(second.rxr).toBeUndefined();
    });

    test("ORC without following RXA produces error", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("ORC", { 1: "RE" }),
      ];

      const result = groupVXUOrders(message);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("RXA");
      }
    });

    test("ORC without RXA followed by another ORC produces error", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("ORC", { 1: "RE" }),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
      ];

      const result = groupVXUOrders(message);

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toContain("RXA");
      }
    });

    test("no ORDER segments produces empty array", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("PV1"),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(0);
    });

    test("multiple OBX segments within one ORDER group", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
        seg("OBX", { 1: "1" }),
        seg("NTE", { 1: "note1" }),
        seg("OBX", { 1: "2" }),
        seg("NTE", { 1: "note2a" }),
        seg("NTE", { 1: "note2b" }),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(1);
      const group = groups[0]!;
      expect(group.observations).toHaveLength(2);
      expect(group.observations[0]!.ntes).toHaveLength(1);
      expect(group.observations[1]!.ntes).toHaveLength(2);
    });

    test("mixed ORC-less and ORC groups", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("RXA", { 3: "20160701", 5: "CVX1" }),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160801", 5: "CVX2" }),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(2);
      const first = groups[0]!;
      const second = groups[1]!;
      expect(first.orc).toBeUndefined();
      expect(first.rxa.fields[5]).toBe("CVX1");
      expect(second.orc).toBeDefined();
      expect(second.rxa.fields[5]).toBe("CVX2");
    });

    test("OBX before first ORC/RXA is ignored by groupVXUOrders", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("OBX", { 1: "person-obs" }),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
      ];

      const groups = expectGroups(groupVXUOrders(message));

      expect(groups).toHaveLength(1);
      expect(groups[0]!.observations).toHaveLength(0);
    });
  });

  describe("extractPersonObservations", () => {
    test("OBX before first ORC/RXA extracted as person observations", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("OBX", { 1: "1", 3: "person-code-1" }),
        seg("OBX", { 1: "2", 3: "person-code-2" }),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
        seg("OBX", { 1: "order-obs" }),
      ];

      const personObs = extractPersonObservations(message);

      expect(personObs).toHaveLength(2);
      expect(personObs[0]!.obx.fields[3]).toBe("person-code-1");
      expect(personObs[1]!.obx.fields[3]).toBe("person-code-2");
    });

    test("OBX before RXA (no ORC) extracted as person observations", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("OBX", { 1: "1" }),
        seg("RXA", { 3: "20160701" }),
      ];

      const personObs = extractPersonObservations(message);

      expect(personObs).toHaveLength(1);
    });

    test("no OBX before ORDER returns empty array", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
        seg("OBX", { 1: "1" }),
      ];

      const personObs = extractPersonObservations(message);

      expect(personObs).toHaveLength(0);
    });

    test("person observation with NTE included", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("OBX", { 1: "1" }),
        seg("NTE", { 1: "note-for-obs" }),
        seg("OBX", { 1: "2" }),
        seg("ORC", { 1: "RE" }),
        seg("RXA", { 3: "20160701" }),
      ];

      const personObs = extractPersonObservations(message);

      expect(personObs).toHaveLength(2);
      expect(personObs[0]!.ntes).toHaveLength(1);
      expect(personObs[0]!.ntes[0]!.fields[1]).toBe("note-for-obs");
      expect(personObs[1]!.ntes).toHaveLength(0);
    });

    test("no ORDER segments returns all OBX as person observations", () => {
      const message: HL7v2Message = [
        seg("MSH"),
        seg("PID"),
        seg("OBX", { 1: "1" }),
        seg("OBX", { 1: "2" }),
      ];

      const personObs = extractPersonObservations(message);

      expect(personObs).toHaveLength(2);
    });
  });
});
