/**
 * Integration tests for Code Mappings UI type filtering.
 *
 * Tests listConceptMaps() function with type filtering against a real Aidbox instance.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { testAidboxFetch, cleanupTestResources } from "../helpers";
import {
  listConceptMaps,
  getMappingsFromConceptMap,
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
  type MappingTypeFilter,
} from "../../../src/ui/pages/code-mappings";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import { MAPPING_TYPES, type MappingTypeName } from "../../../src/code-mapping/mapping-types";

// ============================================================================
// Test Helpers
// ============================================================================

async function createConceptMap(
  id: string,
  mappingType: MappingTypeName,
  title: string,
): Promise<ConceptMap> {
  const config = MAPPING_TYPES[mappingType];
  const conceptMap: ConceptMap = {
    resourceType: "ConceptMap",
    id,
    name: `HL7v2 ${title} to ${config.targetField}`,
    status: "active",
    title,
    sourceUri: `http://example.org/fhir/CodeSystem/${id}`,
    targetUri: config.targetSystem,
    // Note: Aidbox doesn't allow empty group arrays, so we include a minimal mapping
    group: [
      {
        source: "TEST-SYSTEM",
        target: config.targetSystem,
        element: [
          {
            code: "TEST_CODE",
            display: "Test Code",
            target: [
              {
                code: "target-code",
                display: "Target Code",
                equivalence: "equivalent",
              },
            ],
          },
        ],
      },
    ],
  };

  return testAidboxFetch<ConceptMap>(`/fhir/ConceptMap/${id}`, {
    method: "PUT",
    body: JSON.stringify(conceptMap),
  });
}

async function createConceptMapWithEntry(
  id: string,
  mappingType: MappingTypeName,
  title: string,
  localCode: string,
  targetCode: string,
): Promise<ConceptMap> {
  const config = MAPPING_TYPES[mappingType];
  const conceptMap: ConceptMap = {
    resourceType: "ConceptMap",
    id,
    name: `HL7v2 ${title} to ${config.targetField}`,
    status: "active",
    title,
    sourceUri: `http://example.org/fhir/CodeSystem/${id}`,
    targetUri: config.targetSystem,
    group: [
      {
        source: "TEST-SYSTEM",
        target: config.targetSystem,
        element: [
          {
            code: localCode,
            display: `Display for ${localCode}`,
            target: [
              {
                code: targetCode,
                display: `Display for ${targetCode}`,
                equivalence: "equivalent",
              },
            ],
          },
        ],
      },
    ],
  };

  return testAidboxFetch<ConceptMap>(`/fhir/ConceptMap/${id}`, {
    method: "PUT",
    body: JSON.stringify(conceptMap),
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("listConceptMaps with type filtering", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("returns all ConceptMaps when filter is 'all'", async () => {
    // Create ConceptMaps of different types
    await createConceptMap("cm-loinc-test", "loinc", "TEST_APP|TEST_FACILITY");
    await createConceptMap("cm-address-test", "address-type", "TEST_APP|TEST_FACILITY");
    await createConceptMap("cm-patient-class-test", "patient-class", "OTHER_APP|OTHER_FACILITY");

    const result = await listConceptMaps("all");

    expect(result.length).toBe(3);
    expect(result.some(cm => cm.mappingType === "loinc")).toBe(true);
    expect(result.some(cm => cm.mappingType === "address-type")).toBe(true);
    expect(result.some(cm => cm.mappingType === "patient-class")).toBe(true);
  });

  test("filters by loinc type", async () => {
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");
    await createConceptMap("cm-loinc-2", "loinc", "LAB2|FACILITY2");
    await createConceptMap("cm-address-1", "address-type", "APP1|FAC1");

    const result = await listConceptMaps("loinc");

    expect(result.length).toBe(2);
    expect(result.every(cm => cm.mappingType === "loinc")).toBe(true);
    expect(result.every(cm => cm.targetSystem === "http://loinc.org")).toBe(true);
  });

  test("filters by address-type", async () => {
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");
    await createConceptMap("cm-address-1", "address-type", "APP1|FAC1");
    await createConceptMap("cm-address-2", "address-type", "APP2|FAC2");

    const result = await listConceptMaps("address-type");

    expect(result.length).toBe(2);
    expect(result.every(cm => cm.mappingType === "address-type")).toBe(true);
    expect(result.every(cm => cm.targetSystem === "http://hl7.org/fhir/address-type")).toBe(true);
  });

  test("filters by patient-class", async () => {
    await createConceptMap("cm-patient-1", "patient-class", "APP1|FAC1");
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");

    const result = await listConceptMaps("patient-class");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("patient-class");
    expect(result[0]!.targetSystem).toBe("http://terminology.hl7.org/CodeSystem/v3-ActCode");
  });

  test("filters by obr-status", async () => {
    await createConceptMap("cm-obr-1", "obr-status", "APP1|FAC1");
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");

    const result = await listConceptMaps("obr-status");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("obr-status");
  });

  test("filters by obx-status", async () => {
    await createConceptMap("cm-obx-1", "obx-status", "APP1|FAC1");
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");

    const result = await listConceptMaps("obx-status");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("obx-status");
  });

  test("excludes ConceptMaps with unknown target systems", async () => {
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");

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
    await testAidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-unknown-target", {
      method: "PUT",
      body: JSON.stringify(unknownConceptMap),
    });

    const result = await listConceptMaps("all");

    expect(result.length).toBe(1);
    expect(result[0]!.mappingType).toBe("loinc");
    expect(result.some(cm => cm.id === "cm-unknown-target")).toBe(false);
  });

  test("returns empty result when no ConceptMaps match filter", async () => {
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");

    const result = await listConceptMaps("address-type");

    expect(result.length).toBe(0);
  });

  test("returns empty result when no ConceptMaps exist", async () => {
    const result = await listConceptMaps("all");

    expect(result.length).toBe(0);
  });

  test("includes mapping type and target system in results", async () => {
    await createConceptMap("cm-loinc-1", "loinc", "LAB1|FACILITY1");

    const result = await listConceptMaps("all");

    expect(result.length).toBe(1);
    expect(result[0]!.id).toBe("cm-loinc-1");
    expect(result[0]!.displayName).toBe("LAB1|FACILITY1");
    expect(result[0]!.mappingType).toBe("loinc");
    expect(result[0]!.targetSystem).toBe("http://loinc.org");
  });
});

describe("getMappingsFromConceptMap with type detection", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("returns mapping type for LOINC ConceptMap", async () => {
    await createConceptMapWithEntry("cm-loinc-1", "loinc", "LAB1|FAC1", "K_SERUM", "2823-3");

    const result = await getMappingsFromConceptMap("cm-loinc-1", 1);

    expect(result.mappingType).toBe("loinc");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.targetSystem).toBe("http://loinc.org");
  });

  test("returns mapping type for address-type ConceptMap", async () => {
    await createConceptMapWithEntry("cm-address-1", "address-type", "APP1|FAC1", "H", "physical");

    const result = await getMappingsFromConceptMap("cm-address-1", 1);

    expect(result.mappingType).toBe("address-type");
    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.targetSystem).toBe("http://hl7.org/fhir/address-type");
  });

  test("returns entry with correct target fields", async () => {
    await createConceptMapWithEntry("cm-loinc-1", "loinc", "LAB1|FAC1", "K_SERUM", "2823-3");

    const result = await getMappingsFromConceptMap("cm-loinc-1", 1);

    expect(result.entries.length).toBe(1);
    expect(result.entries[0]!.localCode).toBe("K_SERUM");
    expect(result.entries[0]!.targetCode).toBe("2823-3");
    expect(result.entries[0]!.targetDisplay).toBe("Display for 2823-3");
  });
});

describe("CRUD operations on type-specific ConceptMaps", () => {
  beforeEach(async () => {
    await cleanupTestResources();
  });

  test("adds entry to non-LOINC ConceptMap", async () => {
    await createConceptMap("cm-address-crud", "address-type", "APP|FAC");

    const result = await addConceptMapEntry(
      "cm-address-crud",
      "B",
      "Business",
      "http://terminology.hl7.org/CodeSystem/v2-0190",
      "physical",
      "Physical",
    );

    expect(result.success).toBe(true);

    // Verify the entry was added (note: createConceptMap includes a dummy TEST_CODE entry)
    const mappings = await getMappingsFromConceptMap("cm-address-crud", 1);
    expect(mappings.entries.length).toBe(2);
    const addedEntry = mappings.entries.find(e => e.localCode === "B");
    expect(addedEntry).toBeDefined();
    expect(addedEntry!.targetCode).toBe("physical");
  });

  test("updates entry in non-LOINC ConceptMap", async () => {
    await createConceptMapWithEntry("cm-address-update", "address-type", "APP|FAC", "H", "physical");

    const result = await updateConceptMapEntry(
      "cm-address-update",
      "H",
      "TEST-SYSTEM",
      "postal",
      "Postal",
    );

    expect(result.success).toBe(true);

    // Verify the entry was updated
    const mappings = await getMappingsFromConceptMap("cm-address-update", 1);
    expect(mappings.entries.length).toBe(1);
    expect(mappings.entries[0]!.targetCode).toBe("postal");
    expect(mappings.entries[0]!.targetDisplay).toBe("Postal");
  });

  test("deletes entry from non-LOINC ConceptMap", async () => {
    // Create ConceptMap with two entries so we can delete one and still have a valid ConceptMap
    const config = MAPPING_TYPES["address-type"];
    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "cm-address-delete",
      name: "HL7v2 APP|FAC to address-type",
      status: "active",
      title: "APP|FAC",
      sourceUri: "http://example.org/fhir/CodeSystem/cm-address-delete",
      targetUri: config.targetSystem,
      group: [
        {
          source: "TEST-SYSTEM",
          target: config.targetSystem,
          element: [
            {
              code: "H",
              display: "Home",
              target: [{ code: "physical", display: "Physical", equivalence: "equivalent" }],
            },
            {
              code: "W",
              display: "Work",
              target: [{ code: "postal", display: "Postal", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };
    await testAidboxFetch<ConceptMap>("/fhir/ConceptMap/cm-address-delete", {
      method: "PUT",
      body: JSON.stringify(conceptMap),
    });

    // Verify entries exist
    let mappings = await getMappingsFromConceptMap("cm-address-delete", 1);
    expect(mappings.entries.length).toBe(2);

    await deleteConceptMapEntry(
      "cm-address-delete",
      "H",
      "TEST-SYSTEM",
    );

    // Verify the entry was deleted (one remains)
    mappings = await getMappingsFromConceptMap("cm-address-delete", 1);
    expect(mappings.entries.length).toBe(1);
    expect(mappings.entries[0]!.localCode).toBe("W");
  });

  test("LOINC CRUD still works as before", async () => {
    await createConceptMap("cm-loinc-crud", "loinc", "LAB|FAC");

    // Add
    const addResult = await addConceptMapEntry(
      "cm-loinc-crud",
      "NA_SERUM",
      "Sodium",
      "ACME-LAB-CODES",
      "2951-2",
      "Sodium [Moles/volume] in Serum or Plasma",
    );
    expect(addResult.success).toBe(true);

    // Verify add (note: createConceptMap includes a dummy TEST_CODE entry)
    let mappings = await getMappingsFromConceptMap("cm-loinc-crud", 1);
    expect(mappings.entries.length).toBe(2);
    const addedEntry = mappings.entries.find(e => e.localCode === "NA_SERUM");
    expect(addedEntry).toBeDefined();
    expect(addedEntry!.targetCode).toBe("2951-2");
    expect(mappings.mappingType).toBe("loinc");

    // Update
    const updateResult = await updateConceptMapEntry(
      "cm-loinc-crud",
      "NA_SERUM",
      "ACME-LAB-CODES",
      "2951-2-UPDATED",
      "Updated Display",
    );
    expect(updateResult.success).toBe(true);

    // Verify update (find by localCode since order may vary)
    mappings = await getMappingsFromConceptMap("cm-loinc-crud", 1);
    const updatedEntry = mappings.entries.find(e => e.localCode === "NA_SERUM");
    expect(updatedEntry).toBeDefined();
    expect(updatedEntry!.targetCode).toBe("2951-2-UPDATED");

    // Delete
    await deleteConceptMapEntry(
      "cm-loinc-crud",
      "NA_SERUM",
      "ACME-LAB-CODES",
    );

    // Verify delete (note: createConceptMap includes a dummy TEST_CODE entry that remains)
    mappings = await getMappingsFromConceptMap("cm-loinc-crud", 1);
    expect(mappings.entries.length).toBe(1);
    expect(mappings.entries.find(e => e.localCode === "NA_SERUM")).toBeUndefined();
  });
});
