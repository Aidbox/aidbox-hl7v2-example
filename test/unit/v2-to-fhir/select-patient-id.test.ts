import { describe, test, expect } from "bun:test";
import {
  selectPatientId,
  type MatchRule,
  type MpiLookupRule,
  type IdentifierPriorityRule,
} from "../../../src/v2-to-fhir/identity-system/patient-id";
import type { MpiClient, MpiResult } from "../../../src/v2-to-fhir/identity-system/mpi-lookup";
import { StubMpiClient } from "../../../src/v2-to-fhir/identity-system/mpi-lookup";
import type { CX } from "../../../src/hl7v2/generated/fields";

const stub = new StubMpiClient();

const defaultRules: IdentifierPriorityRule[] = [
  { assigner: "UNIPAT" },
  { type: "PE" },
  { assigner: "ST01" },
  { type: "MR" },
  { any: true },
];

function mockMpi(fn: MpiClient["crossReference"]): MpiClient {
  return {
    crossReference: fn,
    async match() {
      return { status: "not-found" };
    },
  };
}

describe("selectPatientId", () => {
  describe("assigner matching", () => {
    test("ASTRA UNIPAT via CX.4.1", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "11195429",
          $4_system: { $1_namespace: "UNIPAT" },
        },
        {
          $1_value: "645541",
          $4_system: { $1_namespace: "ST01W" },
          $5_type: "MR",
        },
      ];

      const result = await selectPatientId(identifiers, defaultRules, stub);
      expect(result).toEqual({ id: "unipat-11195429" });
    });

    test("MEDTEX UNIPAT directly in PID-3 via CX.4.1", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "11216032",
          $4_system: { $1_namespace: "UNIPAT" },
        },
        {
          $1_value: "11220762",
          $4_system: { $1_namespace: "BMH" },
          $5_type: "PE",
        },
      ];

      const result = await selectPatientId(identifiers, defaultRules, stub);
      expect(result).toEqual({ id: "unipat-11216032" });
    });

    test("assigner matches via CX.9.1 when CX.4.1 is empty", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "12345",
          $4_system: { $1_namespace: "" },
          $9_jurisdiction: { $1_code: "STATEX" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ assigner: "STATEX" }],
        stub,
      );
      expect(result).toEqual({ id: "statex-12345" });
    });

    test("assigner matches via CX.10.1 when CX.4.1 and CX.9.1 are empty", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "67890",
          $4_system: { $1_namespace: "" },
          $9_jurisdiction: { $1_code: "" },
          $10_department: { $1_code: "DEPT01" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ assigner: "DEPT01" }],
        stub,
      );
      expect(result).toEqual({ id: "dept01-67890" });
    });

    test("assigner does NOT match CX.4.2 (Universal ID)", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "12345",
          $4_system: { $1_namespace: "", $2_system: "UNIPAT" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ assigner: "UNIPAT" }],
        stub,
      );
      expect("error" in result).toBe(true);
    });
  });

  describe("type-only matching", () => {
    test("MEDTEX without UNIPAT falls to type-PE rule, assigner from CX.4.1", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "11220762",
          $4_system: { $1_namespace: "BMH" },
          $5_type: "PE",
        },
      ];

      const result = await selectPatientId(identifiers, defaultRules, stub);
      expect(result).toEqual({ id: "bmh-11220762" });
    });

    test("type-only assigner prefers CX.4.1 over CX.9.1", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "12345",
          $4_system: { $1_namespace: "ST01" },
          $5_type: "MR",
          $9_jurisdiction: { $1_code: "STATEX" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ type: "MR" }],
        stub,
      );
      expect(result).toEqual({ id: "st01-12345" });
    });

    test("type-only assigner falls to CX.4.1 when CX.9.1 is empty", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "12345",
          $4_system: { $1_namespace: "ST01" },
          $5_type: "MR",
          $9_jurisdiction: { $1_code: "" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ type: "MR" }],
        stub,
      );
      expect(result).toEqual({ id: "st01-12345" });
    });

    test("type-only with CX.10.1 only (CX.9.1 and CX.4 empty)", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "54321",
          $4_system: { $1_namespace: "", $2_system: "" },
          $5_type: "AN",
          $9_jurisdiction: { $1_code: "" },
          $10_department: { $1_code: "DEPT01" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ type: "AN" }],
        stub,
      );
      expect(result).toEqual({ id: "dept01-54321" });
    });

    test("type-only with CX.4.2 when CX.4.1 is empty", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "12345",
          $4_system: {
            $1_namespace: "",
            $2_system: "urn:oid:2.16.840.1.113883.1.111",
          },
          $5_type: "MR",
          $9_jurisdiction: { $1_code: "" },
          $10_department: { $1_code: "" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ type: "MR" }],
        stub,
      );
      expect(result).toEqual({
        id: "urn-oid-2-16-840-1-113883-1-111-12345",
      });
    });

    test("Xpan &&ISO/MR: only CX.4.3 populated — no assigner derivable, returns error", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "M000000721",
          $4_system: {
            $1_namespace: "",
            $2_system: "",
            $3_systemType: "ISO",
          },
          $5_type: "MR",
        },
        {
          $1_value: "P000000721",
          $4_system: {
            $1_namespace: "",
            $2_system: "",
            $3_systemType: "ISO",
          },
          $5_type: "PI",
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ type: "MR" }],
        stub,
      );
      expect("error" in result).toBe(true);
    });
  });

  describe("combined assigner + type", () => {
    test("both assigner and type must match", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "111",
          $4_system: { $1_namespace: "ST01" },
          $5_type: "PI",
        },
        {
          $1_value: "222",
          $4_system: { $1_namespace: "ST01" },
          $5_type: "MR",
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ assigner: "ST01", type: "MR" }],
        stub,
      );
      expect(result).toEqual({ id: "st01-222" });
    });

    test("assigner matches but type does not — CX skipped", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "111",
          $4_system: { $1_namespace: "ST01" },
          $5_type: "PI",
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ assigner: "ST01", type: "MR" }],
        stub,
      );
      expect("error" in result).toBe(true);
    });
  });

  describe("{ any: true } rule", () => {
    test("matches first CX with derivable assigner", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "123",
          $4_system: { $1_namespace: "BMH" },
        },
        {
          $1_value: "456",
          $4_system: { $1_namespace: "ST01" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ any: true }],
        stub,
      );
      expect(result).toEqual({ id: "bmh-123" });
    });

    test("skips bare CX, matches CX with assigner", async () => {
      const identifiers: CX[] = [
        { $1_value: "999" }, // bare CX — no authority
        {
          $1_value: "888",
          $4_system: { $1_namespace: "FOO" },
        },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ any: true }],
        stub,
      );
      expect(result).toEqual({ id: "foo-888" });
    });

    test("all bare CX — falls through to next rule", async () => {
      const identifiers: CX[] = [
        { $1_value: "999" },
        { $1_value: "888" },
      ];

      const result = await selectPatientId(
        identifiers,
        [{ any: true }, { type: "MR" }],
        stub,
      );
      expect("error" in result).toBe(true);
    });
  });

  describe("no match / error cases", () => {
    test("no matching rule returns error", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "12345",
          $4_system: { $1_namespace: "FOO" },
          $5_type: "XX",
        },
      ];

      const rulesWithoutAny: IdentifierPriorityRule[] = [
        { assigner: "UNIPAT" },
        { type: "PE" },
        { assigner: "ST01" },
        { type: "MR" },
      ];
      const result = await selectPatientId(identifiers, rulesWithoutAny, stub);
      expect("error" in result).toBe(true);
      expect((result as { error: string }).error).toContain(
        "No identifier priority rule matched",
      );
    });

    test("empty CX.1 value — CX is skipped", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "",
          $4_system: { $1_namespace: "UNIPAT" },
        },
        {
          $1_value: "  ",
          $4_system: { $1_namespace: "UNIPAT" },
        },
        {
          $1_value: "11195429",
          $4_system: { $1_namespace: "UNIPAT" },
        },
      ];

      const result = await selectPatientId(identifiers, defaultRules, stub);
      expect(result).toEqual({ id: "unipat-11195429" });
    });

    test("empty identifier pool returns error", async () => {
      const result = await selectPatientId([], defaultRules, stub);
      expect("error" in result).toBe(true);
      expect((result as { error: string }).error).toContain(
        "No identifier priority rule matched",
      );
    });

    test("two CX match same rule — first in pool order wins", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "FIRST",
          $4_system: { $1_namespace: "UNIPAT" },
        },
        {
          $1_value: "SECOND",
          $4_system: { $1_namespace: "UNIPAT" },
        },
      ];

      const result = await selectPatientId(identifiers, defaultRules, stub);
      expect(result).toEqual({ id: "unipat-first" });
    });
  });

  describe("MPI pix strategy", () => {
    const mpiRule: MpiLookupRule = {
      mpiLookup: {
        endpoint: { baseUrl: "http://mpi.example.com" },
        strategy: "pix",
        source: [{ assigner: "ST01" }],
        target: {
          system: "urn:oid:1.2.3.4",
          assigner: "UNIPAT",
        },
      },
    };

    test("MPI returns found — throws (not implemented)", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "645541",
          $4_system: { $1_namespace: "ST01", $2_system: "urn:oid:9.8.7" },
          $5_type: "MR",
        },
      ];

      const mpi = mockMpi(async () => ({
        status: "found",
        identifier: { value: "19624139" },
      }));

      expect(
        selectPatientId(identifiers, [mpiRule], mpi),
      ).rejects.toThrow("MPI 'found' result handling not implemented");
    });

    test("MPI returns not-found — falls through to next rule", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "645541",
          $4_system: { $1_namespace: "ST01", $2_system: "urn:oid:9.8.7" },
          $5_type: "MR",
        },
      ];

      const mpi = mockMpi(async () => ({ status: "not-found" }));

      const result = await selectPatientId(
        identifiers,
        [mpiRule, { type: "MR" }],
        mpi,
      );
      // Falls through to { type: "MR" }, assigner from CX.4.1 "ST01"
      expect(result).toEqual({ id: "st01-645541" });
    });

    test("MPI unavailable — hard error, does NOT fall through", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "645541",
          $4_system: { $1_namespace: "ST01", $2_system: "urn:oid:9.8.7" },
          $5_type: "MR",
        },
      ];

      const mpi = mockMpi(async () => ({
        status: "unavailable",
        error: "Connection timeout",
      }));

      const result = await selectPatientId(
        identifiers,
        [mpiRule, { type: "MR" }],
        mpi,
      );
      expect("error" in result).toBe(true);
      expect((result as { error: string }).error).toContain("MPI unavailable");
    });

    test("no source identifier in pool — skip MPI rule", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "11220762",
          $4_system: { $1_namespace: "BMH" },
          $5_type: "PE",
        },
      ];

      const mpi = mockMpi(async () => {
        throw new Error("Should not be called");
      });

      const result = await selectPatientId(
        identifiers,
        [mpiRule, { type: "PE" }],
        mpi,
      );
      // MPI skipped (no ST01 in pool), falls to { type: "PE" }
      expect(result).toEqual({ id: "bmh-11220762" });
    });

    test("source identifier matched via CX.9.1 — throws (found not implemented)", async () => {
      const identifiers: CX[] = [
        {
          $1_value: "645541",
          $4_system: { $1_namespace: "" },
          $9_jurisdiction: { $1_code: "STATEX" },
          $5_type: "MR",
        },
      ];

      const ruleWithJurisdictionSource: MpiLookupRule = {
        mpiLookup: {
          endpoint: { baseUrl: "http://mpi.example.com" },
          strategy: "pix",
          source: [{ assigner: "STATEX" }],
          target: { system: "urn:oid:1.2.3.4", assigner: "UNIPAT" },
        },
      };

      const mpi = mockMpi(async () => ({
        status: "found",
        identifier: { value: "19624139" },
      }));

      expect(
        selectPatientId(identifiers, [ruleWithJurisdictionSource], mpi),
      ).rejects.toThrow("MPI 'found' result handling not implemented");
    });
  });
});
