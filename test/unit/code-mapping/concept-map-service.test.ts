/**
 * Tests for ConceptMap Service - CRUD operations
 *
 * Tests for service layer functions that manage ConceptMaps:
 * - listConceptMaps
 * - getMappingsFromConceptMap
 * - addConceptMapEntry
 * - updateConceptMapEntry
 * - deleteConceptMapEntry
 * - detectMappingTypeFromConceptMap
 */
import { describe, test, expect, beforeEach, mock, afterEach } from "bun:test";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";
import type { Task } from "../../../src/fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../../../src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message";

interface Bundle<T> {
  total?: number;
  entry?: Array<{ resource: T }>;
}

const sampleConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
  name: "HL7v2 ACME_LAB/ACME_HOSP to LOINC",
  status: "active",
  title: "ACME_LAB|ACME_HOSP",
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

const sampleConceptMap2: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-other-lab-other-hosp-to-observation-code-loinc",
  name: "HL7v2 OTHER_LAB/OTHER_HOSP to LOINC",
  status: "active",
  title: "OTHER_LAB|OTHER_HOSP",
  sourceUri: "http://example.org/fhir/CodeSystem/hl7v2-other-lab-other-hosp",
  targetUri: "http://loinc.org",
  group: [],
};

// Generated using generateMappingTaskId({ sendingApplication: 'ACME_LAB', sendingFacility: 'ACME_HOSP' }, 'ACME-LAB-CODES', 'NA_SERUM')
const SAMPLE_TASK_ID = "map-hl7v2-acme-lab-acme-hosp-to-observation-code-loinc-japqda-511msp";

const samplePendingTask: Task = {
  resourceType: "Task",
  id: SAMPLE_TASK_ID,
  status: "requested",
  intent: "order",
  code: {
    coding: [
      {
        system: "http://example.org/task-codes",
        code: "observation-code-loinc",
      },
    ],
  },
  authoredOn: "2025-02-12T14:20:00Z",
  input: [
    { type: { text: "Sending application" }, valueString: "ACME_LAB" },
    { type: { text: "Sending facility" }, valueString: "ACME_HOSP" },
    { type: { text: "Local code" }, valueString: "NA_SERUM" },
    { type: { text: "Local display" }, valueString: "Sodium [Serum/Plasma]" },
    { type: { text: "Local system" }, valueString: "ACME-LAB-CODES" },
  ],
};

const sampleMessage: IncomingHL7v2Message = {
  resourceType: "IncomingHL7v2Message",
  id: "msg-001",
  type: "ORU_R01",
  message: "MSH|...",
  status: "mapping_error",
  sendingApplication: "ACME_LAB",
  sendingFacility: "ACME_HOSP",
  unmappedCodes: [
    {
      localCode: "NA_SERUM",
      localDisplay: "Sodium [Serum/Plasma]",
      localSystem: "ACME-LAB-CODES",
      mappingTask: {
        reference: `Task/${SAMPLE_TASK_ID}`,
      },
    },
  ],
};

// Base mock with all required exports
class MockNotFoundError extends Error {
  constructor(resourceType: string, id: string) {
    super(`${resourceType}/${id} not found`);
    this.name = "NotFoundError";
  }
}

class MockHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`HTTP ${status}: ${body}`);
    this.name = "HttpError";
  }
}

function createMockAidbox(overrides: Record<string, unknown> = {}) {
  return {
    aidboxFetch: mock(() => Promise.resolve({})),
    getResourceWithETag: mock(() =>
      Promise.resolve({ resource: {}, etag: '""' }),
    ),
    updateResourceWithETag: mock((rt: string, id: string, resource: unknown) =>
      Promise.resolve(resource),
    ),
    putResource: mock((rt: string, id: string, resource: unknown) =>
      Promise.resolve(resource),
    ),
    getResources: mock(() => Promise.resolve([])),
    Bundle: {},
    PreconditionFailedError: class extends Error {
      constructor(msg: string) {
        super(msg);
        this.name = "PreconditionFailedError";
      }
    },
    NotFoundError: MockNotFoundError,
    HttpError: MockHttpError,
    ...overrides,
  };
}


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


// ============================================================================
// CRUD operation tests (moved from ui/code-mappings.test.ts)
// ============================================================================

