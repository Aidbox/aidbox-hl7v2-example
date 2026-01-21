import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { ConceptMap } from "../../src/fhir/hl7-fhir-r4-core/ConceptMap";

const sampleConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-acme-lab-acme-hosp-to-loinc",
  name: "HL7v2 ACME_LAB/ACME_HOSP to LOINC",
  status: "active",
  sourceUri: "http://example.org/fhir/CodeSystem/hl7v2-acme-lab-acme-hosp",
  targetUri: "http://loinc.org",
  group: [
    {
      source: "ACME-LAB-CODES",
      target: "http://loinc.org",
      element: [
        {
          code: "K_SERUM",
          display: "Potassium [Serum/Plasma]",
          target: [
            {
              code: "2823-3",
              display: "Potassium [Moles/volume] in Serum or Plasma",
              equivalence: "equivalent",
            },
          ],
        },
      ],
    },
  ],
};

describe("getOrCreateConceptMap", () => {
  test("returns existing ConceptMap when found", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(sampleConceptMap)),
      putResource: mock(() => Promise.resolve(sampleConceptMap)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { getOrCreateConceptMap } =
      await import("../../src/code-mapping/concept-map");

    const result = await getOrCreateConceptMap({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });

    expect(result.id).toBe("hl7v2-acme-lab-acme-hosp-to-loinc");
    expect(mockAidbox.aidboxFetch).toHaveBeenCalledWith(
      "/fhir/ConceptMap/hl7v2-acme-lab-acme-hosp-to-loinc",
    );
    expect(mockAidbox.putResource).not.toHaveBeenCalled();
  });

  test("creates new ConceptMap when not found", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("HTTP 404: Not Found"))),
      putResource: mock(
        (resourceType: string, id: string, resource: ConceptMap) =>
          Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { getOrCreateConceptMap } =
      await import("../../src/code-mapping/concept-map");

    const result = await getOrCreateConceptMap({
      sendingApplication: "NEW_LAB",
      sendingFacility: "NEW_HOSP",
    });

    expect(result.resourceType).toBe("ConceptMap");
    expect(result.id).toBe("hl7v2-new-lab-new-hosp-to-loinc");
    expect(result.status).toBe("active");
    expect(result.targetUri).toBe("http://loinc.org");
    expect(mockAidbox.putResource).toHaveBeenCalledWith(
      "ConceptMap",
      "hl7v2-new-lab-new-hosp-to-loinc",
      expect.objectContaining({
        resourceType: "ConceptMap",
        status: "active",
      }),
    );
  });
});

