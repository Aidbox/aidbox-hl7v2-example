import { describe, test, expect } from "bun:test";
import { fromOBX } from "../../../src/hl7v2/wrappers";
import { fromOBX as fromOBXGenerated } from "../../../src/hl7v2/generated/fields";
import type { HL7v2Segment } from "../../../src/hl7v2/generated/types";

describe("fromOBX wrapper", () => {
  describe("SN (Structured Numeric) value fix", () => {
    test("reconstructs comparator + number: >^90 (greater than 90)", () => {
      // When the parser encounters ">^90", it splits on ^ and creates {1: ">", 2: "90"}
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: ">", 2: "90" }, // Parser incorrectly split ">^90"
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual([">^90"]);
    });

    test("reconstructs plain number: ^90 (just 90)", () => {
      // "^90" becomes {1: "", 2: "90"}
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: "", 2: "90" },
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual(["^90"]);
    });

    test("reconstructs range: ^10^-^20 (range 10-20)", () => {
      // "^10^-^20" becomes {1: "", 2: "10", 3: "-", 4: "20"}
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: "", 2: "10", 3: "-", 4: "20" },
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual(["^10^-^20"]);
    });

    test("reconstructs ratio: ^1^:^128 (ratio 1:128)", () => {
      // "^1^:^128" becomes {1: "", 2: "1", 3: ":", 4: "128"}
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: "", 2: "1", 3: ":", 4: "128" },
          6: { 1: "ratio" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual(["^1^:^128"]);
    });

    test("reconstructs less than comparator: <^5", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: "<", 2: "5" },
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual(["<^5"]);
    });

    test("reconstructs greater than or equal: >=^100", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: ">=", 2: "100" },
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual([">=^100"]);
    });

    test("handles SN value that is already a string (no reconstruction needed)", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: ">^90", // Already a string
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual([">^90"]);
    });

    test("handles lowercase sn value type", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "sn", // lowercase
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: ">", 2: "90" },
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$5_observationValue).toEqual([">^90"]);
    });
  });

  describe("non-SN value types (no modification)", () => {
    test("parses NM (Numeric) value correctly", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "NM",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: "4.2",
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$2_valueType).toBe("NM");
      expect(result.$5_observationValue).toEqual(["4.2"]);
    });

    test("parses ST (String) value correctly", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "ST",
          3: { 1: "12345", 2: "Comment", 3: "LOCAL" },
          5: "Patient appears healthy",
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$2_valueType).toBe("ST");
      expect(result.$5_observationValue).toEqual(["Patient appears healthy"]);
    });

    test("parses CE (Coded Entry) value correctly", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "CE",
          3: { 1: "9999-1", 2: "Result Status", 3: "LN" },
          5: { 1: "260385009", 2: "Negative", 3: "SCT" },
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$2_valueType).toBe("CE");
      // CE values are processed differently by getComponent
    });

    test("parses TX (Text) value with multiple lines", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "TX",
          3: { 1: "12345", 2: "Notes", 3: "LOCAL" },
          5: ["Line 1", "Line 2", "Line 3"],
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$2_valueType).toBe("TX");
      expect(result.$5_observationValue).toEqual(["Line 1", "Line 2", "Line 3"]);
    });
  });

  describe("all OBX fields parsed correctly", () => {
    test("parses complete OBX segment with all common fields", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "5",
          2: "NM",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          4: "1",
          5: "4.2",
          6: { 1: "mmol/L" },
          7: "3.5-5.5",
          8: "N",
          11: "F",
          14: "20251209025054",
        },
      };

      const result = fromOBX(segment);

      expect(result.$1_setIdObx).toBe("5");
      expect(result.$2_valueType).toBe("NM");
      expect(result.$3_observationIdentifier?.$1_code).toBe("2823-3");
      expect(result.$3_observationIdentifier?.$2_text).toBe("Potassium");
      expect(result.$3_observationIdentifier?.$3_system).toBe("LN");
      expect(result.$4_observationSubId).toBe("1");
      expect(result.$5_observationValue).toEqual(["4.2"]);
      expect(result.$6_unit?.$1_code).toBe("mmol/L");
      expect(result.$7_referencesRange).toBe("3.5-5.5");
      expect(result.$8_abnormalFlags).toEqual(["N"]);
      expect(result.$11_observationResultStatus).toBe("F");
      expect(result.$14_observationDateTime).toBe("20251209025054");
    });

    test("parses OBX with alternate coding in observation identifier", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "NM",
          3: {
            1: "51998",
            2: "Potassium",
            3: "SRL",
            4: "2823-3",
            5: "Potassium SerPl-sCnc",
            6: "LN",
          },
          5: "4.2",
          11: "F",
        },
      };

      const result = fromOBX(segment);

      expect(result.$3_observationIdentifier?.$1_code).toBe("51998");
      expect(result.$3_observationIdentifier?.$3_system).toBe("SRL");
      expect(result.$3_observationIdentifier?.$4_altCode).toBe("2823-3");
      expect(result.$3_observationIdentifier?.$6_altSystem).toBe("LN");
    });
  });

  describe("wrapper vs generated function comparison", () => {
    test("wrapper fixes SN while generated does not", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "SN",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: { 1: ">", 2: "90" },
          11: "F",
        },
      };

      const wrapperResult = fromOBX(segment);
      const generatedResult = fromOBXGenerated(segment);

      // Wrapper reconstructs SN value correctly
      expect(wrapperResult.$5_observationValue).toEqual([">^90"]);

      // Generated function loses the caret structure (returns just the first component)
      // TODO: refactor the project code to remove/shorten the wrapper when the original function starts to handle this case
      expect(generatedResult.$5_observationValue).not.toEqual([">^90"]);
    });

    test("wrapper and generated behave identically for non-SN types", () => {
      const segment: HL7v2Segment = {
        segment: "OBX",
        fields: {
          1: "1",
          2: "NM",
          3: { 1: "2823-3", 2: "Potassium", 3: "LN" },
          5: "4.2",
          6: { 1: "mmol/L" },
          11: "F",
        },
      };

      const wrapperResult = fromOBX(segment);
      const generatedResult = fromOBXGenerated(segment);

      expect(wrapperResult).toEqual(generatedResult);
    });
  });
});