describe("listConceptMaps", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns all HL7v2-to-LOINC ConceptMaps with sender info", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/ConceptMap")) {
          return Promise.resolve({
            entry: [
              { resource: sampleConceptMap },
              { resource: sampleConceptMap2 },
            ],
          });
        }
        return Promise.resolve({});
      }),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps();

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("hl7v2-acme-lab-acme-hosp-to-observation-code-loinc");
    expect(result[0]!.displayName).toBe("ACME_LAB|ACME_HOSP");
  });

  test("returns empty array when no ConceptMaps exist", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({ entry: [] })),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps();

    expect(result).toHaveLength(0);
  });

  test("filters out ConceptMaps not targeting LOINC", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() =>
        Promise.resolve({
          entry: [
            { resource: sampleConceptMap },
            {
              resource: {
                resourceType: "ConceptMap",
                id: "some-other-conceptmap",
                status: "active",
                targetUri: "http://snomed.info/sct",
              },
            },
          ],
        }),
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps();

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("hl7v2-acme-lab-acme-hosp-to-observation-code-loinc");
  });
});

describe("getMappingsFromConceptMap", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns all elements with their group source system", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(sampleConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      1,
    );

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]!.localCode).toBe("K_SERUM");
    expect(result.entries[0]!.localDisplay).toBe("Potassium [Serum/Plasma]");
    expect(result.entries[0]!.localSystem).toBe("ACME-LAB-CODES");
    expect(result.entries[0]!.targetCode).toBe("2823-3");
    expect(result.entries[0]!.targetDisplay).toBe(
      "Potassium [Moles/volume] in Serum or Plasma",
    );
    expect(result.total).toBe(1);
  });

  test("returns empty array for ConceptMap with no groups", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(sampleConceptMap2)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "hl7v2-other-lab-other-hosp-to-observation-code-loinc",
      1,
    );

    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  test("paginates results (50 per page)", async () => {
    const manyElements = Array.from({ length: 75 }, (_, i) => ({
      code: `CODE_${i}`,
      display: `Display ${i}`,
      target: [{ code: `${1000 + i}`, equivalence: "equivalent" as const }],
    }));

    const conceptMapWithManyElements: ConceptMap = {
      ...sampleConceptMap,
      group: [
        {
          source: "ACME-LAB-CODES",
          target: "http://loinc.org",
          element: manyElements,
        },
      ],
    };

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(conceptMapWithManyElements)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const page1 = await getMappingsFromConceptMap(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      1,
    );
    expect(page1.entries).toHaveLength(50);
    expect(page1.total).toBe(75);
    expect(page1.entries[0]!.localCode).toBe("CODE_0");

    const page2 = await getMappingsFromConceptMap(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      2,
    );
    expect(page2.entries).toHaveLength(25);
    expect(page2.entries[0]!.localCode).toBe("CODE_50");
  });
});

