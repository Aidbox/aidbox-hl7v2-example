/**
 * Tests for ConceptMap Service - pure functions
 *
 * Tests for pure transformation functions that don't require Aidbox:
 * - addMappingToConceptMap
 * - createEmptyConceptMap
 *
 * CRUD operation tests that require Aidbox are in:
 * - test/integration/ui/concept-map-service.integration.test.ts
 */
import { describe, test, expect } from "bun:test";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";


describe("addMappingToConceptMap", () => {
  test("includes source when localSystem is provided", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const emptyConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-concept-map",
      status: "active",
      targetUri: "http://loinc.org",
      group: [],
    };

    const result = addMappingToConceptMap(
      emptyConceptMap,
      "ACME-LAB-CODES",
      "K_SERUM",
      "Potassium",
      "2823-3",
      "Potassium [Moles/volume]",
      "http://loinc.org",
    );

    expect(result.group).toHaveLength(1);
    expect(result.group![0]!.source).toBe("ACME-LAB-CODES");
  });

  test("omits display when localDisplay is empty", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const emptyConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-concept-map",
      status: "active",
      targetUri: "http://loinc.org",
      group: [],
    };

    // When localDisplay is empty (OBX-3 like "GS26-2&rpt^^99DHT" has no display)
    const result = addMappingToConceptMap(
      emptyConceptMap,
      "99DHT",
      "GS26-2&rpt",
      "", // empty localDisplay
      "11529-5",
      "Surgical pathology study",
      "http://loinc.org",
    );

    // The element should NOT have a display property (Aidbox rejects empty strings)
    expect(result.group![0]!.element![0]!.code).toBe("GS26-2&rpt");
    expect(result.group![0]!.element![0]!.display).toBeUndefined();
    expect(result.group![0]!.element![0]!.target![0]!.code).toBe("11529-5");
    expect(result.group![0]!.element![0]!.target![0]!.display).toBe(
      "Surgical pathology study",
    );
  });

  test("omits target display when loincDisplay is empty", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const emptyConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-concept-map",
      status: "active",
      targetUri: "http://loinc.org",
      group: [],
    };

    const result = addMappingToConceptMap(
      emptyConceptMap,
      "99DHT",
      "LOCAL",
      "Local Display",
      "12345-6",
      "", // empty loincDisplay
      "http://loinc.org",
    );

    expect(result.group![0]!.element![0]!.target![0]!.code).toBe("12345-6");
    expect(result.group![0]!.element![0]!.target![0]!.display).toBeUndefined();
  });
});


describe("createEmptyConceptMap with different mapping types", () => {
  test("creates LOINC ConceptMap", async () => {
    const { createEmptyConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const result = createEmptyConceptMap(
      { sendingApplication: "LAB", sendingFacility: "HOSP" },
      "observation-code-loinc",
    );

    expect(result.id).toBe("hl7v2-lab-hosp-observation-code-loinc");
    expect(result.targetUri).toBe("http://loinc.org");
    expect(result.name).toContain("Observation.code");
  });

  test("creates obr-status ConceptMap when specified", async () => {
    const { createEmptyConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const result = createEmptyConceptMap(
      { sendingApplication: "LAB", sendingFacility: "HOSP" },
      "obr-status",
    );

    expect(result.id).toBe("hl7v2-lab-hosp-obr-status");
    expect(result.targetUri).toBe("http://hl7.org/fhir/diagnostic-report-status");
    expect(result.name).toContain("DiagnosticReport.status");
  });

  test("creates patient-class ConceptMap when specified", async () => {
    const { createEmptyConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const result = createEmptyConceptMap(
      { sendingApplication: "ADT", sendingFacility: "MAIN" },
      "patient-class",
    );

    expect(result.id).toBe("hl7v2-adt-main-patient-class");
    expect(result.targetUri).toBe(
      "http://terminology.hl7.org/CodeSystem/v3-ActCode",
    );
    expect(result.name).toContain("Encounter.class");
  });
});

describe("addMappingToConceptMap with different target systems", () => {
  test("uses LOINC target system by default", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const emptyConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-concept-map",
      status: "active",
      targetUri: "http://loinc.org",
      group: [],
    };

    const result = addMappingToConceptMap(
      emptyConceptMap,
      "LOCAL-SYSTEM",
      "LOCAL-CODE",
      "Local Display",
      "2823-3",
      "Potassium",
      "http://loinc.org",
    );

    expect(result.group![0]!.target).toBe("http://loinc.org");
  });

  test("uses diagnostic-report-status target system when specified", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-obr-status",
      status: "active",
      targetUri: "http://hl7.org/fhir/diagnostic-report-status",
      group: [],
    };

    const result = addMappingToConceptMap(
      conceptMap,
      "http://terminology.hl7.org/CodeSystem/v2-0123",
      "Y",
      "No results available",
      "cancelled",
      "Cancelled",
      "http://hl7.org/fhir/diagnostic-report-status",
    );

    expect(result.group![0]!.target).toBe(
      "http://hl7.org/fhir/diagnostic-report-status",
    );
    expect(result.group![0]!.element![0]!.code).toBe("Y");
    expect(result.group![0]!.element![0]!.target![0]!.code).toBe("cancelled");
  });

  test("creates separate groups for same source with different target systems", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-mixed-targets",
      status: "active",
      targetUri: "http://loinc.org",
      group: [],
    };

    // First, add a LOINC mapping
    const afterFirstMapping = addMappingToConceptMap(
      conceptMap,
      "LOCAL-SYSTEM",
      "CODE1",
      "Code 1",
      "2823-3",
      "Potassium",
      "http://loinc.org",
    );

    expect(afterFirstMapping.group).toHaveLength(1);
    expect(afterFirstMapping.group![0]!.target).toBe("http://loinc.org");

    // Now add a mapping with different target system
    const afterSecondMapping = addMappingToConceptMap(
      afterFirstMapping,
      "LOCAL-SYSTEM",
      "CODE2",
      "Code 2",
      "final",
      "Final",
      "http://hl7.org/fhir/diagnostic-report-status",
    );

    // Should create a SEPARATE group for the different target system
    expect(afterSecondMapping.group).toHaveLength(2);

    // First group should have LOINC target
    const loincGroup = afterSecondMapping.group!.find(
      (g) => g.target === "http://loinc.org",
    );
    expect(loincGroup).toBeDefined();
    expect(loincGroup!.source).toBe("LOCAL-SYSTEM");
    expect(loincGroup!.element).toHaveLength(1);
    expect(loincGroup!.element![0]!.code).toBe("CODE1");

    // Second group should have diagnostic-report-status target
    const statusGroup = afterSecondMapping.group!.find(
      (g) => g.target === "http://hl7.org/fhir/diagnostic-report-status",
    );
    expect(statusGroup).toBeDefined();
    expect(statusGroup!.source).toBe("LOCAL-SYSTEM");
    expect(statusGroup!.element).toHaveLength(1);
    expect(statusGroup!.element![0]!.code).toBe("CODE2");
  });
});
