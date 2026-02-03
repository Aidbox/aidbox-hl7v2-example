/**
 * Unit tests for observation-code-resolver.ts
 *
 * DESIGN PROTOTYPE: concept-map-refactoring.md
 *
 * TESTS THAT MAY NEED IMPORT UPDATES (when functions move to service.ts):
 * - describe("generateConceptMapId") - function moves to service.ts
 * - describe("translateCode") - function moves to service.ts
 */
import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import * as aidboxModule from "../../../src/aidbox";
import { HttpError } from "../../../src/aidbox";

// ============================================================================
// Test Fixtures
// ============================================================================

// Sample $translate response for successful mapping
const successfulTranslateResponse = {
  resourceType: "Parameters",
  parameter: [
    { name: "result", valueBoolean: true },
    {
      name: "match",
      part: [
        { name: "relationship", valueCode: "equivalent" },
        {
          name: "concept",
          valueCoding: {
            system: "http://loinc.org",
            code: "46342-2",
            display: "JAK2 gene mutation analysis",
          },
        },
      ],
    },
  ],
};

// Sample $translate response when no mapping found
const noMappingTranslateResponse = {
  resourceType: "Parameters",
  parameter: [{ name: "result", valueBoolean: false }],
};

// ============================================================================
// Helper to set up and tear down aidboxFetch spy
// ============================================================================

let aidboxFetchSpy: ReturnType<typeof spyOn>;

function setupAidboxSpy() {
  aidboxFetchSpy = spyOn(aidboxModule, "aidboxFetch");
}

function teardownAidboxSpy() {
  aidboxFetchSpy.mockRestore();
}

// ============================================================================
// Unit Tests: generateConceptMapId
// ============================================================================
// DESIGN PROTOTYPE: Update import path after refactoring
// Function moves to service.ts, import will change to:
// import { generateConceptMapId } from "../../../src/code-mapping/concept-map/service";