describe("addConceptMapEntry", () => {
  afterEach(() => {
    mock.restore();
  });

  test("adds entry to existing group with matching source", async () => {
    let savedConceptMap: ConceptMap | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        if (path.includes("/fhir/ConceptMap/") && !options?.method) {
          return Promise.resolve(structuredClone(sampleConceptMap));
        }
        if (path.includes("/fhir/Task/")) {
          return Promise.reject(new MockNotFoundError("Task", "some-id"));
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string, id: string) => {
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"v1"',
          });
        }
        return Promise.reject(new MockNotFoundError(resourceType, id));
      }),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: ConceptMap) => {
          if (rt === "ConceptMap") {
            savedConceptMap = resource;
          }
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addConceptMapEntry } = await import("../../../src/code-mapping/concept-map/service");

    const result = await addConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "NA_SERUM",
      "Sodium [Serum/Plasma]",
      "ACME-LAB-CODES",
      "2951-2",
      "Sodium [Moles/volume] in Serum or Plasma",
    );

    expect(result.success).toBe(true);
    expect(savedConceptMap).not.toBeNull();

    const group = savedConceptMap!.group?.find(
      (g) => g.source === "ACME-LAB-CODES",
    );
    expect(group?.element).toHaveLength(2);

    const newElement = group?.element?.find((e) => e.code === "NA_SERUM");
    expect(newElement?.display).toBe("Sodium [Serum/Plasma]");
    expect(newElement?.target?.[0]?.code).toBe("2951-2");
  });

  test("creates new group when source system not found", async () => {
    let savedConceptMap: ConceptMap | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/Task/")) {
          return Promise.reject(new MockNotFoundError("Task", "some-id"));
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string, id: string) => {
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"v1"',
          });
        }
        return Promise.reject(new MockNotFoundError(resourceType, id));
      }),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: ConceptMap) => {
          if (rt === "ConceptMap") {
            savedConceptMap = resource;
          }
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addConceptMapEntry } = await import("../../../src/code-mapping/concept-map/service");

    await addConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "GLU",
      "Glucose",
      "OTHER-SYSTEM",
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

  test("detects duplicate code in same system and returns error", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(() => Promise.resolve({})),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addConceptMapEntry } = await import("../../../src/code-mapping/concept-map/service");

    const result = await addConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "K_SERUM", // Already exists
      "Potassium [Serum/Plasma]",
      "ACME-LAB-CODES",
      "2823-3",
      "Potassium [Moles/volume] in Serum or Plasma",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
    expect(mockAidbox.updateResourceWithETag).not.toHaveBeenCalled();
  });

  test("completes matching Task when entry added (atomic transaction)", async () => {
    let completedTask: Task | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        // Handle transaction bundle POST to /fhir
        if (path === "/fhir" && options?.method === "POST") {
          const bundle = JSON.parse(options.body as string);
          // Extract Task from transaction bundle
          const taskEntry = bundle.entry?.find(
            (e: { resource?: { resourceType?: string } }) =>
              e.resource?.resourceType === "Task",
          );
          if (taskEntry) {
            completedTask = taskEntry.resource as Task;
          }
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        if (path.includes("IncomingHL7v2Message?")) {
          return Promise.resolve({ entry: [] });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string, id: string) => {
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"v1"',
          });
        }
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"task-v1"',
          });
        }
        return Promise.reject(new MockNotFoundError(resourceType, id));
      }),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: Task | ConceptMap) => {
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addConceptMapEntry } = await import("../../../src/code-mapping/concept-map/service");

    await addConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "NA_SERUM",
      "Sodium [Serum/Plasma]",
      "ACME-LAB-CODES",
      "2951-2",
      "Sodium [Moles/volume] in Serum or Plasma",
    );

    expect(completedTask).not.toBeNull();
    expect(completedTask!.status).toBe("completed");
    expect(completedTask!.output).toBeDefined();
    expect(
      completedTask!.output![0]!.valueCodeableConcept?.coding?.[0]!.code,
    ).toBe("2951-2");
  });
});

describe("updateConceptMapEntry", () => {
  afterEach(() => {
    mock.restore();
  });

  test("updates existing entry LOINC mapping", async () => {
    let savedConceptMap: ConceptMap | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: ConceptMap) => {
          if (rt === "ConceptMap") {
            savedConceptMap = resource;
          }
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { updateConceptMapEntry } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await updateConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "K_SERUM",
      "ACME-LAB-CODES",
      "2823-3-UPDATED",
      "Potassium Updated Display",
    );

    expect(result.success).toBe(true);
    expect(savedConceptMap).not.toBeNull();

    const element = savedConceptMap!.group?.[0]?.element?.find(
      (e) => e.code === "K_SERUM",
    );
    expect(element?.target?.[0]?.code).toBe("2823-3-UPDATED");
    expect(element?.target?.[0]?.display).toBe("Potassium Updated Display");
  });

  test("returns error when entry not found", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(() => Promise.resolve({})),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { updateConceptMapEntry } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await updateConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "NONEXISTENT",
      "ACME-LAB-CODES",
      "1234-5",
      "Some Display",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  test("uses ETag for optimistic concurrency", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"specific-etag"',
        }),
      ),
      updateResourceWithETag: mock(() => Promise.resolve({})),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { updateConceptMapEntry } =
      await import("../../../src/code-mapping/concept-map/service");

    await updateConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "K_SERUM",
      "ACME-LAB-CODES",
      "2823-3",
      "Updated",
    );

    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalledWith(
      "ConceptMap",
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      expect.any(Object),
      '"specific-etag"',
    );
  });
});

