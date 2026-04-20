import { describe, test, expect } from "bun:test";
import {
  convertOBRWithMappingSupport,
  mapOBRStatusToFHIRWithResult,
} from "../../../../src/v2-to-fhir/segments/obr-diagnosticreport";
import type { OBR } from "../../../../src/hl7v2/generated/fields";
import type { SenderContext } from "../../../../src/code-mapping/concept-map";

const SENDER: SenderContext = {
  sendingApplication: "TEST_APP",
  sendingFacility: "TEST_FAC",
};

async function convertOk(obr: OBR) {
  const result = await convertOBRWithMappingSupport(obr, SENDER);
  if (result.error) {
    throw new Error(`Unexpected conversion error: ${JSON.stringify(result.error)}`);
  }
  return result.diagnosticReport;
}

describe("convertOBRWithMappingSupport", () => {
  describe("id generation", () => {
    test("generates deterministic id from OBR-3 filler order number", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: {
          $1_value: "26H-006MP0004",
          $2_namespace: "Beaker",
        },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.id).toBe("26h-006mp0004");
    });

    test("uses entity identifier only for id", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: {
          $1_value: "RQ4521",
          $2_namespace: "External",
        },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.id).toBe("rq4521");
    });
  });

  describe("code mapping", () => {
    test("converts OBR-4 Universal Service ID to code", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: {
          $1_code: "LAB5524",
          $2_text: "JAK 2 MUTATION ANALYSIS",
          $3_system: "LABBEAP",
        },
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.code?.coding?.[0]?.code).toBe("LAB5524");
      expect(dr.code?.coding?.[0]?.display).toBe("JAK 2 MUTATION ANALYSIS");
      expect(dr.code?.coding?.[0]?.system).toBe("LABBEAP");
    });

    test("includes alternate coding when present", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: {
          $1_code: "LAB90",
          $2_text: "HEMOGLOBIN A1C",
          $3_system: "LOCAL",
          $4_altCode: "4548-4",
          $5_altDisplay: "Hemoglobin A1c/Hemoglobin.total",
          $6_altSystem: "LN",
        },
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.code?.coding).toHaveLength(2);
      expect(dr.code?.coding?.[1]?.code).toBe("4548-4");
      expect(dr.code?.coding?.[1]?.system).toBe("http://loinc.org");
    });
  });

  describe("effectiveDateTime mapping", () => {
    test("converts OBR-7 Observation Date/Time to effectiveDateTime", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $7_observationDateTime: "20260105091000",
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.effectiveDateTime).toBe("2026-01-05T09:10:00Z");
    });

    test("handles missing OBR-7 gracefully", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.effectiveDateTime).toBeUndefined();
    });
  });

  describe("issued mapping", () => {
    test("converts OBR-22 Results Report/Status Change to issued", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $22_resultsRptStatusChngDateTime: "20260105091739",
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.issued).toBe("2026-01-05T09:17:39Z");
    });
  });

  describe("status mapping", () => {
    test("converts OBR-25 Result Status to DiagnosticReport status", async () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const dr = await convertOk(obr);

      expect(dr.status).toBe("final");
    });
  });
});

describe("mapOBRStatusToFHIRWithResult", () => {
  describe("valid statuses", () => {
    test.each([
      ["O", "registered"],
      ["I", "registered"],
      ["S", "registered"],
      ["P", "preliminary"],
      ["A", "partial"],
      ["R", "partial"],
      ["N", "partial"],
      ["C", "corrected"],
      ["M", "corrected"],
      ["F", "final"],
      ["X", "cancelled"],
    ] as const)("maps %s to %s", (input, expected) => {
      const result = mapOBRStatusToFHIRWithResult(input);
      expect(result.status).toBe(expected);
      expect(result.error).toBeUndefined();
    });

    test("accepts lowercase status", () => {
      const result = mapOBRStatusToFHIRWithResult("f");
      expect(result.status).toBe("final");
      expect(result.error).toBeUndefined();
    });
  });

  describe("invalid statuses", () => {
    test("returns error for missing status", () => {
      const result = mapOBRStatusToFHIRWithResult(undefined);
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.mappingType).toBe("obr-status");
      expect(result.error?.localCode).toBe("undefined");
      expect(result.error?.localDisplay).toContain("missing");
    });

    test("returns error for status Y", () => {
      const result = mapOBRStatusToFHIRWithResult("Y");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.mappingType).toBe("obr-status");
      expect(result.error?.localCode).toBe("Y");
      expect(result.error?.localSystem).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0123",
      );
    });

    test("returns error for status Z", () => {
      const result = mapOBRStatusToFHIRWithResult("Z");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("Z");
    });
  });
});
