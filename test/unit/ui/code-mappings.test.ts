/**
 * Tests for Code Mappings UI - rendering functions
 *
 * Tests for UI rendering and display logic:
 * - parseTypeFilter
 * - getMappingTypeFilterDisplay
 * - getMappingTypeShortLabel
 * - getValidValuesWithDisplay
 * - renderMappingEntryPanel
 * - renderCodeMappingsPage
 *
 * CRUD operation tests are in concept-map-service.test.ts
 */
import { describe, test, expect, mock, afterEach } from "bun:test";
import type { ConceptMap } from "../../../src/fhir/hl7-fhir-r4-core/ConceptMap";

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

// Sample ConceptMaps for rendering tests
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

// ============================================================================
// UI rendering and display logic tests
// ============================================================================

describe("parseTypeFilter", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns 'all' for null input", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { parseTypeFilter } = await import("../../../src/ui/pages/code-mappings");

    expect(parseTypeFilter(null)).toBe("all");
  });

  test("returns 'all' for unknown type", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { parseTypeFilter } = await import("../../../src/ui/pages/code-mappings");

    expect(parseTypeFilter("unknown-type")).toBe("all");
  });

  test("returns the type for valid mapping types", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { parseTypeFilter } = await import("../../../src/ui/pages/code-mappings");

    expect(parseTypeFilter("observation-code-loinc")).toBe("observation-code-loinc");
    expect(parseTypeFilter("patient-class")).toBe("patient-class");
    expect(parseTypeFilter("obr-status")).toBe("obr-status");
    expect(parseTypeFilter("obx-status")).toBe("obx-status");
  });
});

describe("getMappingTypeFilterDisplay", () => {
  afterEach(() => {
    mock.restore();
  });

  test("returns 'All Types' for 'all' filter", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { getMappingTypeFilterDisplay } = await import("../../../src/ui/pages/code-mappings");

    expect(getMappingTypeFilterDisplay("all")).toBe("All Types");
  });

  test("returns display name without 'mapping' suffix for known types", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { getMappingTypeFilterDisplay } = await import("../../../src/ui/pages/code-mappings");

    expect(getMappingTypeFilterDisplay("observation-code-loinc")).toBe("Observation code to LOINC");
    expect(getMappingTypeFilterDisplay("obr-status")).toBe("OBR result status");
  });
});

describe("getMappingTypeShortLabel", () => {
  test("returns short labels for all mapping types", async () => {
    const { getMappingTypeShortLabel } = await import("../../../src/ui/mapping-type-ui");

    expect(getMappingTypeShortLabel("observation-code-loinc")).toBe("LOINC");
    expect(getMappingTypeShortLabel("patient-class")).toBe("Patient Class");
    expect(getMappingTypeShortLabel("obr-status")).toBe("OBR Status");
    expect(getMappingTypeShortLabel("obx-status")).toBe("OBX Status");
  });
});

describe("getValidValuesWithDisplay", () => {
  test("returns patient class values", async () => {
    const { getValidValuesWithDisplay } = await import("../../../src/code-mapping/mapping-type-options");

    const values = getValidValuesWithDisplay("patient-class");
    expect(values.length).toBeGreaterThan(0);
    expect(values.some(v => v.code === "AMB")).toBe(true);
    expect(values.some(v => v.code === "IMP")).toBe(true);
  });

  test("returns OBR status values", async () => {
    const { getValidValuesWithDisplay } = await import("../../../src/code-mapping/mapping-type-options");

    const values = getValidValuesWithDisplay("obr-status");
    expect(values.length).toBeGreaterThan(0);
    expect(values.some(v => v.code === "final")).toBe(true);
    expect(values.some(v => v.code === "preliminary")).toBe(true);
  });

  test("returns empty array for LOINC (uses autocomplete instead)", async () => {
    const { getValidValuesWithDisplay } = await import("../../../src/code-mapping/mapping-type-options");

    const values = getValidValuesWithDisplay("observation-code-loinc");
    expect(values).toHaveLength(0);
  });
});