describe("generateConceptMapId", () => {
  test("generates correct ID format", async () => {
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const result = generateConceptMapId(
      { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
      "observation-code-loinc",
    );

    expect(result).toBe("hl7v2-epic-uihealth-observation-code-loinc");
  });

  test("handles special characters by converting to kebab-case", async () => {
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const result = generateConceptMapId(
      {
        sendingApplication: "SENdr10",
        sendingFacility: "Sentara Reference Lab Solutions (Epic Beaker)",
      },
      "observation-code-loinc",
    );

    expect(result).toBe(
      "hl7v2-sendr10-sentara-reference-lab-solutions-epic-beaker-observation-code-loinc",
    );
  });

  test("handles uppercase by converting to lowercase", async () => {
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const result = generateConceptMapId(
      { sendingApplication: "LAB_SYSTEM", sendingFacility: "HOSPITAL.ONE" },
      "observation-code-loinc",
    );

    expect(result).toBe("hl7v2-lab-system-hospital-one-observation-code-loinc");
  });

  test("generates obr-status ConceptMap ID when mappingType is obr-status", async () => {
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const result = generateConceptMapId(
      { sendingApplication: "LAB", sendingFacility: "HOSP" },
      "obr-status",
    );

    expect(result).toBe("hl7v2-lab-hosp-obr-status");
  });

  test("generates obx-status ConceptMap ID when mappingType is obx-status", async () => {
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const result = generateConceptMapId(
      { sendingApplication: "LAB", sendingFacility: "HOSP" },
      "obx-status",
    );

    expect(result).toBe("hl7v2-lab-hosp-obx-status");
  });

  test("generates patient-class ConceptMap ID when mappingType is patient-class", async () => {
    const { generateConceptMapId } =
      await import("../../../src/code-mapping/concept-map");

    const result = generateConceptMapId(
      { sendingApplication: "ADT", sendingFacility: "MAIN" },
      "patient-class",
    );

    expect(result).toBe("hl7v2-adt-main-patient-class");
  });
});

// ============================================================================
// Unit Tests: translateCode
// ============================================================================
// DESIGN PROTOTYPE: Update import path after refactoring
// Function moves to service.ts, import will change to:
// import { translateCode } from "../../../src/code-mapping/concept-map/service";

describe("translateCode", () => {
  beforeEach(() => {
    setupAidboxSpy();
  });

  afterEach(() => {
    teardownAidboxSpy();
  });

  test("returns 'found' status with coding when $translate finds mapping", async () => {
    aidboxFetchSpy.mockResolvedValue(successfulTranslateResponse);

    const { translateCode } =
      await import("../../../src/code-mapping/concept-map");

    const result = await translateCode(
      "hl7v2-epic-uihealth-observation-code-loinc",
      "1230148171",
      "LABBLRR",
    );

    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.coding.code).toBe("46342-2");
      expect(result.coding.display).toBe("JAK2 gene mutation analysis");
      expect(result.coding.system).toBe("http://loinc.org");
    }

    expect(aidboxFetchSpy).toHaveBeenCalledWith(
      "/fhir/ConceptMap/hl7v2-epic-uihealth-observation-code-loinc/$translate",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  test("returns 'no_mapping' status when $translate finds no mapping", async () => {
    aidboxFetchSpy.mockResolvedValue(noMappingTranslateResponse);

    const { translateCode } =
      await import("../../../src/code-mapping/concept-map");

    const result = await translateCode(
      "hl7v2-epic-uihealth-observation-code-loinc",
      "UNKNOWN_CODE",
      "LABBLRR",
    );

    expect(result.status).toBe("no_mapping");
  });

  test("returns 'not_found' status when ConceptMap not found (404)", async () => {
    aidboxFetchSpy.mockRejectedValue(new HttpError(404, "Not Found"));

    const { translateCode } =
      await import("../../../src/code-mapping/concept-map");

    const result = await translateCode(
      "nonexistent-conceptmap",
      "CODE",
      "SYSTEM",
    );

    expect(result.status).toBe("not_found");
  });

  test("throws on server error", async () => {
    aidboxFetchSpy.mockRejectedValue(new HttpError(500, "Internal Server Error"));

    const { translateCode } =
      await import("../../../src/code-mapping/concept-map");

    await expect(
      translateCode("concept-map-id", "CODE", "SYSTEM"),
    ).rejects.toThrow("HTTP 500");
  });

  test("sends system parameter when provided", async () => {
    aidboxFetchSpy.mockResolvedValue(noMappingTranslateResponse);

    const { translateCode } =
      await import("../../../src/code-mapping/concept-map");

    await translateCode("map-id", "CODE", "http://example.org/system");

    expect(aidboxFetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = aidboxFetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body.parameter).toContainEqual({
      name: "code",
      valueCode: "CODE",
    });
    expect(body.parameter).toContainEqual({
      name: "system",
      valueUri: "http://example.org/system",
    });
  });

  test("omits system parameter when undefined", async () => {
    aidboxFetchSpy.mockResolvedValue(noMappingTranslateResponse);

    const { translateCode } =
      await import("../../../src/code-mapping/concept-map");

    await translateCode("map-id", "CODE", undefined);

    expect(aidboxFetchSpy).toHaveBeenCalledTimes(1);
    const callArgs = aidboxFetchSpy.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    // Should only have the code parameter, not system
    expect(body.parameter).toHaveLength(1);
    expect(body.parameter[0].name).toBe("code");
  });
});

// ============================================================================
// Unit Tests: resolveToLoinc - Inline LOINC Detection
// ============================================================================

describe("resolveToLoinc - inline LOINC detection", () => {
  beforeEach(() => {
    setupAidboxSpy();
  });

  afterEach(() => {
    teardownAidboxSpy();
  });

  test("returns LOINC from primary coding when system is LN", async () => {
    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "2823-3",
        $2_text: "Potassium SerPl-sCnc",
        $3_system: "LN",
      },
      { sendingApplication: "TEST", sendingFacility: "FAC" },
    );

    expect(result.loinc.code).toBe("2823-3");
    expect(result.loinc.display).toBe("Potassium SerPl-sCnc");
    expect(result.loinc.system).toBe("http://loinc.org");
    expect(result.local).toBeUndefined();
    // Should NOT call aidboxFetch since LOINC is inline
    expect(aidboxFetchSpy).not.toHaveBeenCalled();
  });

  test("returns LOINC from alternate coding when system is LN", async () => {
    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

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
    );

    expect(result.loinc.code).toBe("2823-3");
    expect(result.loinc.display).toBe("Potassium SerPl-sCnc");
    expect(result.loinc.system).toBe("http://loinc.org");
    // Should include local coding as well
    expect(result.local?.code).toBe("51998");
    expect(result.local?.display).toBe("Potassium");
    // Should NOT call aidboxFetch since LOINC is inline
    expect(aidboxFetchSpy).not.toHaveBeenCalled();
  });

  test("handles case-insensitive LN system check", async () => {
    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "2823-3",
        $2_text: "Potassium",
        $3_system: "ln", // lowercase
      },
      { sendingApplication: "TEST", sendingFacility: "FAC" },
    );

    expect(result.loinc.code).toBe("2823-3");
    // Should NOT call aidboxFetch since LOINC is inline
    expect(aidboxFetchSpy).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Unit Tests: resolveToLoinc - ConceptMap Lookup via $translate
// ============================================================================

describe("resolveToLoinc - ConceptMap lookup", () => {
  beforeEach(() => {
    setupAidboxSpy();
  });

  afterEach(() => {
    teardownAidboxSpy();
  });

  test("looks up local code via $translate when no inline LOINC", async () => {
    aidboxFetchSpy.mockResolvedValue(successfulTranslateResponse);

    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

    const result = await resolveToLoinc(
      {
        $1_code: "1230148171",
        $2_text: "JAK2 V617F",
        $3_system: "LABBLRR",
      },
      { sendingApplication: "EPIC", sendingFacility: "UIHEALTH" },
    );

    expect(result.loinc.code).toBe("46342-2");
    expect(result.loinc.display).toBe("JAK2 gene mutation analysis");
    expect(result.local?.code).toBe("1230148171");

    expect(aidboxFetchSpy).toHaveBeenCalledWith(
      "/fhir/ConceptMap/hl7v2-epic-uihealth-observation-code-loinc/$translate",
      expect.anything(),
    );
  });

  test("throws LoincResolutionError with 'No LOINC mapping' message when mapping not found", async () => {
    aidboxFetchSpy.mockResolvedValue(noMappingTranslateResponse);

    const { resolveToLoinc, LoincResolutionError } =
      await import("../../../src/code-mapping/concept-map");

    await expect(
      resolveToLoinc(
        {
          $1_code: "UNMAPPED",
          $2_text: "Unknown Test",
          $3_system: "LOCAL",
        },
        { sendingApplication: "UNKNOWN", sendingFacility: "LAB" },
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
      );
    } catch (error) {
      expect(error).toBeInstanceOf(LoincResolutionError);
      const loincError = error as InstanceType<typeof LoincResolutionError>;
      expect(loincError.localCode).toBe("UNMAPPED");
      expect(loincError.sendingApplication).toBe("UNKNOWN");
      expect(loincError.sendingFacility).toBe("LAB");
      expect(loincError.message).toContain("No LOINC mapping found");
      expect(loincError.message).not.toContain("ConceptMap not found");
    }
  });

  test("throws LoincResolutionError with 'ConceptMap not found' message when 404", async () => {
    aidboxFetchSpy.mockRejectedValue(new HttpError(404, "Not Found"));

    const { resolveToLoinc, LoincResolutionError } =
      await import("../../../src/code-mapping/concept-map");

    try {
      await resolveToLoinc(
        {
          $1_code: "CODE",
          $2_text: "Test",
          $3_system: "SYSTEM",
        },
        { sendingApplication: "APP", sendingFacility: "FAC" },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(LoincResolutionError);
      const loincError = error as InstanceType<typeof LoincResolutionError>;
      expect(loincError.localCode).toBe("CODE");
      expect(loincError.sendingApplication).toBe("APP");
      expect(loincError.sendingFacility).toBe("FAC");
      expect(loincError.message).toContain("ConceptMap not found");
      expect(loincError.message).toContain("hl7v2-app-fac-observation-code-loinc");
      expect(loincError.message).not.toContain("No LOINC mapping found");
    }
  });

  test("propagates server errors from $translate", async () => {
    aidboxFetchSpy.mockRejectedValue(new HttpError(500, "Internal Server Error"));

    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

    await expect(
      resolveToLoinc(
        {
          $1_code: "CODE",
          $2_text: "Test",
          $3_system: "SYSTEM",
        },
        { sendingApplication: "APP", sendingFacility: "FAC" },
      ),
    ).rejects.toThrow("HTTP 500");
  });
});

// ============================================================================
// Unit Tests: resolveToLoinc - Error Cases
// ============================================================================

describe("resolveToLoinc - error cases", () => {
  beforeEach(() => {
    setupAidboxSpy();
  });

  afterEach(() => {
    teardownAidboxSpy();
  });

  test("throws error when OBX-3 has no code value", async () => {
    const { resolveToLoinc, LoincResolutionError } =
      await import("../../../src/code-mapping/concept-map");

    await expect(
      resolveToLoinc(
        { $2_text: "Test without code" }, // Missing $1_code
        { sendingApplication: "TEST", sendingFacility: "FAC" },
      ),
    ).rejects.toThrow(LoincResolutionError);

    // Should not call aidboxFetch - fails before reaching translation
    expect(aidboxFetchSpy).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Unit Tests: buildCodeableConcept
// ============================================================================

describe("buildCodeableConcept", () => {
  test("builds CodeableConcept with LOINC only", async () => {
    const { buildCodeableConcept } =
      await import("../../../src/code-mapping/concept-map");

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
      await import("../../../src/code-mapping/concept-map");

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
  beforeEach(() => {
    setupAidboxSpy();
  });

  afterEach(() => {
    teardownAidboxSpy();
  });

  test("OBX-3.4-6 partially populated (code but no system) - treats as no inline LOINC", async () => {
    aidboxFetchSpy.mockResolvedValue(successfulTranslateResponse);

    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

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
    );

    // Should have called $translate
    expect(aidboxFetchSpy).toHaveBeenCalled();
    expect(result.loinc.code).toBe("46342-2");
  });

  test("OBX-3.6 is not LN - treats as no inline LOINC", async () => {
    aidboxFetchSpy.mockResolvedValue(successfulTranslateResponse);

    const { resolveToLoinc } =
      await import("../../../src/code-mapping/concept-map");

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
    );

    // Should have called $translate
    expect(aidboxFetchSpy).toHaveBeenCalled();
  });
});
