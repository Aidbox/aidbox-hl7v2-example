/**
 * Integration tests for ConceptMap service (src/code-mapping/concept-map/service.ts).
 *
 * Tests listing, filtering, pagination, search, and CRUD operations against a real Aidbox instance.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { aidboxFetch, cleanupTestResources, createTestConceptMapForType } from "../helpers";
import {
  listConceptMaps,
  getMappingsFromConceptMap,
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
} from "../../../src/code-mapping/concept-map/service";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import { MAPPING_TYPES } from "../../../src/code-mapping/mapping-types";

const DUMMY_MAPPING = { localCode: "TEST_CODE", localSystem: "TEST-SYSTEM", targetCode: "target-code", targetDisplay: "Target Code" };

// ============================================================================
// Tests
// ============================================================================

describe("listConceptMaps with type filtering", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("returns all ConceptMaps when filter is 'all'", async () => {
    await createTestConceptMapForType("TEST_APP", "TEST_FACILITY", "observation-code-loinc", [DUMMY_MAPPING]);
    await createTestConceptMapForType("TEST_APP", "TEST_FACILITY", "obr-status", [DUMMY_MAPPING]);
    await createTestConceptMapForType("OTHER_APP", "OTHER_FACILITY", "patient-class", [DUMMY_MAPPING]);

    const result = await listConceptMaps("all");

    expect(result.length).toBe(3);
    expect(result.some(cm => cm.mappingType === "observation-code-loinc")).toBe(true);
    expect(result.some(cm => cm.mappingType === "obr-status")).toBe(true);
    expect(result.some(cm => cm.mappingType === "patient-class")).toBe(true);
  });

  test("filters by observation-code-loinc type", async () => {
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);
    await createTestConceptMapForType("LAB2", "FACILITY2", "observation-code-loinc", [DUMMY_MAPPING]);
    await createTestConceptMapForType("APP1", "FAC1", "obr-status", [DUMMY_MAPPING]);

    const result = await listConceptMaps("observation-code-loinc");

    expect(result.length).toBe(2);
    expect(result.every(cm => cm.mappingType === "observation-code-loinc")).toBe(true);
    expect(result.every(cm => cm.targetSystem === "http://loinc.org")).toBe(true);
  });

  test("filters by patient-class", async () => {
    await createTestConceptMapForType("APP1", "FAC1", "patient-class", [DUMMY_MAPPING]);
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);

    const result = await listConceptMaps("patient-class");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("patient-class");
    expect(result[0]!.targetSystem).toBe("http://terminology.hl7.org/CodeSystem/v3-ActCode");
  });

  test("filters by obr-status", async () => {
    await createTestConceptMapForType("APP1", "FAC1", "obr-status", [DUMMY_MAPPING]);
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);

    const result = await listConceptMaps("obr-status");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("obr-status");
  });

  test("filters by obx-status", async () => {
    await createTestConceptMapForType("APP1", "FAC1", "obx-status", [DUMMY_MAPPING]);
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);

    const result = await listConceptMaps("obx-status");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("obx-status");
  });

  test("excludes ConceptMaps with unknown target systems", async () => {
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);

    // Create a ConceptMap with unknown target system directly
    const unknownConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "cm-unknown-target",
      status: "active",
      title: "Unknown Target",
      targetUri: "http://unknown.system.org/codes",
      group: [
        {
          source: "TEST-SYSTEM",
          target: "http://unknown.system.org/codes",
          element: [
            {
              code: "TEST",
              target: [{ code: "unknown", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };
    await aidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-unknown-target", {
      method: "PUT",
      body: JSON.stringify(unknownConceptMap),
    });

    const result = await listConceptMaps("all");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("observation-code-loinc");
    expect(result.some(cm => cm.id === "cm-unknown-target")).toBe(false);
  });

  test("returns empty result when no ConceptMaps match filter", async () => {
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);

    const result = await listConceptMaps("obr-status");

    expect(result.length).toBe(0);
  });

  test("returns empty result when no ConceptMaps exist", async () => {
    const result = await listConceptMaps("all");

    expect(result.length).toBe(0);
  });

  test("includes mapping type and target system in results", async () => {
    await createTestConceptMapForType("LAB1", "FACILITY1", "observation-code-loinc", [DUMMY_MAPPING]);

    const result = await listConceptMaps("all");

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("hl7v2-lab1-facility1-observation-code-loinc");
    expect(result[0]!.displayName).toBe("LAB1|FACILITY1");
    expect(result[0]!.mappingType).toBe("observation-code-loinc");
    expect(result[0]!.targetSystem).toBe("http://loinc.org");
  });
});

describe("getMappingsFromConceptMap with type detection", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("returns mapping type for LOINC ConceptMap", async () => {
    await createTestConceptMapForType("LAB1", "FAC1", "observation-code-loinc", [
      { localCode: "K_SERUM", localSystem: "TEST-SYSTEM", targetCode: "2823-3", targetDisplay: "Display for 2823-3" },
    ]);

    const result = await getMappingsFromConceptMap("hl7v2-lab1-fac1-observation-code-loinc", 1);

    expect(result.mappingType).toBe("observation-code-loinc");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.targetSystem).toBe("http://loinc.org");
  });

  test("returns mapping type for obr-status ConceptMap", async () => {
    await createTestConceptMapForType("APP1", "FAC1", "obr-status", [
      { localCode: "X", localSystem: "TEST-SYSTEM", targetCode: "final", targetDisplay: "Display for final" },
    ]);

    const result = await getMappingsFromConceptMap("hl7v2-app1-fac1-obr-status", 1);

    expect(result.mappingType).toBe("obr-status");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.targetSystem).toBe("http://hl7.org/fhir/diagnostic-report-status");
  });

  test("returns entry with correct target fields", async () => {
    await createTestConceptMapForType("LAB1", "FAC1", "observation-code-loinc", [
      { localCode: "K_SERUM", localSystem: "TEST-SYSTEM", targetCode: "2823-3", targetDisplay: "Display for 2823-3" },
    ]);

    const result = await getMappingsFromConceptMap("hl7v2-lab1-fac1-observation-code-loinc", 1);

    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.localCode).toBe("K_SERUM");
    expect(result.entries[0]!.targetCode).toBe("2823-3");
    expect(result.entries[0]!.targetDisplay).toBe("Display for 2823-3");
  });
});

describe("getMappingsFromConceptMap - pagination", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("paginates results (50 per page)", async () => {
    const mappings = Array.from({ length: 75 }, (_, i) => ({
      localCode: `CODE_${String(i).padStart(3, "0")}`,
      localSystem: "TEST-SYSTEM",
      targetCode: `${1000 + i}`,
      targetDisplay: `LOINC ${i}`,
    }));

    await createTestConceptMapForType("TEST", "FACILITY", "observation-code-loinc", mappings);

    const page1 = await getMappingsFromConceptMap("hl7v2-test-facility-observation-code-loinc", 1);
    expect(page1.entries).toHaveLength(50);
    expect(page1.total).toBe(75);
    expect(page1.entries[0]!.localCode).toBe("CODE_000");

    const page2 = await getMappingsFromConceptMap("hl7v2-test-facility-observation-code-loinc", 2);
    expect(page2.entries).toHaveLength(25);
    expect(page2.entries[0]!.localCode).toBe("CODE_050");
  });
});

describe("getMappingsFromConceptMap - search", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  async function createSearchTestConceptMap(): Promise<void> {
    const config = MAPPING_TYPES["observation-code-loinc"];
    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "cm-search-test",
      name: "Search Test",
      status: "active",
      title: "TEST|FACILITY",
      sourceUri: "http://example.org/fhir/CodeSystem/cm-search-test",
      targetUri: config.targetSystem,
      group: [{
        source: "TEST-SYSTEM",
        target: config.targetSystem,
        element: [
          {
            code: "K_SERUM",
            display: "Potassium [Serum/Plasma]",
            target: [{ code: "2823-3", display: "Potassium [Moles/volume] in Serum or Plasma", equivalence: "equivalent" }],
          },
          {
            code: "NA_SERUM",
            display: "Sodium [Serum/Plasma]",
            target: [{ code: "2951-2", display: "Sodium [Moles/volume] in Serum or Plasma", equivalence: "equivalent" }],
          },
          {
            code: "GLU_BLOOD",
            display: "Glucose [Blood]",
            target: [{ code: "2345-7", display: "Glucose [Mass/volume] in Serum or Plasma", equivalence: "equivalent" }],
          },
        ],
      }],
    };

    await aidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-search-test", {
      method: "PUT",
      body: JSON.stringify(conceptMap),
    });
  }

  test("filters by local code (partial match)", async () => {
    await createSearchTestConceptMap();

    const result = await getMappingsFromConceptMap("cm-search-test", 1, "GLU_");

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.localCode).toBe("GLU_BLOOD");
  });

  test("filters by local display (partial match)", async () => {
    await createSearchTestConceptMap();

    const result = await getMappingsFromConceptMap("cm-search-test", 1, "Potassium");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.localCode).toBe("K_SERUM");
  });

  test("filters by LOINC code (partial match)", async () => {
    await createSearchTestConceptMap();

    const result = await getMappingsFromConceptMap("cm-search-test", 1, "2345");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.targetCode).toBe("2345-7");
  });

  test("search is case-insensitive", async () => {
    await createSearchTestConceptMap();

    const result = await getMappingsFromConceptMap("cm-search-test", 1, "glucose");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.localCode).toBe("GLU_BLOOD");
  });

  test("returns empty results when no match found", async () => {
    await createSearchTestConceptMap();

    const result = await getMappingsFromConceptMap("cm-search-test", 1, "NONEXISTENT");

    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

describe("addConceptMapEntry - edge cases", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("creates new group when source system not found", async () => {
    await createTestConceptMapForType("APP", "FAC", "observation-code-loinc", [DUMMY_MAPPING]);

    const result = await addConceptMapEntry(
      "hl7v2-app-fac-observation-code-loinc",
      "GLU",
      "Glucose",
      "OTHER-SYSTEM", // Different from TEST-SYSTEM used in createTestConceptMapForType
      "2345-7",
      "Glucose [Mass/volume] in Serum or Plasma",
    );

    expect(result.success).toBe(true);

    // Verify two groups exist
    const conceptMap = await aidboxFetch<ConceptMap>("/fhir/ConceptMap/hl7v2-app-fac-observation-code-loinc");
    expect(conceptMap.group?.length).toBe(2);
    expect(conceptMap.group?.some(g => g.source === "OTHER-SYSTEM")).toBe(true);
  });

  test("detects duplicate code in same system and returns error", async () => {
    await createTestConceptMapForType("APP", "FAC", "observation-code-loinc", [
      { localCode: "K_SERUM", localSystem: "TEST-SYSTEM", targetCode: "2823-3", targetDisplay: "Display for 2823-3" },
    ]);

    const result = await addConceptMapEntry(
      "hl7v2-app-fac-observation-code-loinc",
      "K_SERUM", // Already exists
      "Potassium",
      "TEST-SYSTEM",
      "2823-3",
      "Potassium",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
  });
});

describe("deleteConceptMapEntry - edge cases", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("removes empty group after last entry deleted", async () => {
    // Create ConceptMap with two groups — needs inline construction
    const config = MAPPING_TYPES["observation-code-loinc"];
    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "cm-empty-group-test",
      name: "Empty Group Test",
      status: "active",
      title: "APP|FAC",
      sourceUri: "http://example.org/fhir/CodeSystem/cm-empty-group-test",
      targetUri: config.targetSystem,
      group: [
        {
          source: "SYSTEM-A",
          target: config.targetSystem,
          element: [{ code: "CODE_A", display: "A", target: [{ code: "1111-1", equivalence: "equivalent" }] }],
        },
        {
          source: "SYSTEM-B",
          target: config.targetSystem,
          element: [{ code: "CODE_B", display: "B", target: [{ code: "2222-2", equivalence: "equivalent" }] }],
        },
      ],
    };

    await aidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-empty-group-test", {
      method: "PUT",
      body: JSON.stringify(conceptMap),
    });

    // Delete the only entry in SYSTEM-A
    await deleteConceptMapEntry("cm-empty-group-test", "CODE_A", "SYSTEM-A");

    // Verify SYSTEM-A group was removed
    const updatedConceptMap = await aidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-empty-group-test");
    expect(updatedConceptMap.group?.length).toBe(1);
    expect(updatedConceptMap.group?.[0]?.source).toBe("SYSTEM-B");
  });
});

describe("CRUD operations on type-specific ConceptMaps", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("adds entry to non-LOINC ConceptMap", async () => {
    await createTestConceptMapForType("APP", "FAC", "obr-status", [DUMMY_MAPPING]);

    const result = await addConceptMapEntry(
      "hl7v2-app-fac-obr-status",
      "X",
      "Unknown",
      "http://terminology.hl7.org/CodeSystem/v2-0123",
      "final",
      "Final",
    );

    expect(result.success).toBe(true);

    // Verify the entry was added (note: createTestConceptMapForType includes a dummy TEST_CODE entry)
    const mappings = await getMappingsFromConceptMap("hl7v2-app-fac-obr-status", 1);
    expect(mappings.entries.length).toBe(2);
    const addedEntry = mappings.entries.find(e => e.localCode === "X");
    expect(addedEntry).toBeDefined();
    expect(addedEntry!.targetCode).toBe("final");
  });

  test("updates entry in non-LOINC ConceptMap", async () => {
    await createTestConceptMapForType("APP", "FAC", "obr-status", [
      { localCode: "X", localSystem: "TEST-SYSTEM", targetCode: "final", targetDisplay: "Display for final" },
    ]);

    const result = await updateConceptMapEntry(
      "hl7v2-app-fac-obr-status",
      "X",
      "TEST-SYSTEM",
      "cancelled",
      "Cancelled",
    );

    expect(result.success).toBe(true);

    // Verify the entry was updated
    const mappings = await getMappingsFromConceptMap("hl7v2-app-fac-obr-status", 1);
    expect(mappings.entries.length).toBe(1);
    expect(mappings.entries[0]!.targetCode).toBe("cancelled");
    expect(mappings.entries[0]!.targetDisplay).toBe("Cancelled");
  });

  test("deletes entry from non-LOINC ConceptMap", async () => {
    // Create ConceptMap with two entries — needs inline construction
    const config = MAPPING_TYPES["obr-status"];
    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "cm-obr-delete",
      name: "HL7v2 APP|FAC to obr-status",
      status: "active",
      title: "APP|FAC",
      sourceUri: "http://example.org/fhir/CodeSystem/cm-obr-delete",
      targetUri: config.targetSystem,
      group: [
        {
          source: "TEST-SYSTEM",
          target: config.targetSystem,
          element: [
            {
              code: "X",
              display: "Unknown",
              target: [{ code: "final", display: "Final", equivalence: "equivalent" }],
            },
            {
              code: "Y",
              display: "No result",
              target: [{ code: "cancelled", display: "Cancelled", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };
    await aidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-obr-delete", {
      method: "PUT",
      body: JSON.stringify(conceptMap),
    });

    // Verify entries exist
    let mappings = await getMappingsFromConceptMap("cm-obr-delete", 1);
    expect(mappings.entries.length).toBe(2);

    await deleteConceptMapEntry(
      "cm-obr-delete",
      "X",
      "TEST-SYSTEM",
    );

    // Verify the entry was deleted (one remains)
    mappings = await getMappingsFromConceptMap("cm-obr-delete", 1);
    expect(mappings.entries.length).toBe(1);
    expect(mappings.entries[0]!.localCode).toBe("Y");
  });

  test("LOINC CRUD still works as before", async () => {
    await createTestConceptMapForType("LAB", "FAC", "observation-code-loinc", [DUMMY_MAPPING]);

    const cmId = "hl7v2-lab-fac-observation-code-loinc";

    // Add
    const addResult = await addConceptMapEntry(
      cmId,
      "NA_SERUM",
      "Sodium",
      "ACME-LAB-CODES",
      "2951-2",
      "Sodium [Moles/volume] in Serum or Plasma",
    );
    expect(addResult.success).toBe(true);

    // Verify add (note: createTestConceptMapForType includes a dummy TEST_CODE entry)
    let mappings = await getMappingsFromConceptMap(cmId, 1);
    expect(mappings.entries.length).toBe(2);
    const addedEntry = mappings.entries.find(e => e.localCode === "NA_SERUM");
    expect(addedEntry).toBeDefined();
    expect(addedEntry!.targetCode).toBe("2951-2");
    expect(mappings.mappingType).toBe("observation-code-loinc");

    // Update
    const updateResult = await updateConceptMapEntry(
      cmId,
      "NA_SERUM",
      "ACME-LAB-CODES",
      "2951-2-UPDATED",
      "Updated Display",
    );
    expect(updateResult.success).toBe(true);

    // Verify update (find by localCode since order may vary)
    mappings = await getMappingsFromConceptMap(cmId, 1);
    const updatedEntry = mappings.entries.find(e => e.localCode === "NA_SERUM");
    expect(updatedEntry).toBeDefined();
    expect(updatedEntry!.targetCode).toBe("2951-2-UPDATED");

    // Delete
    await deleteConceptMapEntry(
      cmId,
      "NA_SERUM",
      "ACME-LAB-CODES",
    );

    // Verify delete (note: createTestConceptMapForType includes a dummy TEST_CODE entry that remains)
    mappings = await getMappingsFromConceptMap(cmId, 1);
    expect(mappings.entries.length).toBe(1);
    expect(mappings.entries.find(e => e.localCode === "NA_SERUM")).toBeUndefined();
  });
});