describe("renderMappingEntryPanel", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders entry with target code and system", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { renderMappingEntryPanel } = await import("../../../src/ui/pages/code-mappings");

    const entry = {
      localCode: "K_SERUM",
      localDisplay: "Potassium",
      localSystem: "ACME-LAB-CODES",
      targetCode: "2823-3",
      targetDisplay: "Potassium [Moles/volume]",
      targetSystem: "http://loinc.org",
    };

    const html = renderMappingEntryPanel(entry, "cm-id", "observation-code-loinc", "all");

    expect(html).toContain("K_SERUM");
    expect(html).toContain("2823-3");
    expect(html).toContain("http://loinc.org");
    expect(html).toContain("Potassium [Moles/volume]");
  });

  test("renders LOINC autocomplete input for observation-code-loinc type", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { renderMappingEntryPanel } = await import("../../../src/ui/pages/code-mappings");

    const entry = {
      localCode: "K_SERUM",
      localDisplay: "Potassium",
      localSystem: "ACME-LAB-CODES",
      targetCode: "2823-3",
      targetDisplay: "Potassium",
      targetSystem: "http://loinc.org",
    };

    const html = renderMappingEntryPanel(entry, "cm-id", "observation-code-loinc", "all");

    expect(html).toContain("data-loinc-autocomplete");
  });

  test("renders dropdown for non-LOINC types", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { renderMappingEntryPanel } = await import("../../../src/ui/pages/code-mappings");

    const entry = {
      localCode: "X",
      localDisplay: "Unknown",
      localSystem: "http://terminology.hl7.org/CodeSystem/v2-0123",
      targetCode: "final",
      targetDisplay: "Final",
      targetSystem: "http://hl7.org/fhir/diagnostic-report-status",
    };

    const html = renderMappingEntryPanel(entry, "cm-id", "obr-status", "all");

    expect(html).toContain("<select");
    expect(html).toContain("final");
    expect(html).toContain("preliminary");
  });
});

describe("renderCodeMappingsPage", () => {
  afterEach(() => {
    mock.restore();
  });

  test("renders type filter tabs", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { renderCodeMappingsPage } = await import("../../../src/ui/pages/code-mappings");

    const navData = { pendingMappingTasksCount: 0 };
    const html = renderCodeMappingsPage(
      navData,
      [],
      null,
      [],
      { currentPage: 1, totalPages: 1, total: 0 },
      false,
      null,
      undefined,
      "all",
      null,
    );

    expect(html).toContain("All Types");
    expect(html).toContain("Observation code to LOINC");
    expect(html).toContain("Patient class");
  });

  test("highlights active type filter", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { renderCodeMappingsPage } = await import("../../../src/ui/pages/code-mappings");

    const navData = { pendingMappingTasksCount: 0 };
    const html = renderCodeMappingsPage(
      navData,
      [],
      null,
      [],
      { currentPage: 1, totalPages: 1, total: 0 },
      false,
      null,
      undefined,
      "observation-code-loinc",
      null,
    );

    // The active filter should have the blue background class
    expect(html).toMatch(/href="\/mapping\/table\?type=observation-code-loinc"[^>]*class="[^"]*bg-blue-600[^"]*"/);
  });

  test("includes mapping type badge in sender dropdown", async () => {
    mock.module("../../../src/aidbox", () => createMockAidbox());
    const { renderCodeMappingsPage } = await import("../../../src/ui/pages/code-mappings");

    const navData = { pendingMappingTasksCount: 0 };
    const conceptMaps = [
      { id: "cm-1", displayName: "ACME_LAB|ACME_HOSP", mappingType: "observation-code-loinc" as const, targetSystem: "http://loinc.org" },
      { id: "cm-2", displayName: "OTHER_LAB|OTHER_HOSP", mappingType: "obr-status" as const, targetSystem: "http://hl7.org/fhir/diagnostic-report-status" },
    ];

    const html = renderCodeMappingsPage(
      navData,
      conceptMaps,
      null,
      [],
      { currentPage: 1, totalPages: 1, total: 0 },
      false,
      null,
      undefined,
      "all",
      null,
    );

    expect(html).toContain("[LOINC] ACME_LAB|ACME_HOSP");
    expect(html).toContain("[OBR Status] OTHER_LAB|OTHER_HOSP");
  });
});
