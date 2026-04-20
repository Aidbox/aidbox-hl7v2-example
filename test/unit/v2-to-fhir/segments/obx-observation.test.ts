import { describe, test, expect } from "bun:test";
import {
  convertOBXWithMappingSupportAsync,
  mapOBXStatusToFHIRWithResult,
  parseReferenceRange,
  parseStructuredNumeric,
} from "../../../../src/v2-to-fhir/segments/obx-observation";
import type { OBX } from "../../../../src/hl7v2/generated/fields";
import type { SenderContext } from "../../../../src/code-mapping/concept-map";

const TEST_SENDER: SenderContext = {
  sendingApplication: "TEST_APP",
  sendingFacility: "TEST_FAC",
};

async function convertOBX(obx: OBX, orderNumber: string) {
  const result = await convertOBXWithMappingSupportAsync(obx, orderNumber, TEST_SENDER);
  if (result.error) {
    throw new Error(`Unexpected conversion error: ${JSON.stringify(result.error)}`);
  }
  return result.observation;
}

describe("convertOBXWithMappingSupportAsync", () => {
  const baseOBX: OBX = {
    $1_setIdObx: "1",
    $3_observationIdentifier: {
      $1_code: "2823-3",
      $2_text: "Potassium",
      $3_system: "LN",
    },
    $11_observationResultStatus: "F",
  };

  describe("id generation", () => {
    test("generates deterministic id from OBR-3 and OBX-1", async () => {
      const obx: OBX = { ...baseOBX, $1_setIdObx: "5" };

      const result = await convertOBX(obx, "26H-006MP0004");

      expect(result.id).toBe("26h-006mp0004-obx-5");
    });

    test("incorporates OBX-4 sub-ID when present", async () => {
      const obx: OBX = {
        ...baseOBX,
        $1_setIdObx: "1",
        $4_observationSubId: "a",
      };

      const result = await convertOBX(obx, "123");

      expect(result.id).toBe("123-obx-1-a");
    });
  });

  describe("code mapping", () => {
    test("converts OBX-3 Observation Identifier to code without normalization", async () => {
      const obx: OBX = {
        ...baseOBX,
        $3_observationIdentifier: {
          $1_code: "51998",
          $2_text: "Potassium",
          $3_system: "SRL",
          $4_altCode: "2823-3",
          $5_altDisplay: "Potassium SerPl-sCnc",
          $6_altSystem: "LN",
        },
      };

      const result = await convertOBX(obx, "123");

      expect(result.code.coding).toHaveLength(2);
      expect(result.code.coding?.[0]?.code).toBe("51998");
      expect(result.code.coding?.[0]?.system).toBe("SRL");
      expect(result.code.coding?.[1]?.code).toBe("2823-3");
      expect(result.code.coding?.[1]?.system).toBe("LN");
    });
  });

  describe("value type NM (Numeric)", () => {
    test("converts NM value to valueQuantity", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "NM",
        $5_observationValue: ["4.2"],
        $6_unit: { $1_code: "mmol/L" },
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueQuantity?.value).toBe(4.2);
      expect(result.valueQuantity?.unit).toBe("mmol/L");
    });

    test("handles NM value without units", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "NM",
        $5_observationValue: ["100"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueQuantity?.value).toBe(100);
      expect(result.valueQuantity?.unit).toBeUndefined();
    });
  });

  describe("value type ST/TX (String/Text)", () => {
    test("converts ST value to valueString", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "ST",
        $5_observationValue: ["Detected"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueString).toBe("Detected");
    });

    test("converts TX value to valueString", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "TX",
        $5_observationValue: ["This is a long text description"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueString).toBe("This is a long text description");
    });

    test("concatenates multiple observation values", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "ST",
        $5_observationValue: ["Line 1", "Line 2"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueString).toBe("Line 1\nLine 2");
    });
  });

  describe("value type CE/CWE (Coded)", () => {
    test("converts CE value to valueCodeableConcept", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "CE",
        $5_observationValue: ["260385009^Negative^SCT"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueCodeableConcept?.coding?.[0]?.code).toBe("260385009");
      expect(result.valueCodeableConcept?.coding?.[0]?.display).toBe(
        "Negative",
      );
    });

    test("converts CWE value to valueCodeableConcept", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "CWE",
        $5_observationValue: ["POS^Positive^99LOCAL"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueCodeableConcept?.coding?.[0]?.code).toBe("POS");
      expect(result.valueCodeableConcept?.coding?.[0]?.display).toBe(
        "Positive",
      );
    });
  });

  describe("value type DT/TS (DateTime)", () => {
    test("converts DT value to valueDateTime", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "DT",
        $5_observationValue: ["20260105"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueDateTime).toBe("2026-01-05");
    });

    test("converts TS value to valueDateTime", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "TS",
        $5_observationValue: ["20260105091000"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueDateTime).toBe("2026-01-05T09:10:00Z");
    });
  });

  describe("value type TM (Time)", () => {
    test("converts TM value to valueTime", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "TM",
        $5_observationValue: ["091000"],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueTime).toBe("09:10:00");
    });
  });

  describe("effectiveDateTime", () => {
    test("converts OBX-14 Date/Time of Observation to effectiveDateTime", async () => {
      const obx: OBX = {
        ...baseOBX,
        $14_observationDateTime: "20260105091000",
      };

      const result = await convertOBX(obx, "123");

      expect(result.effectiveDateTime).toBe("2026-01-05T09:10:00Z");
    });
  });

  describe("empty value handling", () => {
    test("omits value when OBX-5 is empty", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "ST",
        $5_observationValue: [],
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueString).toBeUndefined();
      expect(result.valueQuantity).toBeUndefined();
    });

    test("handles missing OBX-5 gracefully", async () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "NM",
      };

      const result = await convertOBX(obx, "123");

      expect(result.valueQuantity).toBeUndefined();
    });
  });
});

