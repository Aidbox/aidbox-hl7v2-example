import { describe, test, expect } from "bun:test";
import {
  convertOBXToObservation,
  mapOBXStatusToFHIR,
  parseReferenceRange,
  parseStructuredNumeric,
} from "../../../../src/v2-to-fhir/segments/obx-observation";
import type { OBX } from "../../../../src/hl7v2/generated/fields";

describe("convertOBXToObservation", () => {
  const baseOBX: OBX = {
    $1_setIdObx: "1",
    $3_observationIdentifier: {
      $1_code: "2823-3",
      $2_text: "Potassium",
      $3_codingSystem: "LN",
    },
    $11_observationResultStatus: "F",
  };

  describe("id generation", () => {
    test("generates deterministic id from OBR-3 and OBX-1", () => {
      const obx: OBX = { ...baseOBX, $1_setIdObx: "5" };

      const result = convertOBXToObservation(obx, "26H-006MP0004");

      expect(result.id).toBe("26h-006mp0004-obx-5");
    });

    test("incorporates OBX-4 sub-ID when present", () => {
      const obx: OBX = {
        ...baseOBX,
        $1_setIdObx: "1",
        $4_observationSubId: "a",
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.id).toBe("123-obx-1-a");
    });
  });

  describe("code mapping", () => {
    test("converts OBX-3 Observation Identifier to code without normalization", () => {
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

      const result = convertOBXToObservation(obx, "123");

      expect(result.code.coding).toHaveLength(2);
      expect(result.code.coding?.[0]?.code).toBe("51998");
      expect(result.code.coding?.[0]?.system).toBe("SRL");
      expect(result.code.coding?.[1]?.code).toBe("2823-3");
      expect(result.code.coding?.[1]?.system).toBe("LN");
    });
  });

  describe("value type NM (Numeric)", () => {
    test("converts NM value to valueQuantity", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "NM",
        $5_observationValue: ["4.2"],
        $6_unit: { $1_code: "mmol/L" },
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueQuantity?.value).toBe(4.2);
      expect(result.valueQuantity?.unit).toBe("mmol/L");
    });

    test("handles NM value without units", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "NM",
        $5_observationValue: ["100"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueQuantity?.value).toBe(100);
      expect(result.valueQuantity?.unit).toBeUndefined();
    });
  });

  describe("value type ST/TX (String/Text)", () => {
    test("converts ST value to valueString", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "ST",
        $5_observationValue: ["Detected"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueString).toBe("Detected");
    });

    test("converts TX value to valueString", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "TX",
        $5_observationValue: ["This is a long text description"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueString).toBe("This is a long text description");
    });

    test("concatenates multiple observation values", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "ST",
        $5_observationValue: ["Line 1", "Line 2"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueString).toBe("Line 1\nLine 2");
    });
  });

  describe("value type CE/CWE (Coded)", () => {
    test("converts CE value to valueCodeableConcept", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "CE",
        $5_observationValue: ["260385009^Negative^SCT"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueCodeableConcept?.coding?.[0]?.code).toBe("260385009");
      expect(result.valueCodeableConcept?.coding?.[0]?.display).toBe(
        "Negative",
      );
    });

    test("converts CWE value to valueCodeableConcept", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "CWE",
        $5_observationValue: ["POS^Positive^99LOCAL"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueCodeableConcept?.coding?.[0]?.code).toBe("POS");
      expect(result.valueCodeableConcept?.coding?.[0]?.display).toBe(
        "Positive",
      );
    });
  });

  describe("value type DT/TS (DateTime)", () => {
    test("converts DT value to valueDateTime", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "DT",
        $5_observationValue: ["20260105"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueDateTime).toBe("2026-01-05");
    });

    test("converts TS value to valueDateTime", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "TS",
        $5_observationValue: ["20260105091000"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueDateTime).toBe("2026-01-05T09:10:00Z");
    });
  });

  describe("value type TM (Time)", () => {
    test("converts TM value to valueTime", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "TM",
        $5_observationValue: ["091000"],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueTime).toBe("09:10:00");
    });
  });

  describe("effectiveDateTime", () => {
    test("converts OBX-14 Date/Time of Observation to effectiveDateTime", () => {
      const obx: OBX = {
        ...baseOBX,
        $14_observationDateTime: "20260105091000",
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.effectiveDateTime).toBe("2026-01-05T09:10:00Z");
    });
  });

  describe("empty value handling", () => {
    test("omits value when OBX-5 is empty", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "ST",
        $5_observationValue: [],
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueString).toBeUndefined();
      expect(result.valueQuantity).toBeUndefined();
    });

    test("handles missing OBX-5 gracefully", () => {
      const obx: OBX = {
        ...baseOBX,
        $2_valueType: "NM",
      };

      const result = convertOBXToObservation(obx, "123");

      expect(result.valueQuantity).toBeUndefined();
    });
  });
});

