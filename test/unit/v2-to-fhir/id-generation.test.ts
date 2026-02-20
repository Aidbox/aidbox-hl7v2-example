import { describe, test, expect } from "bun:test";
import { buildEncounterIdentifier } from "../../../src/v2-to-fhir/identity-system/encounter-id";
import type { CX } from "../../../src/hl7v2/generated/fields";

describe("buildEncounterIdentifier", () => {
  describe("valid cases", () => {
    test("CX with only CX.4 populated returns valid identifier using CX.4", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $1_namespace: "Hospital", $2_system: "urn:oid:1.2.3.4" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier).toBeDefined();
      expect(result.identifier?.[0]?.system).toBe("urn:oid:1.2.3.4");
      expect(result.identifier?.[0]?.value).toBe("V12345");
      expect(result.identifier?.[0]?.type?.coding?.[0]?.code).toBe("VN");
    });

    test("CX with only CX.4 namespace (no universal ID) returns valid identifier", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $1_namespace: "Hospital" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("Hospital");
    });

    test("CX with only CX.9 populated returns valid identifier using CX.9", () => {
      const cx: CX = {
        $1_value: "V12345",
        $9_jurisdiction: { $1_code: "US-CA", $3_system: "urn:iso:std:iso:3166:-2" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("urn:iso:std:iso:3166:-2");
      expect(result.identifier?.[0]?.value).toBe("V12345");
    });

    test("CX with only CX.9 code (no system) returns valid identifier", () => {
      const cx: CX = {
        $1_value: "V12345",
        $9_jurisdiction: { $1_code: "US-CA" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("US-CA");
    });

    test("CX with only CX.10 populated returns valid identifier using CX.10", () => {
      const cx: CX = {
        $1_value: "V12345",
        $10_department: { $1_code: "CARDIO", $3_system: "http://hospital.org/departments" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("http://hospital.org/departments");
      expect(result.identifier?.[0]?.value).toBe("V12345");
    });

    test("CX with CX.4 and CX.9 same namespace is valid (uses that namespace)", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $2_system: "urn:oid:1.2.3.4" },
        $9_jurisdiction: { $3_system: "urn:oid:1.2.3.4" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("urn:oid:1.2.3.4");
    });

    test("CX with all three authority components same value is valid", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $2_system: "SameOrg" },
        $9_jurisdiction: { $3_system: "SameOrg" },
        $10_department: { $3_system: "SameOrg" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("SameOrg");
    });

    test("identifier includes VN type coding", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $1_namespace: "Hospital" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier?.[0]?.type).toEqual({
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v2-0203",
            code: "VN",
            display: "Visit Number",
          },
        ],
      });
    });
  });

  describe("error cases", () => {
    test("undefined visitNumber returns error", () => {
      const result = buildEncounterIdentifier(undefined);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe("PV1-19 (Visit Number) is required but missing");
    });

    test("CX.1 value missing returns error", () => {
      const cx: CX = {
        $4_system: { $1_namespace: "Hospital" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe("PV1-19 (Visit Number) value is required but missing");
    });

    test("CX.1 empty string returns error", () => {
      const cx: CX = {
        $1_value: "",
        $4_system: { $1_namespace: "Hospital" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe("PV1-19 (Visit Number) value is required but missing");
    });

    test("CX.1 whitespace only returns error", () => {
      const cx: CX = {
        $1_value: "   ",
        $4_system: { $1_namespace: "Hospital" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe("PV1-19 (Visit Number) value is required but missing");
    });

    test("CX with none of CX.4/9/10 returns error", () => {
      const cx: CX = {
        $1_value: "V12345",
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe(
        "PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)",
      );
    });

    test("CX with empty CX.4 only (no namespace or universal ID) returns error", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: {},
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe(
        "PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)",
      );
    });

    test("CX with whitespace-only CX.4 namespace returns error", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $1_namespace: "   " },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe(
        "PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)",
      );
    });

    test("CX with CX.4 and CX.9 different namespaces returns conflict error", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $2_system: "urn:oid:1.2.3.4" },
        $9_jurisdiction: { $3_system: "urn:oid:5.6.7.8" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe(
        "PV1-19 has conflicting authority values in CX.4/9/10; Message Profile required to resolve precedence",
      );
    });

    test("CX with CX.4 and CX.10 different namespaces returns conflict error", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $1_namespace: "OrgA" },
        $10_department: { $1_code: "OrgB" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe(
        "PV1-19 has conflicting authority values in CX.4/9/10; Message Profile required to resolve precedence",
      );
    });

    test("CX with all three authority components with different values returns conflict error", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $2_system: "OrgA" },
        $9_jurisdiction: { $3_system: "OrgB" },
        $10_department: { $3_system: "OrgC" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier).toBeUndefined();
      expect(result.error).toContain("conflicting authority values");
    });
  });

  describe("edge cases", () => {
    test("value is trimmed in output", () => {
      const cx: CX = {
        $1_value: "  V12345  ",
        $4_system: { $1_namespace: "Hospital" },
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.identifier?.[0]?.value).toBe("V12345");
    });

    test("CX.6 (Assigning Facility) is ignored for authority", () => {
      const cx: CX = {
        $1_value: "V12345",
        $6_assigner: { $1_namespace: "Facility", $2_system: "urn:oid:9.9.9.9" },
      };

      const result = buildEncounterIdentifier(cx);

      // Should fail because CX.6 is not an authority component
      expect(result.identifier).toBeUndefined();
      expect(result.error).toBe(
        "PV1-19 authority is required: CX.4, CX.9, or CX.10 must be populated (HL7 v2.8.2)",
      );
    });

    test("empty CX.9 and CX.10 with valid CX.4 uses CX.4", () => {
      const cx: CX = {
        $1_value: "V12345",
        $4_system: { $2_system: "ValidOrg" },
        $9_jurisdiction: {},
        $10_department: {},
      };

      const result = buildEncounterIdentifier(cx);

      expect(result.error).toBeUndefined();
      expect(result.identifier?.[0]?.system).toBe("ValidOrg");
    });
  });
});