describe("deleteConceptMapEntry", () => {
  afterEach(() => {
    mock.restore();
  });

  test("removes entry from ConceptMap", async () => {
    let savedConceptMap: ConceptMap | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: ConceptMap) => {
          if (rt === "ConceptMap") {
            savedConceptMap = resource;
          }
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { deleteConceptMapEntry } =
      await import("../../../src/code-mapping/concept-map/service");

    await deleteConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "K_SERUM",
      "ACME-LAB-CODES",
    );

    expect(savedConceptMap).not.toBeNull();
    const group = savedConceptMap!.group?.find(
      (g) => g.source === "ACME-LAB-CODES",
    );
    expect(group?.element?.find((e) => e.code === "K_SERUM")).toBeUndefined();
  });

  test("removes empty group after last entry deleted", async () => {
    let savedConceptMap: ConceptMap | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(
        (rt: string, id: string, resource: ConceptMap) => {
          if (rt === "ConceptMap") {
            savedConceptMap = resource;
          }
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { deleteConceptMapEntry } =
      await import("../../../src/code-mapping/concept-map/service");

    await deleteConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "K_SERUM",
      "ACME-LAB-CODES",
    );

    // Group should be removed since it has no elements
    expect(
      savedConceptMap!.group?.find((g) => g.source === "ACME-LAB-CODES"),
    ).toBeUndefined();
  });

  test("does nothing when entry not found", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve({})),
      getResourceWithETag: mock(() =>
        Promise.resolve({
          resource: structuredClone(sampleConceptMap),
          etag: '"v1"',
        }),
      ),
      updateResourceWithETag: mock(() => Promise.resolve({})),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { deleteConceptMapEntry } =
      await import("../../../src/code-mapping/concept-map/service");

    // Should not throw
    await deleteConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "NONEXISTENT",
      "ACME-LAB-CODES",
    );

    // Still updates (with no change)
    expect(mockAidbox.updateResourceWithETag).toHaveBeenCalled();
  });
});

// Test data for search functionality
const searchTestConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "search-test-concept-map",
  name: "Search Test ConceptMap",
  status: "active",
  title: "SEARCH_TEST|FACILITY",
  sourceUri: "http://example.org/fhir/CodeSystem/search-test",
  targetUri: "http://loinc.org",
  group: [
    {
      source: "TEST-LAB-CODES",
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
        {
          code: "NA_SERUM",
          display: "Sodium [Serum/Plasma]",
          target: [
            {
              code: "2951-2",
              display: "Sodium [Moles/volume] in Serum or Plasma",
              equivalence: "equivalent",
            },
          ],
        },
        {
          code: "GLU_BLOOD",
          display: "Glucose [Blood]",
          target: [
            {
              code: "2345-7",
              display: "Glucose [Mass/volume] in Serum or Plasma",
              equivalence: "equivalent",
            },
          ],
        },
        {
          code: "CREAT",
          display: "Creatinine",
          target: [
            {
              code: "2160-0",
              display: "Creatinine [Mass/volume] in Serum or Plasma",
              equivalence: "equivalent",
            },
          ],
        },
      ],
    },
  ],
};

describe("getMappingsFromConceptMap - search", () => {
  afterEach(() => {
    mock.restore();
  });

  test("filters by local code (partial match)", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(searchTestConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "GLU_",
    );

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.localCode).toBe("GLU_BLOOD");
  });

  test("filters by local display (partial match)", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(searchTestConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "Potassium",
    );

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.localCode).toBe("K_SERUM");
    expect(result.entries[0]!.localDisplay).toBe("Potassium [Serum/Plasma]");
  });

  test("filters by LOINC code (partial match)", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(searchTestConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "2345",
    );

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.localCode).toBe("GLU_BLOOD");
    expect(result.entries[0]!.targetCode).toBe("2345-7");
  });

  test("filters by target display (partial match)", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(searchTestConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "Creatinine [Mass",
    );

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.localCode).toBe("CREAT");
    expect(result.entries[0]!.targetDisplay).toBe(
      "Creatinine [Mass/volume] in Serum or Plasma",
    );
  });

  test("search is case-insensitive", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(searchTestConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "glucose",
    );

    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.entries[0]!.localCode).toBe("GLU_BLOOD");
  });

  test("returns empty results when no match found", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() => Promise.resolve(searchTestConceptMap)),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const result = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "NONEXISTENT",
    );

    expect(result.entries).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  test("search results are paginated correctly", async () => {
    const manyElements = Array.from({ length: 75 }, (_, i) => ({
      code: `POTASSIUM_${i}`,
      display: `Potassium variant ${i}`,
      target: [
        {
          code: `${1000 + i}`,
          display: `LOINC ${i}`,
          equivalence: "equivalent" as const,
        },
      ],
    }));

    const conceptMapWithManyPotassiumEntries: ConceptMap = {
      ...searchTestConceptMap,
      group: [
        {
          source: "TEST-LAB-CODES",
          target: "http://loinc.org",
          element: [
            ...manyElements,
            {
              code: "SODIUM_1",
              display: "Sodium variant",
              target: [
                {
                  code: "9999",
                  display: "Sodium LOINC",
                  equivalence: "equivalent" as const,
                },
              ],
            },
          ],
        },
      ],
    };

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock(() =>
        Promise.resolve(conceptMapWithManyPotassiumEntries),
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { getMappingsFromConceptMap } =
      await import("../../../src/code-mapping/concept-map/service");

    const page1 = await getMappingsFromConceptMap(
      "search-test-concept-map",
      1,
      "POTASSIUM",
    );
    expect(page1.entries).toHaveLength(50);
    expect(page1.total).toBe(75);
    expect(page1.entries[0]!.localCode).toBe("POTASSIUM_0");

    const page2 = await getMappingsFromConceptMap(
      "search-test-concept-map",
      2,
      "POTASSIUM",
    );
    expect(page2.entries).toHaveLength(25);
    expect(page2.total).toBe(75);
    expect(page2.entries[0]!.localCode).toBe("POTASSIUM_50");
  });
});

