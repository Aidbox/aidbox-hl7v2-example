import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getOrCreateConceptMap } =
      await import("../../../src/code-mapping/concept-map");

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getOrCreateConceptMap } =
      await import("../../../src/code-mapping/concept-map");

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addMapping } = await import("../../../src/code-mapping/concept-map");

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addMapping } = await import("../../../src/code-mapping/concept-map");

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addMapping } = await import("../../../src/code-mapping/concept-map");

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { deleteMapping } =
      await import("../../../src/code-mapping/concept-map");

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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { deleteMapping } =
      await import("../../../src/code-mapping/concept-map");

    await deleteMapping(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      "NONEXISTENT",
      "ACME-LAB-CODES",
    );

    expect(mockAidbox.putResource).toHaveBeenCalled();
  });
});

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
    );

    expect(result.group![0]!.element![0]!.target![0]!.code).toBe("12345-6");
    expect(result.group![0]!.element![0]!.target![0]!.display).toBeUndefined();
  });
});

describe("searchMappings", () => {
  test("returns all mappings when no query specified", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.resolve(sampleConceptMap)),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../../src/code-mapping/concept-map");

    const results = await searchMappings({
      sendingApplication: "ACME_LAB",
      sendingFacility: "ACME_HOSP",
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.code).toBe("K_SERUM");
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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../../src/code-mapping/concept-map");

    const results = await searchMappings(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      { localCode: "K_SERUM" },
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.code).toBe("K_SERUM");
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

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../../src/code-mapping/concept-map");

    const results = await searchMappings(
      { sendingApplication: "ACME_LAB", sendingFacility: "ACME_HOSP" },
      { loincCode: "2951-2" },
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.code).toBe("NA_SERUM");
  });

  test("returns empty array when ConceptMap not found", async () => {
    const mockAidbox = {
      aidboxFetch: mock(() => Promise.reject(new Error("HTTP 404: Not Found"))),
    };

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { searchMappings } =
      await import("../../../src/code-mapping/concept-map");

    const results = await searchMappings({
      sendingApplication: "NONEXISTENT",
      sendingFacility: "LAB",
    });

    expect(results).toHaveLength(0);
  });
});

describe("createEmptyConceptMap with different mapping types", () => {
  test("creates LOINC ConceptMap by default", async () => {
    const { createEmptyConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const result = createEmptyConceptMap({
      sendingApplication: "LAB",
      sendingFacility: "HOSP",
    });

    expect(result.id).toBe("hl7v2-lab-hosp-to-loinc");
    expect(result.targetUri).toBe("http://loinc.org");
    expect(result.name).toContain("Observation.code");
  });

  test("creates address-type ConceptMap when specified", async () => {
    const { createEmptyConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const result = createEmptyConceptMap(
      { sendingApplication: "ADT", sendingFacility: "MAIN" },
      "address-type",
    );

    expect(result.id).toBe("hl7v2-adt-main-to-address-type");
    expect(result.targetUri).toBe("http://hl7.org/fhir/address-type");
    expect(result.name).toContain("Address.type");
  });

  test("creates obr-status ConceptMap when specified", async () => {
    const { createEmptyConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const result = createEmptyConceptMap(
      { sendingApplication: "LAB", sendingFacility: "HOSP" },
      "obr-status",
    );

    expect(result.id).toBe("hl7v2-lab-hosp-to-diagnostic-report-status");
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

    expect(result.id).toBe("hl7v2-adt-main-to-encounter-class");
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
    );

    expect(result.group![0]!.target).toBe("http://loinc.org");
  });

  test("uses address-type target system when specified", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-address-type",
      status: "active",
      targetUri: "http://hl7.org/fhir/address-type",
      group: [],
    };

    const result = addMappingToConceptMap(
      conceptMap,
      "http://terminology.hl7.org/CodeSystem/v2-0190",
      "P",
      "Permanent",
      "physical",
      "Physical",
      "http://hl7.org/fhir/address-type",
    );

    expect(result.group![0]!.target).toBe("http://hl7.org/fhir/address-type");
    expect(result.group![0]!.element![0]!.code).toBe("P");
    expect(result.group![0]!.element![0]!.target![0]!.code).toBe("physical");
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

  test("creates separate groups for same source with different target systems (address-type vs address-use)", async () => {
    const { addMappingToConceptMap } = await import(
      "../../../src/code-mapping/concept-map"
    );

    const conceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "test-address-mixed",
      status: "active",
      targetUri: "http://hl7.org/fhir/address-type",
      group: [],
    };

    // First, add an address-type mapping (physical)
    const afterFirstMapping = addMappingToConceptMap(
      conceptMap,
      "http://terminology.hl7.org/CodeSystem/v2-0190",
      "L",
      "Legal Address",
      "physical",
      "Physical",
      "http://hl7.org/fhir/address-type",
    );

    expect(afterFirstMapping.group).toHaveLength(1);
    expect(afterFirstMapping.group![0]!.target).toBe(
      "http://hl7.org/fhir/address-type",
    );

    // Now add an address-use mapping (home) from the SAME source system but DIFFERENT target system
    const afterSecondMapping = addMappingToConceptMap(
      afterFirstMapping,
      "http://terminology.hl7.org/CodeSystem/v2-0190",
      "H",
      "Home Address",
      "home",
      "Home",
      "http://hl7.org/fhir/address-use",
    );

    // Should create a SEPARATE group for the different target system
    expect(afterSecondMapping.group).toHaveLength(2);

    // First group should have address-type target
    const typeGroup = afterSecondMapping.group!.find(
      (g) => g.target === "http://hl7.org/fhir/address-type",
    );
    expect(typeGroup).toBeDefined();
    expect(typeGroup!.source).toBe(
      "http://terminology.hl7.org/CodeSystem/v2-0190",
    );
    expect(typeGroup!.element).toHaveLength(1);
    expect(typeGroup!.element![0]!.code).toBe("L");

    // Second group should have address-use target
    const useGroup = afterSecondMapping.group!.find(
      (g) => g.target === "http://hl7.org/fhir/address-use",
    );
    expect(useGroup).toBeDefined();
    expect(useGroup!.source).toBe(
      "http://terminology.hl7.org/CodeSystem/v2-0190",
    );
    expect(useGroup!.element).toHaveLength(1);
    expect(useGroup!.element![0]!.code).toBe("H");
  });
});