describe("mapOBXStatusToFHIR", () => {
  test("maps F to final", () => {
    expect(mapOBXStatusToFHIR("F")).toBe("final");
  });

  test("maps B to final", () => {
    expect(mapOBXStatusToFHIR("B")).toBe("final");
  });

  test("maps V to final", () => {
    expect(mapOBXStatusToFHIR("V")).toBe("final");
  });

  test("maps U to final", () => {
    expect(mapOBXStatusToFHIR("U")).toBe("final");
  });

  test("maps P to preliminary", () => {
    expect(mapOBXStatusToFHIR("P")).toBe("preliminary");
  });

  test("maps R to preliminary", () => {
    expect(mapOBXStatusToFHIR("R")).toBe("preliminary");
  });

  test("maps S to preliminary", () => {
    expect(mapOBXStatusToFHIR("S")).toBe("preliminary");
  });

  test("maps I to registered", () => {
    expect(mapOBXStatusToFHIR("I")).toBe("registered");
  });

  test("maps O to registered", () => {
    expect(mapOBXStatusToFHIR("O")).toBe("registered");
  });

  test("maps C to corrected", () => {
    expect(mapOBXStatusToFHIR("C")).toBe("corrected");
  });

  test("maps A to amended", () => {
    expect(mapOBXStatusToFHIR("A")).toBe("amended");
  });

  test("maps D to entered-in-error", () => {
    expect(mapOBXStatusToFHIR("D")).toBe("entered-in-error");
  });

  test("maps W to entered-in-error", () => {
    expect(mapOBXStatusToFHIR("W")).toBe("entered-in-error");
  });

  test("maps X to cancelled", () => {
    expect(mapOBXStatusToFHIR("X")).toBe("cancelled");
  });

  test("throws for unrecognized status", () => {
    expect(() => mapOBXStatusToFHIR("Z")).toThrow(Error);
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

  test("converts SN plain number to valueQuantity", () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["^90"],
      $6_unit: { $1_code: "%" },
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.valueQuantity?.value).toBe(90);
    expect(result.valueQuantity?.unit).toBe("%");
  });

  test("converts SN with comparator to valueQuantity with comparator", () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: [">^90"],
      $6_unit: { $1_code: "mL/min" },
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.valueQuantity?.value).toBe(90);
    expect(result.valueQuantity?.comparator).toBe(">");
    expect(result.valueQuantity?.unit).toBe("mL/min");
  });

  test("converts SN range to valueRange", () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["^10^-^20"],
      $6_unit: { $1_code: "mmol/L" },
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.valueRange?.low?.value).toBe(10);
    expect(result.valueRange?.low?.unit).toBe("mmol/L");
    expect(result.valueRange?.high?.value).toBe(20);
    expect(result.valueRange?.high?.unit).toBe("mmol/L");
  });

  test("converts SN ratio to valueRatio", () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["^1^:^128"],
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.valueRatio?.numerator?.value).toBe(1);
    expect(result.valueRatio?.denominator?.value).toBe(128);
  });

  test("falls back to valueString for unparseable SN", () => {
    const obx: OBX = {
      ...baseOBX,
      $5_observationValue: ["invalid_format"],
    };

    const result = convertOBXToObservation(obx, "123");

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

  test("converts OBX-8 H to high interpretation", () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["H"],
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("H");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("High");
  });

  test("converts OBX-8 L to low interpretation", () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["L"],
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("L");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("Low");
  });

  test("converts OBX-8 A to abnormal interpretation", () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["A"],
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("A");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("Abnormal");
  });

  test("converts OBX-8 N to normal interpretation", () => {
    const obx: OBX = {
      ...baseOBX,
      $8_abnormalFlags: ["N"],
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.interpretation?.[0]?.coding?.[0]?.code).toBe("N");
    expect(result.interpretation?.[0]?.coding?.[0]?.display).toBe("Normal");
  });

  test("handles missing OBX-8 gracefully", () => {
    const obx: OBX = { ...baseOBX };

    const result = convertOBXToObservation(obx, "123");

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

  test("converts OBX-7 simple range to referenceRange", () => {
    const obx: OBX = {
      ...baseOBX,
      $7_referencesRange: "3.5-5.5",
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.referenceRange?.[0]?.low?.value).toBe(3.5);
    expect(result.referenceRange?.[0]?.high?.value).toBe(5.5);
  });

  test("converts OBX-7 text range to referenceRange.text", () => {
    const obx: OBX = {
      ...baseOBX,
      $7_referencesRange: "negative",
    };

    const result = convertOBXToObservation(obx, "123");

    expect(result.referenceRange?.[0]?.text).toBe("negative");
  });
});

describe("mapOBXStatusToFHIR validation", () => {
  describe("valid statuses", () => {
    test.each(["F", "B", "V", "U", "P", "R", "S", "I", "O", "C", "A", "D", "W", "X"])(
      "accepts valid status %s",
      (status) => {
        expect(() => mapOBXStatusToFHIR(status)).not.toThrow();
      },
    );

    test("accepts lowercase status", () => {
      expect(() => mapOBXStatusToFHIR("f")).not.toThrow();
    });
  });

  describe("invalid statuses", () => {
    test("throws Error for status N", () => {
      expect(() => mapOBXStatusToFHIR("N")).toThrow(Error);
    });

    test("throws Error for lowercase n", () => {
      expect(() => mapOBXStatusToFHIR("n")).toThrow(Error);
    });

    test("error message includes invalid status value", () => {
      expect(() => mapOBXStatusToFHIR("N")).toThrow(/"N"/);
    });
  });
});