describe("parseReferenceRange", () => {
  test("parses simple range like 3.5-5.5", () => {
    const result = parseReferenceRange("3.5-5.5");

    expect(result.low?.value).toBe(3.5);
    expect(result.high?.value).toBe(5.5);
  });

  test("parses range with integer values", () => {
    const result = parseReferenceRange("70-99");

    expect(result.low?.value).toBe(70);
    expect(result.high?.value).toBe(99);
  });

  test("parses comparator range >60", () => {
    const result = parseReferenceRange(">60");

    expect(result.text).toBe(">60");
    expect(result.low?.value).toBe(60);
  });

  test("parses comparator range <5", () => {
    const result = parseReferenceRange("<5");

    expect(result.text).toBe("<5");
    expect(result.high?.value).toBe(5);
  });

  test("handles text-only range like negative", () => {
    const result = parseReferenceRange("negative");

    expect(result.text).toBe("negative");
    expect(result.low).toBeUndefined();
    expect(result.high).toBeUndefined();
  });

  test("handles text-only range like normal", () => {
    const result = parseReferenceRange("normal");

    expect(result.text).toBe("normal");
  });

  test("returns text only for unparseable values", () => {
    const result = parseReferenceRange("See interpretation");

    expect(result.text).toBe("See interpretation");
    expect(result.low).toBeUndefined();
    expect(result.high).toBeUndefined();
  });
});

describe("parseStructuredNumeric (SN)", () => {
  test("parses plain number ^90 to valueQuantity", () => {
    const result = parseStructuredNumeric("^90");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(90);
  });

  test("parses comparator >^90 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric(">^90");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(90);
    expect(result.comparator).toBe(">");
  });

  test("parses comparator <^5 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric("<^5");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(5);
    expect(result.comparator).toBe("<");
  });

  test("parses comparator >=^100 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric(">=^100");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(100);
    expect(result.comparator).toBe(">=");
  });

  test("parses comparator <=^50 to valueQuantity with comparator", () => {
    const result = parseStructuredNumeric("<=^50");

    expect(result.type).toBe("quantity");
    expect(result.value).toBe(50);
    expect(result.comparator).toBe("<=");
  });

  test("parses range ^10^-^20 to valueRange", () => {
    const result = parseStructuredNumeric("^10^-^20");

    expect(result.type).toBe("range");
    expect(result.low).toBe(10);
    expect(result.high).toBe(20);
  });

  test("parses ratio ^1^:^128 to valueRatio", () => {
    const result = parseStructuredNumeric("^1^:^128");

    expect(result.type).toBe("ratio");
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(128);
  });

  test("parses ratio ^1^:^500 to valueRatio", () => {
    const result = parseStructuredNumeric("^1^:^500");

    expect(result.type).toBe("ratio");
    expect(result.numerator).toBe(1);
    expect(result.denominator).toBe(500);
  });

  test("returns string fallback for unparseable SN", () => {
    const result = parseStructuredNumeric("invalid");

    expect(result.type).toBe("string");
    expect(result.raw).toBe("invalid");
  });
});

describe("value type SN (Structured Numeric) in OBX", () => {
  const baseOBX: OBX = {
    $1_setIdObx: "1",
    $3_observationIdentifier: { $1_code: "TEST" },
    $11_observationResultStatus: "F",
    $2_valueType: "SN",
  };

  test("converts SN plain number to valueQuantity", async () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["^90"],
      $6_unit: { $1_code: "%" },
    };

    const result = await convertOBX(obx, "123");

    expect(result.valueQuantity?.value).toBe(90);
    expect(result.valueQuantity?.unit).toBe("%");
  });

  test("converts SN with comparator to valueQuantity with comparator", async () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: [">^90"],
      $6_unit: { $1_code: "mL/min" },
    };

    const result = await convertOBX(obx, "123");

    expect(result.valueQuantity?.value).toBe(90);
    expect(result.valueQuantity?.comparator).toBe(">");
    expect(result.valueQuantity?.unit).toBe("mL/min");
  });

  test("converts SN range to valueRange", async () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["^10^-^20"],
      $6_unit: { $1_code: "mmol/L" },
    };

    const result = await convertOBX(obx, "123");

    expect(result.valueRange?.low?.value).toBe(10);
    expect(result.valueRange?.low?.unit).toBe("mmol/L");
    expect(result.valueRange?.high?.value).toBe(20);
    expect(result.valueRange?.high?.unit).toBe("mmol/L");
  });

  test("converts SN ratio to valueRatio", async () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["^1^:^128"],
    };

    const result = await convertOBX(obx, "123");

    expect(result.valueRatio?.numerator?.value).toBe(1);
    expect(result.valueRatio?.denominator?.value).toBe(128);
  });

  test("falls back to valueString for unparseable SN", async () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["invalid_format"],
    };

    const result = await convertOBX(obx, "123");

    expect(result.valueString).toBe("invalid_format");
  });
});