describe("addMapping", () => {
  test("adds mapping to existing group with matching source system", async () => {
    let savedConceptMap: ConceptMap | null = null;
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve(structuredClone(sampleConceptMap)),
      ),
      putResource: mock(
        (resourceType: string, id: string, resource: ConceptMap) => {
          savedConceptMap = resource;
          return Promise.resolve(resource);
        },
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { addMapping } = await import("../../src/code-mapping/concept-map");

    await addMapping(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "NA_SERUM",
      "ACME-LAB-CODES",
      "Sodium [Serum/Plasma]",
      "2951-2",
      "Sodium [Moles/volume] in Serum or Plasma",
    );

    expect(savedConceptMap).not.toBeNull();
    const group = savedConceptMap!.group?.find(
      (g) => g.source === "ACME-LAB-CODES",
    );
    expect(group?.element).toHaveLength(2);

    const newElement = group?.element?.find((e) => e.code === "NA_SERUM");
    expect(newElement?.display).toBe("Sodium [Serum/Plasma]");
    expect(newElement?.target?.[0]?.code).toBe("2951-2");
    expect(newElement?.target?.[0]?.display).toBe(
      "Sodium [Moles/volume] in Serum or Plasma",
    );
  });

  test("creates new group when source system doesn't exist", async () => {
    let savedConceptMap: ConceptMap | null = null;
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve(structuredClone(sampleConceptMap)),
      ),
      putResource: mock(
        (resourceType: string, id: string, resource: ConceptMap) => {
          savedConceptMap = resource;
          return Promise.resolve(resource);
        },
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { addMapping } = await import("../../src/code-mapping/concept-map");

    await addMapping(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "GLU",
      "OTHER-SYSTEM",
      "Glucose",
      "2345-7",
      "Glucose [Mass/volume] in Serum or Plasma",
    );

    expect(savedConceptMap!.group).toHaveLength(2);
    const newGroup = savedConceptMap!.group?.find(
      (g) => g.source === "OTHER-SYSTEM",
    );
    expect(newGroup?.target).toBe("http://loinc.org");
    expect(newGroup?.element?.[0]?.code).toBe("GLU");
  });

  test("updates existing mapping when code already exists", async () => {
    let savedConceptMap: ConceptMap | null = null;
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve(structuredClone(sampleConceptMap)),
      ),
      putResource: mock(
        (resourceType: string, id: string, resource: ConceptMap) => {
          savedConceptMap = resource;
          return Promise.resolve(resource);
        },
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { addMapping } = await import("../../src/code-mapping/concept-map");

    await addMapping(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "K_SERUM",
      "ACME-LAB-CODES",
      "Potassium Updated",
      "2823-3",
      "Potassium Updated Display",
    );

    const group = savedConceptMap!.group?.find(
      (g) => g.source === "ACME-LAB-CODES",
    );
    expect(group?.element).toHaveLength(1);
    expect(group?.element?.[0]?.display).toBe("Potassium Updated");
    expect(group?.element?.[0]?.target?.[0]?.display).toBe(
      "Potassium Updated Display",
    );
  });
});

describe("deleteMapping", () => {
  test("removes mapping from ConceptMap", async () => {
    let savedConceptMap: ConceptMap | null = null;
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve(structuredClone(sampleConceptMap)),
      ),
      putResource: mock(
        (resourceType: string, id: string, resource: ConceptMap) => {
          savedConceptMap = resource;
          return Promise.resolve(resource);
        },
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { deleteMapping } =
      await import("../../src/code-mapping/concept-map");

    await deleteMapping(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "K_SERUM",
      "ACME-LAB-CODES",
    );

    const group = savedConceptMap!.group?.find(
      (g) => g.source === "ACME-LAB-CODES",
    );
    expect(group?.element).toHaveLength(0);
  });

  test("does nothing when mapping doesn't exist", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() =>
        Promise.resolve(structuredClone(sampleConceptMap)),
      ),
      putResource: mock(
        (resourceType: string, id: string, resource: ConceptMap) =>
          Promise.resolve(resource),
      ),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { deleteMapping } =
      await import("../../src/code-mapping/concept-map");

    await deleteMapping(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "NONEXISTENT",
      "ACME-LAB-CODES",
    );

    expect(mockAidbox.putResource).toHaveBeenCalled();
  });
});

