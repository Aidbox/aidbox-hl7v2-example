import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { ConceptMap } from "../../src/fhir/hl7-fhir-r4-core/ConceptMap";

// ============================================================================
// Test Fixtures
// ============================================================================

// Sample ConceptMap for sender "EPIC" / "UIHEALTH"
const sampleConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-epic-uihealth-to-loinc",
  status: "active",
  sourceUri: "http://example.org/fhir/ValueSet/local-lab-codes",
  targetUri: "http://loinc.org",
  group: [
    {
      source: "LABBLRR",
      target: "http://loinc.org",
      element: [
        {
          code: "1230148171",
          display: "JAK2 V617F",
          target: [
            {
              code: "46342-2",
              display: "JAK2 gene mutation analysis",
              equivalence: "equivalent",
            },
          ],
        },
        {
          code: "1230148217",
          display: "VARIANT ALLELE FREQUENCY (VAF) % (V617F)",
          target: [
            {
              code: "81246-9",
              display: "Variant allelic frequency",
              equivalence: "equivalent",
            },
          ],
        },
      ],
    },
  ],
};

// ============================================================================
// Unit Tests: generateConceptMapId
// ============================================================================

describe("generateConceptMapId", () => {
  test("generates correct ID format", async () => {
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const result = generateConceptMapId({
      sendingApplication: "EPIC",
      sendingFacility: "UIHEALTH",
    });

    expect(result).toBe("hl7v2-epic-uihealth-to-loinc");
  });

  test("handles special characters by converting to kebab-case", async () => {
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const result = generateConceptMapId({
      sendingApplication: "SENdr10",
      sendingFacility: "Sentara Reference Lab Solutions (Epic Beaker)",
    });

    expect(result).toBe(
      "hl7v2-sendr10-sentara-reference-lab-solutions-epic-beaker-to-loinc",
    );
  });

  test("handles uppercase by converting to lowercase", async () => {
    const { generateConceptMapId } =
      await import("../../src/code-mapping/concept-map");

    const result = generateConceptMapId({
      sendingApplication: "LAB_SYSTEM",
      sendingFacility: "HOSPITAL.ONE",
    });

    expect(result).toBe("hl7v2-lab-system-hospital-one-to-loinc");
  });
});

// ============================================================================
// Unit Tests: lookupInConceptMap
// ============================================================================