describe("integration: add mapping flow", () => {
  afterEach(() => {
    mock.restore();
  });

  test("add mapping -> Task completed (atomic) -> message updated", async () => {
    let completedTask: Task | null = null;
    let updatedMessage: IncomingHL7v2Message | null = null;

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string, options?: RequestInit) => {
        // Handle transaction bundle POST to /fhir
        if (path === "/fhir" && options?.method === "POST") {
          const bundle = JSON.parse(options.body as string);
          // Extract Task from transaction bundle
          const taskEntry = bundle.entry?.find(
            (e: { resource?: { resourceType?: string } }) =>
              e.resource?.resourceType === "Task",
          );
          if (taskEntry) {
            completedTask = taskEntry.resource as Task;
          }
          return Promise.resolve({ type: "transaction-response", entry: [] });
        }
        if (path.includes("IncomingHL7v2Message?")) {
          return Promise.resolve({
            entry: [{ resource: structuredClone(sampleMessage) }],
          });
        }
        return Promise.resolve({});
      }),
      getResourceWithETag: mock((resourceType: string, id: string) => {
        if (resourceType === "ConceptMap") {
          return Promise.resolve({
            resource: structuredClone(sampleConceptMap),
            etag: '"cm-v1"',
          });
        }
        if (resourceType === "Task") {
          return Promise.resolve({
            resource: structuredClone(samplePendingTask),
            etag: '"task-v1"',
          });
        }
        if (resourceType === "IncomingHL7v2Message") {
          return Promise.resolve({
            resource: structuredClone(sampleMessage),
            etag: '"msg-v1"',
          });
        }
        return Promise.reject(new MockNotFoundError(resourceType, id));
      }),
      updateResourceWithETag: mock(
        (
          rt: string,
          id: string,
          resource: Task | ConceptMap | IncomingHL7v2Message,
        ) => {
          if (rt === "IncomingHL7v2Message") {
            updatedMessage = resource as IncomingHL7v2Message;
          }
          return Promise.resolve(resource);
        },
      ),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { addConceptMapEntry } = await import("../../../src/code-mapping/concept-map/service");

    await addConceptMapEntry(
      "hl7v2-acme-lab-acme-hosp-to-observation-code-loinc",
      "NA_SERUM",
      "Sodium [Serum/Plasma]",
      "ACME-LAB-CODES",
      "2951-2",
      "Sodium [Moles/volume] in Serum or Plasma",
    );

    // Task should be completed (via atomic transaction)
    expect(completedTask).not.toBeNull();
    expect(completedTask!.status).toBe("completed");

    // Message should be updated
    expect(updatedMessage).not.toBeNull();
    expect(updatedMessage!.unmappedCodes).toBeUndefined();
    expect(updatedMessage!.status).toBe("received");
  });
});

// ============================================================================
// Type filtering tests (moved from ui/code-mappings.test.ts)
// ============================================================================

// Sample ConceptMaps for different mapping types
const obrStatusConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-acme-lab-acme-hosp-obr-status",
  name: "HL7v2 ACME_LAB/ACME_HOSP to OBR Status",
  status: "active",
  title: "ACME_LAB|ACME_HOSP",
  sourceUri: "http://example.org/fhir/CodeSystem/hl7v2-acme-lab-acme-hosp",
  targetUri: "http://hl7.org/fhir/diagnostic-report-status",
  group: [
    {
      source: "http://terminology.hl7.org/CodeSystem/v2-0123",
      target: "http://hl7.org/fhir/diagnostic-report-status",
      element: [
        {
          code: "X",
          display: "Unknown",
          target: [{ code: "final", display: "Final", equivalence: "equivalent" }],
        },
      ],
    },
  ],
};