describe("addMappingToConceptMap", () => {
  test("omits source when localSystem is undefined", async () => {
    // Import the function directly for pure function testing
    const { addMappingToConceptMap } = await import(
      "../../src/code-mapping/concept-map"
    );

    const emptyConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-concept-map",
      status: "active",
      targetUri: "http://loinc.org",
      group: [],
    };

    // When localSystem is undefined (OBX-3 like "BFTYPE^BF Type" has no third component)
    const result = addMappingToConceptMap(
      emptyConceptMap,
      undefined, // localSystem is undefined
      "BFTYPE",
      "BF Type",
      "12345-6",
      "Body Fluid Type",
    );

    // The group should NOT have a source property (Aidbox rejects empty strings)
    expect(result.group).toHaveLength(1);
    expect(result.group![0].source).toBeUndefined();
    expect(result.group![0].target).toBe("http://loinc.org");
    expect(result.group![0].element).toHaveLength(1);
    expect(result.group![0].element![0].code).toBe("BFTYPE");
  });

  test("includes source when localSystem is provided", async () => {
    const { addMappingToConceptMap } = await import(
      "../../src/code-mapping/concept-map"
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
    );

    expect(result.group).toHaveLength(1);
    expect(result.group![0].source).toBe("ACME-LAB-CODES");
  });

  test("omits display when localDisplay is empty", async () => {
    const { addMappingToConceptMap } = await import(
      "../../src/code-mapping/concept-map"
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
    );

    // The element should NOT have a display property (Aidbox rejects empty strings)
    expect(result.group![0].element![0].code).toBe("GS26-2&rpt");
    expect(result.group![0].element![0].display).toBeUndefined();
    expect(result.group![0].element![0].target![0].code).toBe("11529-5");
    expect(result.group![0].element![0].target![0].display).toBe(
      "Surgical pathology study",
    );
  });

  test("omits target display when loincDisplay is empty", async () => {
    const { addMappingToConceptMap } = await import(
      "../../src/code-mapping/concept-map"
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
    );

    expect(result.group![0].element![0].target![0].code).toBe("12345-6");
    expect(result.group![0].element![0].target![0].display).toBeUndefined();
  });

  test("finds existing group with undefined source", async () => {
    const { addMappingToConceptMap } = await import(
      "../../src/code-mapping/concept-map"
    );

    const conceptMapWithUndefinedSource: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-concept-map",
      status: "active",
      targetUri: "http://loinc.org",
      group: [
        {
          // No source property - for codes without system
          target: "http://loinc.org",
          element: [
            {
              code: "BFTYPE",
              display: "BF Type",
              target: [{ code: "12345-6", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    // Add another code without system - should go into the same group
    const result = addMappingToConceptMap(
      conceptMapWithUndefinedSource,
      undefined,
      "PH-O",
      "pH BF",
      "2746-6",
      "pH of Body fluid",
    );

    // Should still have just one group
    expect(result.group).toHaveLength(1);
    expect(result.group![0].source).toBeUndefined();
    // Should have both elements
    expect(result.group![0].element).toHaveLength(2);
  });
});

describe("searchMappings", () => {
  test("returns all mappings when no query specified", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(sampleConceptMap)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../src/code-mapping/concept-map");

    const results = await searchMappings({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });

    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("K_SERUM");
  });

  test("filters by local code", async () => {
    const conceptMapWithMultipleMappings: ConceptMap = {
      ...sampleConceptMap,
      group: [
        {
          source: "ACME-LAB-CODES",
          target: "http://loinc.org",
          element: [
            {
              code: "K_SERUM",
              display: "Potassium",
              target: [{ code: "2823-3", equivalence: "equivalent" }],
            },
            {
              code: "NA_SERUM",
              display: "Sodium",
              target: [{ code: "2951-2", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(conceptMapWithMultipleMappings)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../src/code-mapping/concept-map");

    const results = await searchMappings(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      { localCode: "K_SERUM" },
    );

    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("K_SERUM");
  });

  test("filters by LOINC code", async () => {
    const conceptMapWithMultipleMappings: ConceptMap = {
      ...sampleConceptMap,
      group: [
        {
          source: "ACME-LAB-CODES",
          target: "http://loinc.org",
          element: [
            {
              code: "K_SERUM",
              display: "Potassium",
              target: [{ code: "2823-3", equivalence: "equivalent" }],
            },
            {
              code: "NA_SERUM",
              display: "Sodium",
              target: [{ code: "2951-2", equivalence: "equivalent" }],
            },
          ],
        },
      ],
    };

    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(conceptMapWithMultipleMappings)),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../src/code-mapping/concept-map");

    const results = await searchMappings(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      { loincCode: "2951-2" },
    );

    expect(results).toHaveLength(1);
    expect(results[0].code).toBe("NA_SERUM");
  });

  test("returns empty array when ConceptMap not found", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("HTTP 404: Not Found"))),
    };

    mock.module("../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../src/code-mapping/concept-map");

    const results = await searchMappings({
      sendingApplication: "NONEXISTENT",
      sendingFacility: "LAB",
    });

    expect(results).toHaveLength(0);
  });
});