describe("lookupInConceptMap", () => {
  test("returns LOINC coding when mapping exists", async () => {
    const { lookupInConceptMap } =
      await import("../../src/code-mapping/concept-map");

    const result = lookupInConceptMap(
      sampleConceptMap,
      "1230148171",
      "LABBLRR",
    );

    expect(result).not.toBeNull();
    expect(result?.code).toBe("46342-2");
    expect(result?.display).toBe("JAK2 gene mutation analysis");
    expect(result?.system).toBe("http://loinc.org");
  });

  test("returns null when code not found in ConceptMap", async () => {
    const { lookupInConceptMap } =
      await import("../../src/code-mapping/concept-map");

    const result = lookupInConceptMap(
      sampleConceptMap,
      "UNKNOWN_CODE",
      "LABBLRR",
    );

    expect(result).toBeNull();
  });

  test("returns null when system doesn't match", async () => {
    const { lookupInConceptMap } =
      await import("../../src/code-mapping/concept-map");

    const result = lookupInConceptMap(
      sampleConceptMap,
      "1230148171",
      "WRONG_SYSTEM",
    );

    expect(result).toBeNull();
  });

  test("returns null when ConceptMap has no groups", async () => {
    const { lookupInConceptMap } =
      await import("../../src/code-mapping/concept-map");

    const emptyConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      status: "active",
    };

    const result = lookupInConceptMap(emptyConceptMap, "1230148171", "LABBLRR");

    expect(result).toBeNull();
  });

  test("handles lookup without system (matches any source)", async () => {
    const { lookupInConceptMap } =
      await import("../../src/code-mapping/concept-map");

    // Create ConceptMap without source system specified
    const conceptMapNoSource: ConceptMap = {
      resourceType: "ConceptMap",
      status: "active",
      group: [
        {
          target: "http://loinc.org",
          element: [
            {
              code: "TEST123",
              target: [{ code: "99999-9", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    const result = lookupInConceptMap(conceptMapNoSource, "TEST123", undefined);

    expect(result?.code).toBe("99999-9");
  });
});

// ============================================================================
// Unit Tests: resolveToLoinc - Inline LOINC Detection
// ============================================================================

describe("resolveToLoinc - inline LOINC detection", () => {
  const mockFetchConceptMap = mock(() => Promise.resolve(null));

  beforeEach(() => {
    mockFetchConceptMap.mockClear();
  });

  test("returns LOINC from primary coding when system is LN", async () => {
    const { resolveToLoinc } =
      await import("../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "2823-3",
        $2_text: "Potassium SerPl-sCnc",
        $3_system: "LN",
      },
      { sendingApplication: "TEST", sendingFacility: "FAC" },
      mockFetchConceptMap,
    );

    expect(result.loinc.code).toBe("2823-3");
    expect(result.loinc.display).toBe("Potassium SerPl-sCnc");
    expect(result.loinc.system).toBe("http://loinc.org");
    expect(result.local).toBeUndefined();
    // Should NOT call fetchConceptMap since LOINC is inline
    expect(mockFetchConceptMap).not.toHaveBeenCalled();
  });

  test("returns LOINC from alternate coding when system is LN", async () => {
    const { resolveToLoinc } =
      await import("../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "51998",
        $2_text: "Potassium",
        $3_system: "SRL",
        $4_altCode: "2823-3",
        $5_altDisplay: "Potassium SerPl-sCnc",
        $6_altSystem: "LN",
      },
      { sendingApplication: "TEST", sendingFacility: "FAC" },
      mockFetchConceptMap,
    );

    expect(result.loinc.code).toBe("2823-3");
    expect(result.loinc.display).toBe("Potassium SerPl-sCnc");
    expect(result.loinc.system).toBe("http://loinc.org");
    // Should include local coding as well
    expect(result.local?.code).toBe("51998");
    expect(result.local?.display).toBe("Potassium");
    // Should NOT call fetchConceptMap since LOINC is inline
    expect(mockFetchConceptMap).not.toHaveBeenCalled();
  });

  test("handles case-insensitive LN system check", async () => {
    const { resolveToLoinc } =
      await import("../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "2823-3",
        $2_text: "Potassium",
        $3_system: "ln", // lowercase
      },
      { sendingApplication: "TEST", sendingFacility: "FAC" },
      mockFetchConceptMap,
    );

    expect(result.loinc.code).toBe("2823-3");
  });
});

// ============================================================================
// Unit Tests: resolveToLoinc - ConceptMap Lookup
// ============================================================================

describe("resolveToLoinc - ConceptMap lookup", () => {
  test("looks up local code in ConceptMap when no inline LOINC", async () => {
    const mockFetchConceptMap = mock(() => Promise.resolve(sampleConceptMap));

    const { resolveToLoinc } =
      await import("../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "1230148171",
        $2_text: "JAK2 V617F",
        $3_system: "LABBLRR",
      },
      { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
      mockFetchConceptMap,
    );

    expect(result.loinc.code).toBe("46342-2");
    expect(result.loinc.display).toBe("JAK2 gene mutation analysis");
    expect(result.local?.code).toBe("1230148171");
    expect(mockFetchConceptMap).toHaveBeenCalledWith(
      "hl7v2-epic-uihealth-to-loinc",
    );
  });

  test("throws LoincResolutionError when ConceptMap not found", async () => {
    const mockFetchConceptMap = mock(() => Promise.resolve(null));

    const { resolveToLoinc, LoincResolutionError } =
      await import("../../src/code-mapping/concept-map");

    await expect(
      resolveToLoinc(
        {
          $1_code: "UNMAPPED",
          $2_text: "Unknown Test",
          $3_system: "LOCAL",
        },
        { sendingApplication: "UNKNOWN", sendingFacility: "LAB" },
        mockFetchConceptMap,
      ),
    ).rejects.toThrow(LoincResolutionError);

    try {
      await resolveToLoinc(
        {
          $1_code: "UNMAPPED",
          $2_text: "Unknown Test",
          $3_system: "LOCAL",
        },
        { sendingApplication: "UNKNOWN", sendingFacility: "LAB" },
        mockFetchConceptMap,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(LoincResolutionError);
      const loincError = error as InstanceType<typeof LoincResolutionError>;
      expect(loincError.localCode).toBe("UNMAPPED");
      expect(loincError.sendingApplication).toBe("UNKNOWN");
      expect(loincError.sendingFacility).toBe("LAB");
      expect(loincError.message).toContain("ConceptMap not found");
    }
  });

  test("throws LoincResolutionError when mapping not found in ConceptMap", async () => {
    const mockFetchConceptMap = mock(() => Promise.resolve(sampleConceptMap));

    const { resolveToLoinc, LoincResolutionError } =
      await import("../../src/code-mapping/concept-map");

    await expect(
      resolveToLoinc(
        {
          $1_code: "UNKNOWN_CODE",
          $2_text: "Unknown Test",
          $3_system: "LABBLRR",
        },
        { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
        mockFetchConceptMap,
      ),
    ).rejects.toThrow(LoincResolutionError);

    try {
      await resolveToLoinc(
        {
          $1_code: "UNKNOWN_CODE",
          $2_text: "Unknown Test",
          $3_system: "LABBLRR",
        },
        { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
        mockFetchConceptMap,
      );
    } catch (error) {
      expect(error).toBeInstanceOf(LoincResolutionError);
      const loincError = error as InstanceType<typeof LoincResolutionError>;
      expect(loincError.localCode).toBe("UNKNOWN_CODE");
      expect(loincError.message).toContain("No LOINC mapping found");
    }
  });
});

// ============================================================================
// Unit Tests: resolveToLoinc - Error Cases
// ============================================================================

describe("resolveToLoinc - error cases", () => {
  const mockFetchConceptMap = mock(() => Promise.resolve(null));

  beforeEach(() => {
    mockFetchConceptMap.mockClear();
  });

  test("throws error when OBX-3 has no code value", async () => {
    const { resolveToLoinc, LoincResolutionError } =
      await import("../../src/code-mapping/concept-map");

    await expect(
      resolveToLoinc(
        { $2_text: "Test without code" }, // Missing $1_code
        { sendingApplication: "TEST", sendingFacility: "FAC" },
        mockFetchConceptMap,
      ),
    ).rejects.toThrow(LoincResolutionError);
  });
});

// ============================================================================
// Unit Tests: buildCodeableConcept
// ============================================================================

describe("buildCodeableConcept", () => {
  test("builds CodeableConcept with LOINC only", async () => {
    const { buildCodeableConcept } =
      await import("../../src/code-mapping/concept-map");

    const result = buildCodeableConcept({
      loinc: {
        code: "2823-3",
        display: "Potassium SerPl-sCnc",
        system: "http://loinc.org",
      },
    });

    expect(result.coding).toHaveLength(1);
    expect(result.coding?.[0]?.code).toBe("2823-3");
    expect(result.coding?.[0]?.system).toBe("http://loinc.org");
    expect(result.text).toBe("Potassium SerPl-sCnc");
  });

  test("builds CodeableConcept with both LOINC and local coding", async () => {
    const { buildCodeableConcept } =
      await import("../../src/code-mapping/concept-map");

    const result = buildCodeableConcept({
      loinc: {
        code: "2823-3",
        display: "Potassium SerPl-sCnc",
        system: "http://loinc.org",
      },
      local: {
        code: "51998",
        display: "Potassium",
        system: "SRL",
      },
    });

    expect(result.coding).toHaveLength(2);
    expect(result.coding?.[0]?.code).toBe("2823-3"); // LOINC first
    expect(result.coding?.[1]?.code).toBe("51998"); // Local second
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("edge cases", () => {
  test("OBX-3.4-6 partially populated (code but no system) - treats as no inline LOINC", async () => {
    const mockFetchConceptMap = mock(() => Promise.resolve(sampleConceptMap));

    const { resolveToLoinc } =
      await import("../../src/code-mapping/concept-map");

    // Has alternate code but no system - should NOT be treated as LOINC
    const result = await resolveToLoinc(
      {
        $1_code: "1230148171",
        $2_text: "JAK2 V617F",
        $3_system: "LABBLRR",
        $4_altCode: "46342-2", // Has code
        $5_altDisplay: "JAK2", // Has display
        // $6_altSystem is missing - NOT LOINC
      },
      { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
      mockFetchConceptMap,
    );

    // Should have called ConceptMap lookup
    expect(mockFetchConceptMap).toHaveBeenCalled();
    expect(result.loinc.code).toBe("46342-2");
  });

  test("OBX-3.6 is not LN - treats as no inline LOINC", async () => {
    const mockFetchConceptMap = mock(() => Promise.resolve(sampleConceptMap));

    const { resolveToLoinc } =
      await import("../../src/code-mapping/concept-map");

    // Alternate system is SCT, not LN
    await resolveToLoinc(
      {
        $1_code: "1230148171",
        $2_text: "JAK2 V617F",
        $3_system: "LABBLRR",
        $4_altCode: "some-code",
        $6_altSystem: "SCT", // SNOMED, not LOINC
      },
      { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
      mockFetchConceptMap,
    );

    // Should have called ConceptMap lookup
    expect(mockFetchConceptMap).toHaveBeenCalled();
  });
});
