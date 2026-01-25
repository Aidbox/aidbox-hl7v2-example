import { describe, test, expect } from "bun:test";
import {
  convertOBRToDiagnosticReport,
  mapOBRStatusToFHIR,
} from "../../../src/v2-to-fhir/segments/obr-diagnosticreport";
import type { OBR } from "../../../src/hl7v2/generated/fields";

describe("convertOBRToDiagnosticReport", () => {
  describe("id generation", () => {
    test("generates deterministic id from OBR-3 filler order number", () => {
      const obr: OBR = {
        $3_fillerOrderNumber: {
          $1_value: "26H-006MP0004",
          $2_namespace: "Beaker",
        },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.id).toBe("26h-006mp0004");
    });

    test("uses entity identifier only for id", () => {
      const obr: OBR = {
        $3_fillerOrderNumber: {
          $1_value: "RQ4521",
          $2_namespace: "External",
        },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.id).toBe("rq4521");
    });
  });

  describe("code mapping", () => {
    test("converts OBR-4 Universal Service ID to code", () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: {
          $1_code: "LAB5524",
          $2_text: "JAK 2 MUTATION ANALYSIS",
          $3_system: "LABBEAP",
        },
        $25_resultStatus: "F",
      };

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.code?.coding?.[0]?.code).toBe("LAB5524");
      expect(result.code?.coding?.[0]?.display).toBe("JAK 2 MUTATION ANALYSIS");
      expect(result.code?.coding?.[0]?.system).toBe("LABBEAP");
    });

    test("includes alternate coding when present", () => {
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

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.code?.coding).toHaveLength(2);
      expect(result.code?.coding?.[1]?.code).toBe("4548-4");
      expect(result.code?.coding?.[1]?.system).toBe("http://loinc.org");
    });
  });

  describe("effectiveDateTime mapping", () => {
    test("converts OBR-7 Observation Date/Time to effectiveDateTime", () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $7_observationDateTime: "20260105091000",
        $25_resultStatus: "F",
      };

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.effectiveDateTime).toBe("2026-01-05T09:10:00Z");
    });

    test("handles missing OBR-7 gracefully", () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $25_resultStatus: "F",
      };

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.effectiveDateTime).toBeUndefined();
    });
  });

  describe("issued mapping", () => {
    test("converts OBR-22 Results Report/Status Change to issued", () => {
      const obr: OBR = {
        $3_fillerOrderNumber: { $1_value: "123" },
        $4_service: { $1_code: "LAB123" },
        $22_resultsRptStatusChngDateTime: "20260105091739",
        $25_resultStatus: "F",
      };

      const result = convertOBRToDiagnosticReport(obr);

      expect(result.issued).toBe("2026-01-05T09:17:39Z");
    });
  });
});

describe("mapOBRStatusToFHIR", () => {
  test("maps O to registered", () => {
    expect(mapOBRStatusToFHIR("O")).toBe("registered");
  });

  test("maps I to registered", () => {
    expect(mapOBRStatusToFHIR("I")).toBe("registered");
  });

  test("maps S to registered", () => {
    expect(mapOBRStatusToFHIR("S")).toBe("registered");
  });

  test("maps P to preliminary", () => {
    expect(mapOBRStatusToFHIR("P")).toBe("preliminary");
  });

  test("maps A to partial", () => {
    expect(mapOBRStatusToFHIR("A")).toBe("partial");
  });

  test("maps R to partial", () => {
    expect(mapOBRStatusToFHIR("R")).toBe("partial");
  });

  test("maps N to partial", () => {
    expect(mapOBRStatusToFHIR("N")).toBe("partial");
  });

  test("maps C to corrected", () => {
    expect(mapOBRStatusToFHIR("C")).toBe("corrected");
  });

  test("maps M to corrected", () => {
    expect(mapOBRStatusToFHIR("M")).toBe("corrected");
  });

  test("maps F to final", () => {
    expect(mapOBRStatusToFHIR("F")).toBe("final");
  });

  test("maps X to cancelled", () => {
    expect(mapOBRStatusToFHIR("X")).toBe("cancelled");
  });

  test("throws for unrecognized status", () => {
    expect(() => mapOBRStatusToFHIR("Z")).toThrow(Error);
  });

  test("converts OBR-25 Result Status to DiagnosticReport status", () => {
    const obr: OBR = {
      $3_fillerOrderNumber: { $1_value: "123" },
      $4_service: { $1_code: "LAB123" },
      $25_resultStatus: "F",
    };

    const result = convertOBRToDiagnosticReport(obr);

    expect(result.status).toBe("final");
  });
});

describe("mapOBRStatusToFHIR validation", () => {
  describe("valid statuses", () => {
    test.each(["O", "I", "S", "P", "A", "R", "N", "C", "M", "F", "X"])(
      "accepts valid status %s",
      (status) => {
        expect(() => mapOBRStatusToFHIR(status)).not.toThrow();
      },
    );

    test("accepts lowercase status", () => {
      expect(() => mapOBRStatusToFHIR("f")).not.toThrow();
    });
  });

  describe("invalid statuses", () => {
    test("throws Error for missing status", () => {
      expect(() => mapOBRStatusToFHIR(undefined)).toThrow(Error);
    });

    test("throws Error for status Y", () => {
      expect(() => mapOBRStatusToFHIR("Y")).toThrow(Error);
    });

    test("throws Error for status Z", () => {
      expect(() => mapOBRStatusToFHIR("Z")).toThrow(Error);
    });

    test("error message includes missing status description", () => {
      expect(() => mapOBRStatusToFHIR(undefined)).toThrow(/missing/);
    });

    test("error message includes invalid status value", () => {
      expect(() => mapOBRStatusToFHIR("Y")).toThrow(/"Y"/);
    });
  });
});
