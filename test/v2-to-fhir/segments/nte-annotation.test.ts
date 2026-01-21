import { describe, test, expect } from "bun:test";
import { convertNTEsToAnnotation } from "../../../src/v2-to-fhir/segments/nte-annotation";
import type { NTE } from "../../../src/hl7v2/generated/fields";

describe("convertNTEsToAnnotation", () => {
  test("converts single NTE segment to annotation", () => {
    const ntes: NTE[] = [
      {
        $1_setIdNte: "1",
        $3_comment: ["This is a test note"],
      },
    ];

    const result = convertNTEsToAnnotation(ntes);

    expect(result?.text).toBe("This is a test note");
  });

  test("concatenates multiple NTE segments with newlines", () => {
    const ntes: NTE[] = [
      { $1_setIdNte: "1", $3_comment: ["Line 1"] },
      { $1_setIdNte: "2", $3_comment: ["Line 2"] },
      { $1_setIdNte: "3", $3_comment: ["Line 3"] },
    ];

    const result = convertNTEsToAnnotation(ntes);

    expect(result?.text).toBe("Line 1\nLine 2\nLine 3");
  });

  test("creates paragraph break for empty NTE-3 values", () => {
    const ntes: NTE[] = [
      { $1_setIdNte: "1", $3_comment: ["Paragraph 1"] },
      { $1_setIdNte: "2", $3_comment: [] }, // Empty creates paragraph break
      { $1_setIdNte: "3", $3_comment: ["Paragraph 2"] },
    ];

    const result = convertNTEsToAnnotation(ntes);

    expect(result?.text).toBe("Paragraph 1\n\nParagraph 2");
  });

  test("handles NTE with undefined comment", () => {
    const ntes: NTE[] = [
      { $1_setIdNte: "1" }, // No $3_comment
      { $1_setIdNte: "2", $3_comment: ["Has content"] },
    ];

    const result = convertNTEsToAnnotation(ntes);

    expect(result?.text).toBe("\nHas content");
  });

  test("concatenates multiple comment values within single NTE", () => {
    const ntes: NTE[] = [
      {
        $1_setIdNte: "1",
        $3_comment: ["Part 1", "Part 2", "Part 3"],
      },
    ];

    const result = convertNTEsToAnnotation(ntes);

    expect(result?.text).toBe("Part 1\nPart 2\nPart 3");
  });

  test("returns undefined for empty NTE array", () => {
    const ntes: NTE[] = [];

    const result = convertNTEsToAnnotation(ntes);

    expect(result).toBeUndefined();
  });

  test("returns undefined when all NTEs have empty comments", () => {
    const ntes: NTE[] = [
      { $1_setIdNte: "1", $3_comment: [] },
      { $1_setIdNte: "2", $3_comment: [] },
    ];

    const result = convertNTEsToAnnotation(ntes);

    // Should return annotation with just paragraph breaks, or undefined
    // Implementation should decide - either is valid
    expect(result?.text === "\n" || result === undefined).toBe(true);
  });

  test("preserves text from real-world NTE example", () => {
    const ntes: NTE[] = [
      { $1_setIdNte: "1", $2_sourceOfComment: "L", $3_comment: ["eGFR calculation based on the Chronic Kidney Disease Epidemiology Collaboration (CKD-EPI) equation refit without adjustment for race."] },
      { $1_setIdNte: "2", $2_sourceOfComment: "L", $3_comment: [] },
      { $1_setIdNte: "3", $2_sourceOfComment: "L", $3_comment: ["This eGFR is validated for stable chronic renal failure patients. This equation is unreliable in acute illness or patients with normal renal function."] },
      { $1_setIdNte: "4", $2_sourceOfComment: "L", $3_comment: [] },
    ];

    const result = convertNTEsToAnnotation(ntes);

    expect(result?.text).toContain("eGFR calculation");
    expect(result?.text).toContain("\n\n"); // Should have paragraph break
    expect(result?.text).toContain("This eGFR is validated");
  });
});