describe("interpretation (OBX-8)", () => {
  const baseOBX: OBX = {
    $1_setIdObx: "1",
    $3_observationIdentifier: { $1_code: "TEST" },
    $11_observationResultStatus: "F",
    $2_valueType: "NM",
    $5_observationValue: ["100"],
  };

  test("converts OBX-8 H to high interpretation", async () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["H"],
    };

    const result = await convertOBX(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("H");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("High");
  });

  test("converts OBX-8 L to low interpretation", async () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["L"],
    };

    const result = await convertOBX(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("L");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("Low");
  });

  test("converts OBX-8 A to abnormal interpretation", async () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["A"],
    };

    const result = await convertOBX(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("A");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("Abnormal");
  });

  test("converts OBX-8 N to normal interpretation", async () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["N"],
    };

    const result = await convertOBX(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("N");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("Normal");
  });

  test("handles missing OBX-8 gracefully", async () => {
    const obx: OBX = { ...baseOBX };

    const result = await convertOBX(obx, "123");

    expect(result.interpretation).toBeUndefined();
  });
});

describe("referenceRange (OBX-7)", () => {
  const baseOBX: OBX = {
    $1_setIdObx: "1",
    $3_observationIdentifier: { $1_code: "TEST" },
    $11_observationResultStatus: "F",
    $2_valueType: "NM",
    $5_observationValue: ["4.2"],
  };

  test("converts OBX-7 simple range to referenceRange", async () => {
    const obx: OBX = {
      ...baseOBX,
      $7_referencesRange: "3.5-5.5",
    };

    const result = await convertOBX(obx, "123");

    expect(result.referenceRange?.[0]?.low?.value).toBe(3.5);
    expect(result.referenceRange?.[0]?.high?.value).toBe(5.5);
  });

  test("converts OBX-7 text range to referenceRange.text", async () => {
    const obx: OBX = {
      ...baseOBX,
      $7_referencesRange: "negative",
    };

    const result = await convertOBX(obx, "123");

    expect(result.referenceRange?.[0]?.text).toBe("negative");
  });
});

describe("mapOBXStatusToFHIRWithResult", () => {
  describe("valid statuses", () => {
    test.each([
      ["F", "final"],
      ["B", "final"],
      ["V", "final"],
      ["U", "final"],
      ["P", "preliminary"],
      ["R", "preliminary"],
      ["S", "preliminary"],
      ["I", "registered"],
      ["O", "registered"],
      ["C", "corrected"],
      ["A", "amended"],
      ["D", "entered-in-error"],
      ["W", "entered-in-error"],
      ["X", "cancelled"],
    ] as const)("maps %s to %s", (input, expected) => {
      const result = mapOBXStatusToFHIRWithResult(input);
      expect(result.status).toBe(expected);
      expect(result.error).toBeUndefined();
    });

    test("accepts lowercase status", () => {
      const result = mapOBXStatusToFHIRWithResult("f");
      expect(result.status).toBe("final");
      expect(result.error).toBeUndefined();
    });
  });

  describe("invalid statuses", () => {
    test("returns error for missing status (undefined)", () => {
      const result = mapOBXStatusToFHIRWithResult(undefined);
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.mappingType).toBe("obx-status");
      expect(result.error?.localCode).toBe("undefined");
      expect(result.error?.localDisplay).toContain("missing");
    });

    test("returns error for status N (not asked)", () => {
      const result = mapOBXStatusToFHIRWithResult("N");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.mappingType).toBe("obx-status");
      expect(result.error?.localCode).toBe("N");
      expect(result.error?.localSystem).toBe(
        "http://terminology.hl7.org/CodeSystem/v2-0085",
      );
    });

    test("returns error for lowercase n", () => {
      const result = mapOBXStatusToFHIRWithResult("n");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("n");
    });

    test("returns error for unknown status Y", () => {
      const result = mapOBXStatusToFHIRWithResult("Y");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("Y");
    });

    test("returns error for unknown status Z", () => {
      const result = mapOBXStatusToFHIRWithResult("Z");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("Z");
    });

    test("returns error for empty string status", () => {
      const result = mapOBXStatusToFHIRWithResult("");
      expect(result.status).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.error?.localCode).toBe("undefined");
    });
  });
});