const patientClassConceptMap: ConceptMap = {
  resourceType: "ConceptMap",
  id: "hl7v2-other-lab-to-encounter-class",
  name: "HL7v2 OTHER_LAB to Encounter Class",
  status: "active",
  title: "OTHER_LAB|OTHER_HOSP",
  sourceUri: "http://example.org/fhir/CodeSystem/hl7v2-other-lab",
  targetUri: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
  group: [],
};

describe("listConceptMaps - type filtering", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns all known mapping type ConceptMaps when filter is 'all'", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/ConceptMap")) {
          return Promise.resolve({
            entry: [
              { resource: sampleConceptMap },
              { resource: obrStatusConceptMap },
              { resource: patientClassConceptMap },
            ],
          });
        }
        return Promise.resolve({});
      }),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps("all");

    expect(result).toHaveLength(3);
    expect(result.map(cm => cm.mappingType)).toContain("observation-code-loinc");
    expect(result.map(cm => cm.mappingType)).toContain("obr-status");
    expect(result.map(cm => cm.mappingType)).toContain("patient-class");
  });

  test("filters to only LOINC ConceptMaps when filter is 'observation-code-loinc'", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/ConceptMap")) {
          return Promise.resolve({
            entry: [
              { resource: sampleConceptMap },
              { resource: obrStatusConceptMap },
              { resource: patientClassConceptMap },
            ],
          });
        }
        return Promise.resolve({});
      }),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps("observation-code-loinc");

    expect(result).toHaveLength(1);
    expect(result[0]!.mappingType).toBe("observation-code-loinc");
    expect(result[0]!.targetSystem).toBe("http://loinc.org");
  });

  test("filters to only obr-status ConceptMaps when filter is 'obr-status'", async () => {
    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/ConceptMap")) {
          return Promise.resolve({
            entry: [
              { resource: sampleConceptMap },
              { resource: obrStatusConceptMap },
              { resource: patientClassConceptMap },
            ],
          });
        }
        return Promise.resolve({});
      }),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps("obr-status");

    expect(result).toHaveLength(1);
    expect(result[0]!.mappingType).toBe("obr-status");
    expect(result[0]!.targetSystem).toBe("http://hl7.org/fhir/diagnostic-report-status");
  });

  test("excludes ConceptMaps with unknown target systems", async () => {
    const unknownConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "unknown-target",
      status: "active",
      targetUri: "http://unknown.system.org/codes",
      group: [],
    };

    const mockAidbox = createMockAidbox({
      aidboxFetch: mock((path: string) => {
        if (path.includes("/fhir/ConceptMap")) {
          return Promise.resolve({
            entry: [
              { resource: sampleConceptMap },
              { resource: unknownConceptMap },
            ],
          });
        }
        return Promise.resolve({});
      }),
    });

    mock.module("../../../src/aidbox", () => mockAidbox);
    const { listConceptMaps } = await import("../../../src/code-mapping/concept-map/service");

    const result = await listConceptMaps("all");

    expect(result).toHaveLength(1);
    expect(result[0]!.mappingType).toBe("observation-code-loinc");
  });
});

describe("detectMappingTypeFromConceptMap", () => {
  afterEach(() => {
    mock.restore();
  });

  test("detects LOINC mapping type", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { detectMappingTypeFromConceptMap } = await import("../../../src/code-mapping/concept-map/service");

    expect(detectMappingTypeFromConceptMap(sampleConceptMap)).toBe("observation-code-loinc");
  });

  test("detects obr-status mapping type", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { detectMappingTypeFromConceptMap } = await import("../../../src/code-mapping/concept-map/service");

    expect(detectMappingTypeFromConceptMap(obrStatusConceptMap)).toBe("obr-status");
  });

  test("returns null for unknown target system", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { detectMappingTypeFromConceptMap } = await import("../../../src/code-mapping/concept-map/service");

    const unknownConceptMap: ConceptMap = {
      resourceType: "ConceptMap",
      id: "unknown",
      status: "active",
      targetUri: "http://unknown.system.org/codes",
    };

    expect(detectMappingTypeFromConceptMap(unknownConceptMap)).toBeNull();
  });
});
