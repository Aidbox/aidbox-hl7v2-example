import { describe, it, expect, mock, beforeEach } from "bun:test";

// ============================================================================
// Mocks — aidboxFetch is URL-aware: ConceptMap queries return mockConceptMaps,
// count queries return the configured processed/error totals.
// ============================================================================

type ConceptMapLike = {
  id: string;
  title?: string;
  targetUri?: string;
  meta?: { createdAt?: string; lastUpdated?: string };
  group?: Array<{
    source?: string;
    target?: string;
    element?: Array<{ code?: string; display?: string; target?: Array<{ code?: string; display?: string }> }>;
  }>;
};

let mockConceptMaps: ConceptMapLike[] = [];
let mockProcessedCount = 0;
let mockErrorCount = 0;

// Preserve HttpError / NotFoundError from the real module — Bun's mock.module
// is process-wide and translateCode tests (in another file) depend on the
// exact `HTTP {status}: {body}` message format that the real HttpError emits.
const realAidbox = await import("../../../src/aidbox");

mock.module("../../../src/aidbox", () => ({
  aidboxFetch: async (path: string) => {
    if (path.startsWith("/fhir/ConceptMap")) {
      return {
        resourceType: "Bundle",
        entry: mockConceptMaps.map((resource) => ({ resource })),
      };
    }
    if (path.includes("status=processed")) {
      return { resourceType: "Bundle", total: mockProcessedCount };
    }
    if (path.includes("status=code_mapping_error")) {
      return { resourceType: "Bundle", total: mockErrorCount };
    }
    return { resourceType: "Bundle", entry: [] };
  },
  putResource: async () => undefined,
  getResourceWithETag: async () => {
    throw new realAidbox.NotFoundError("Task", "mock");
  },
  updateResourceWithETag: async () => undefined,
  HttpError: realAidbox.HttpError,
  NotFoundError: realAidbox.NotFoundError,
}));

const {
  loadAllTerminologyRows,
  applyFilters,
  buildFacet,
  computeKpis,
  renderTablePartial,
  renderFacetPartial,
  renderDetailPartial,
  renderEmptyDetail,
  handleTerminologyTablePartial,
  handleTerminologyFhirFacet,
  handleTerminologySenderFacet,
  handleTerminologyDetailPartial,
} = await import("../../../src/ui/pages/terminology");
type Row = Awaited<ReturnType<typeof loadAllTerminologyRows>>[number];

// ============================================================================
// Helpers
// ============================================================================

function makeConceptMap(
  id: string,
  title: string,
  targetUri: string,
  entries: Array<{ source: string; code: string; display?: string; tCode: string; tDisplay?: string }>,
  createdAt?: string,
): ConceptMapLike {
  const bySource = new Map<string, typeof entries>();
  for (const e of entries) {
    if (!bySource.has(e.source)) {bySource.set(e.source, []);}
    bySource.get(e.source)!.push(e);
  }
  return {
    id,
    title,
    targetUri,
    meta: createdAt ? { createdAt } : undefined,
    group: [...bySource.entries()].map(([source, rows]) => ({
      source,
      target: targetUri,
      element: rows.map((e) => ({
        code: e.code,
        display: e.display,
        target: [{ code: e.tCode, display: e.tDisplay }],
      })),
    })),
  };
}

const OBS_CODE = "http://loinc.org";
const ENC_CLASS = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
const OBR_STATUS = "http://hl7.org/fhir/diagnostic-report-status";

// ============================================================================
// loadAllTerminologyRows
// ============================================================================

describe("loadAllTerminologyRows", () => {
  beforeEach(() => {
    mockConceptMaps = [];
  });

  it("returns empty when no ConceptMaps exist", async () => {
    const rows = await loadAllTerminologyRows();
    expect(rows).toEqual([]);
  });

  it("flattens all group elements across all ConceptMaps", async () => {
    mockConceptMaps = [
      makeConceptMap("cm-lab", "ACME_LAB | HOSP", OBS_CODE, [
        { source: "LOCAL", code: "GLUC", display: "Glucose", tCode: "2345-7", tDisplay: "Glucose [Mass/volume]" },
        { source: "LOCAL", code: "HGB", display: "Hemoglobin", tCode: "718-7", tDisplay: "Hemoglobin [Mass/volume]" },
      ]),
      makeConceptMap("cm-enc", "ACME_LAB | HOSP", ENC_CLASS, [
        { source: "HL7V2", code: "I", display: "Inpatient", tCode: "IMP", tDisplay: "Inpatient encounter" },
      ]),
    ];
    const rows = await loadAllTerminologyRows();
    expect(rows).toHaveLength(3);
    const codes = rows.map((r) => r.localCode).sort();
    expect(codes).toEqual(["GLUC", "HGB", "I"]);
  });

  it("derives fhirField from mapping type (targetLabel)", async () => {
    mockConceptMaps = [
      makeConceptMap("cm-obs", "S1", OBS_CODE, [
        { source: "LOCAL", code: "X", tCode: "1" },
      ]),
      makeConceptMap("cm-enc", "S1", ENC_CLASS, [
        { source: "LOCAL", code: "Y", tCode: "2" },
      ]),
      makeConceptMap("cm-obr", "S1", OBR_STATUS, [
        { source: "LOCAL", code: "Z", tCode: "3" },
      ]),
    ];
    const rows = await loadAllTerminologyRows();
    const fhirFields = rows.map((r) => r.fhirField).sort();
    expect(fhirFields).toEqual([
      "DiagnosticReport.status",
      "Encounter.class",
      "Observation.code",
    ]);
  });

  it("skips ConceptMaps whose targetUri is not a known mapping system", async () => {
    mockConceptMaps = [
      { id: "unknown-cm", title: "X", targetUri: "http://example.org/not-known", group: [{ source: "a", element: [{ code: "A", target: [{ code: "B" }] }] }] },
      makeConceptMap("cm-obs", "S1", OBS_CODE, [{ source: "LOCAL", code: "X", tCode: "1" }]),
    ];
    const rows = await loadAllTerminologyRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.conceptMapId).toBe("cm-obs");
  });

  it("captures createdAt from meta.createdAt for lineage", async () => {
    mockConceptMaps = [
      makeConceptMap(
        "cm-obs",
        "S1",
        OBS_CODE,
        [{ source: "LOCAL", code: "X", tCode: "1" }],
        "2024-08-12T10:00:00Z",
      ),
    ];
    const rows = await loadAllTerminologyRows();
    expect(rows[0]!.createdAt).toBe("2024-08-12T10:00:00Z");
  });
});

// ============================================================================
// Filtering
// ============================================================================

describe("applyFilters", () => {
  const rows: Row[] = [
    { conceptMapId: "a", localCode: "GLUC", localDisplay: "Glucose", localSystem: "LOCAL", targetCode: "2345-7", targetDisplay: "Glucose", targetSystem: OBS_CODE, sender: "LAB_A", fhirField: "Observation.code", hl7Field: "OBX-3", mappingType: "observation-code-loinc" },
    { conceptMapId: "b", localCode: "HGB",  localDisplay: "Hemoglobin", localSystem: "LOCAL", targetCode: "718-7", targetDisplay: "Hemoglobin", targetSystem: OBS_CODE, sender: "LAB_B", fhirField: "Observation.code", hl7Field: "OBX-3", mappingType: "observation-code-loinc" },
    { conceptMapId: "c", localCode: "I",    localDisplay: "Inpatient", localSystem: "LOCAL", targetCode: "IMP",    targetDisplay: "Inpatient", targetSystem: ENC_CLASS, sender: "LAB_A", fhirField: "Encounter.class", hl7Field: "PV1-2", mappingType: "patient-class" },
  ];

  it("returns all rows when no filters active", () => {
    expect(applyFilters(rows, { q: "", fhir: [], sender: [] })).toHaveLength(3);
  });

  it("matches query against localCode, localDisplay, targetCode, targetDisplay", () => {
    expect(applyFilters(rows, { q: "glucose", fhir: [], sender: [] })).toHaveLength(1);
    expect(applyFilters(rows, { q: "718-7",   fhir: [], sender: [] })).toHaveLength(1);
    expect(applyFilters(rows, { q: "Inpatient", fhir: [], sender: [] })).toHaveLength(1);
  });

  it("filters by multi-value fhir (OR semantics)", () => {
    const filtered = applyFilters(rows, { q: "", fhir: ["Observation.code"], sender: [] });
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.localCode).sort()).toEqual(["GLUC", "HGB"]);
  });

  it("filters by multi-value sender", () => {
    const filtered = applyFilters(rows, { q: "", fhir: [], sender: ["LAB_A"] });
    expect(filtered).toHaveLength(2);
  });

  it("combines fhir + sender + q as AND", () => {
    const filtered = applyFilters(rows, {
      q: "gluc",
      fhir: ["Observation.code"],
      sender: ["LAB_A"],
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.localCode).toBe("GLUC");
  });
});

// ============================================================================
// buildFacet
// ============================================================================

describe("buildFacet", () => {
  const rows: Row[] = [
    { conceptMapId: "a", localCode: "A", localDisplay: "", localSystem: "L", targetCode: "1", targetDisplay: "", targetSystem: OBS_CODE, sender: "LAB_A", fhirField: "Observation.code", hl7Field: "OBX-3", mappingType: "observation-code-loinc" },
    { conceptMapId: "a", localCode: "B", localDisplay: "", localSystem: "L", targetCode: "2", targetDisplay: "", targetSystem: OBS_CODE, sender: "LAB_A", fhirField: "Observation.code", hl7Field: "OBX-3", mappingType: "observation-code-loinc" },
    { conceptMapId: "c", localCode: "C", localDisplay: "", localSystem: "L", targetCode: "3", targetDisplay: "", targetSystem: ENC_CLASS, sender: "LAB_B", fhirField: "Encounter.class", hl7Field: "PV1-2", mappingType: "patient-class" },
  ];

  it("groups by fhirField and sorts by count descending", () => {
    const facet = buildFacet(rows, "fhirField");
    expect(facet).toEqual([
      { name: "Observation.code", count: 2 },
      { name: "Encounter.class", count: 1 },
    ]);
  });

  it("groups by sender", () => {
    const facet = buildFacet(rows, "sender");
    expect(facet.find((e) => e.name === "LAB_A")?.count).toBe(2);
    expect(facet.find((e) => e.name === "LAB_B")?.count).toBe(1);
  });
});

// ============================================================================
// computeKpis
// ============================================================================

describe("computeKpis", () => {
  beforeEach(() => {
    mockProcessedCount = 0;
    mockErrorCount = 0;
  });

  it("coverage is null when both processed+error are 0 (no data yet)", async () => {
    const kpis = await computeKpis([]);
    expect(kpis.totalMappings).toBe(0);
    expect(kpis.coveragePercent).toBeNull();
    expect(kpis.needsReview).toBe(0);
  });

  it("coverage = processed / (processed + code_mapping_error) · 100, rounded", async () => {
    mockProcessedCount = 75;
    mockErrorCount = 25;
    const kpis = await computeKpis([]);
    expect(kpis.coveragePercent).toBe(75);
    expect(kpis.processedCount).toBe(75);
  });

  it("coverage = 100 when zero errors", async () => {
    mockProcessedCount = 10;
    mockErrorCount = 0;
    const kpis = await computeKpis([]);
    expect(kpis.coveragePercent).toBe(100);
  });

  it("needsReview is always literal 0 in v1", async () => {
    mockProcessedCount = 999;
    mockErrorCount = 999;
    const kpis = await computeKpis([]);
    expect(kpis.needsReview).toBe(0);
  });
});

// ============================================================================
// renderTablePartial
// ============================================================================

describe("renderTablePartial", () => {
  const rows: Row[] = [
    { conceptMapId: "cm-a", localCode: "GLUC", localDisplay: "Glucose", localSystem: "LOCAL", targetCode: "2345-7", targetDisplay: "Glucose", targetSystem: OBS_CODE, sender: "ACME_LAB | HOSP", fhirField: "Observation.code", hl7Field: "OBX-3", mappingType: "observation-code-loinc" },
  ];

  it("renders hx-get URL on each row (encoded localCode + localSystem)", () => {
    const html = renderTablePartial(rows, 1, { q: "", fhir: [], sender: [] }, null);
    // Row attrs are single-quoted now so JSON in Alpine expressions doesn't
    // collide with the surrounding attribute's quote.
    expect(html).toContain(`hx-get='/terminology/partials/detail/cm-a/GLUC?localSystem=LOCAL'`);
    expect(html).toContain(`hx-target='#terminology-detail'`);
  });

  it("renders the 'N of M' count with both filtered and total", () => {
    const html = renderTablePartial(rows, 5, { q: "", fhir: [], sender: [] }, null);
    expect(html).toContain("1 of 5");
  });

  it("shows 'Clear N filter(s)' when filters active", () => {
    const html = renderTablePartial(rows, 1, { q: "", fhir: ["Observation.code"], sender: ["X"] }, null);
    expect(html).toContain("Clear 2 filters");
  });

  it("does not render clear button when no filters", () => {
    const html = renderTablePartial(rows, 1, { q: "", fhir: [], sender: [] }, null);
    expect(html).not.toContain("Clear ");
  });

  it("renders empty-state when no rows match", () => {
    const html = renderTablePartial([], 10, { q: "xyz", fhir: [], sender: [] }, null);
    expect(html).toContain("No mappings match your filters");
  });

  it("URL-encodes localCode containing ^ in hx-get and hx-push-url", () => {
    const caretRow = { ...rows[0]!, localCode: "UNKNOWN^TEST" };
    const html = renderTablePartial([caretRow], 1, { q: "", fhir: [], sender: [] }, null);
    // Neither hx-get nor hx-push-url should contain a raw ^
    expect(html).not.toMatch(/hx-get="[^"]*\^[^"]*"/);
    expect(html).not.toMatch(/hx-push-url="[^"]*\^[^"]*"/);
    // The encoded form is present
    expect(html).toContain("UNKNOWN%5ETEST");
  });

  it("highlights the selected row with accent border", () => {
    const html = renderTablePartial(rows, 1, { q: "", fhir: [], sender: [] }, rows[0]!);
    expect(html).toContain("border-l-accent");
  });
});

// ============================================================================
// renderFacetPartial
// ============================================================================

describe("renderFacetPartial", () => {
  const entries = [
    { name: "Observation.code", count: 10 },
    { name: "Condition.code", count: 4 },
  ];

  it("renders one row per entry with name and count", () => {
    const html = renderFacetPartial("fhir", entries, [], { q: "", fhir: [], sender: [] });
    expect(html).toContain("Observation");
    expect(html).toContain("Condition");
    expect(html).toContain(">10<");
    expect(html).toContain(">4<");
  });

  it("marks selected entries with checked checkbox", () => {
    const html = renderFacetPartial("fhir", entries, ["Observation.code"], { q: "", fhir: ["Observation.code"], sender: [] });
    // Selected row gets bg-paper-2 background AND a checked checkbox.
    expect(html).toMatch(/<input type="checkbox" checked style="accent-color: var\(--accent\)/);
    // Unselected row: no "checked" attribute.
    expect(html).toMatch(/<input type="checkbox" {2}style="accent-color: var\(--accent\)/);
  });

  it("shows 'N selected' + Clear link when selection is non-empty", () => {
    const html = renderFacetPartial("fhir", entries, ["Observation.code"], { q: "", fhir: ["Observation.code"], sender: [] });
    expect(html).toContain("1 selected");
    expect(html).toContain("Clear");
  });

  it("builds a toggle URL that removes a selected entry (un-check)", () => {
    const html = renderFacetPartial("fhir", entries, ["Observation.code"], { q: "", fhir: ["Observation.code"], sender: [] });
    // The Observation.code row's href should NOT include fhir=Observation.code
    // — clicking it removes the filter.
    const obsRowMatch = html.match(/href="\/terminology\?[^"]*"[^>]*>[\s\S]*?Observation/);
    expect(obsRowMatch).not.toBeNull();
    // When selected, the toggle URL drops the filter entirely (no fhir= qs)
    expect(obsRowMatch![0]).not.toContain("fhir=Observation.code");
  });

  it("builds a toggle URL that adds a new entry (check)", () => {
    const html = renderFacetPartial("fhir", entries, [], { q: "", fhir: [], sender: [] });
    expect(html).toContain("fhir=Observation.code");
  });

  it("has an Alpine searchable input that hides non-matching rows", () => {
    const html = renderFacetPartial("fhir", entries, [], { q: "", fhir: [], sender: [] });
    expect(html).toContain("x-on:input");
    expect(html).toContain("data-facet-row");
    expect(html).toContain(`data-name="Observation.code"`);
  });
});

// ============================================================================
// renderDetailPartial
// ============================================================================

describe("renderDetailPartial", () => {
  const row: Row = {
    conceptMapId: "cm-a",
    localCode: "GLUC",
    localDisplay: "Glucose",
    localSystem: "LOCAL",
    targetCode: "2345-7",
    targetDisplay: "Glucose [Mass/volume] in Serum or Plasma",
    targetSystem: OBS_CODE,
    sender: "ACME_LAB | HOSP",
    fhirField: "Observation.code",
    hl7Field: "OBX-3",
    mappingType: "observation-code-loinc",
    createdAt: "2024-08-12T10:00:00Z",
  };

  it("renders FHIR target with two-tone typography", () => {
    const html = renderDetailPartial(row);
    expect(html).toContain("Observation");
    expect(html).toContain(".code");
    expect(html).toContain("FHIR target");
  });

  it("renders local code + display + maps-to + standard code + display", () => {
    const html = renderDetailPartial(row);
    expect(html).toContain("GLUC");
    // The local-display line is a plain sentence now (was previously wrapped
    // in serif italic quotes — dropped as part of the typography refresh).
    expect(html).toContain("Glucose");
    expect(html).toContain("MAPS TO".toLowerCase()); // lowercase matches uppercase via CSS
    expect(html).toContain("2345-7");
    expect(html).toContain("Glucose [Mass/volume] in Serum or Plasma");
  });

  it("renders source panel with sender and HL7 field", () => {
    const html = renderDetailPartial(row);
    expect(html).toContain("ACME_LAB | HOSP");
    expect(html).toContain("HL7 OBX-3");
  });

  it("renders lineage with created date", () => {
    const html = renderDetailPartial(row);
    expect(html).toContain("Lineage");
    expect(html).toContain("Mapping created");
    expect(html).toContain("2024-08-12");
  });

  it("Edit button opens the modal via hx-get (Task 12 rewire)", () => {
    const html = renderDetailPartial(row);
    // hx-get points at the modal-partial endpoint. The URL is HTML-escaped
    // via escapeHtml, so `&` becomes `&amp;` in the attribute value.
    expect(html).toContain(`hx-get="/terminology/partials/modal?mode=edit&amp;conceptMapId=cm-a&amp;code=GLUC&amp;localSystem=LOCAL"`);
    expect(html).toContain(`hx-target="#terminology-modal-container"`);
  });

  it("Delete button opens an in-page modal (not window.confirm) and fires hx-post on confirm", () => {
    const html = renderDetailPartial(row);
    // The outer Delete button no longer carries hx-post directly — it only
    // flips the Alpine `confirmDelete` flag. The real hx-post lives on the
    // Delete button *inside* the modal.
    expect(html).toContain(`hx-post="/api/concept-maps/cm-a/entries/GLUC/delete"`);
    expect(html).toContain(`hx-target="#terminology-table"`);
    // Browser prompt is gone; an Alpine-driven modal replaces it.
    expect(html).not.toContain(`hx-confirm="`);
    expect(html).toContain(`x-data="{ confirmDelete: false }"`);
    expect(html).toContain(`x-on:click="confirmDelete = true"`);
    // hx-vals is double-quoted with HTML-escaped JSON (XSS-safe against
    // single-quote injection in localSystem values).
    expect(html).toContain(`hx-vals="{&quot;localSystem&quot;:&quot;LOCAL&quot;}"`);
    // No inline onclick confirm either.
    expect(html).not.toContain("onclick=");
  });

  it("does NOT render a Deprecate button (v1 plan decision)", () => {
    const html = renderDetailPartial(row);
    // Strip HTML comments before checking — the comment "<!-- … no Deprecate per plan -->"
    // is a developer note, not a rendered button.
    const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, "");
    expect(htmlNoComments).not.toContain("Deprecate");
    expect(htmlNoComments).not.toContain(">Deprecate<");
  });

  it("URL-encodes localCode with ^ in hx-post (Delete) and hx-get (Edit)", () => {
    const caret: Row = { ...row, localCode: "UNKNOWN^TEST" };
    const html = renderDetailPartial(caret);
    // Neither hx-post nor hx-get should contain a raw ^.
    expect(html).not.toMatch(/hx-post="[^"]*\^[^"]*"/);
    expect(html).not.toMatch(/hx-get="[^"]*\^[^"]*"/);
    expect(html).toContain("UNKNOWN%5ETEST");
  });
});

// ============================================================================
// Handlers
// ============================================================================

describe("handleTerminologyTablePartial", () => {
  beforeEach(() => {
    mockConceptMaps = [];
  });

  it("returns 200 with table HTML", async () => {
    const req = new Request("http://localhost/terminology/partials/table");
    const res = await handleTerminologyTablePartial(req);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("terminology-table");
  });

  it("respects ?sender= filter", async () => {
    mockConceptMaps = [
      makeConceptMap("cm-a", "LAB_A | X", OBS_CODE, [
        { source: "LOCAL", code: "GLUC", display: "Glucose", tCode: "2345-7", tDisplay: "Glucose" },
      ]),
      makeConceptMap("cm-b", "LAB_B | Y", OBS_CODE, [
        { source: "LOCAL", code: "HGB", display: "Hemoglobin", tCode: "718-7", tDisplay: "Hemoglobin" },
      ]),
    ];
    const req = new Request("http://localhost/terminology/partials/table?sender=LAB_A%20%7C%20X");
    const res = await handleTerminologyTablePartial(req);
    const text = await res.text();
    expect(text).toContain("GLUC");
    expect(text).not.toContain("HGB");
  });

  it("respects ?q= (free-text search) filter", async () => {
    mockConceptMaps = [
      makeConceptMap("cm-a", "LAB | X", OBS_CODE, [
        { source: "LOCAL", code: "GLUC", display: "Glucose", tCode: "2345-7", tDisplay: "Glucose" },
        { source: "LOCAL", code: "HGB", display: "Hemoglobin", tCode: "718-7", tDisplay: "Hemoglobin" },
      ]),
    ];
    const req = new Request("http://localhost/terminology/partials/table?q=glucose");
    const res = await handleTerminologyTablePartial(req);
    const text = await res.text();
    expect(text).toContain("GLUC");
    expect(text).not.toContain("HGB");
  });

  it("respects ?fhir= multi-value filter", async () => {
    mockConceptMaps = [
      makeConceptMap("cm-obs", "LAB | X", OBS_CODE, [
        { source: "LOCAL", code: "GLUC", display: "Glucose", tCode: "2345-7", tDisplay: "Glucose" },
      ]),
      makeConceptMap("cm-enc", "LAB | X", ENC_CLASS, [
        { source: "LOCAL", code: "I", display: "Inpatient", tCode: "IMP", tDisplay: "Inpatient" },
      ]),
    ];
    const req = new Request(
      `http://localhost/terminology/partials/table?fhir=${encodeURIComponent("Observation.code")}`,
    );
    const res = await handleTerminologyTablePartial(req);
    const text = await res.text();
    expect(text).toContain("GLUC");
    expect(text).not.toContain(">I<"); // row-cell open tag; "I" would match "Inpatient" word
    expect(text).not.toContain("Inpatient");
  });
});

describe("handleTerminologyFhirFacet / handleTerminologySenderFacet", () => {
  beforeEach(() => {
    mockConceptMaps = [
      makeConceptMap("cm-a", "LAB_A | X", OBS_CODE, [
        { source: "LOCAL", code: "GLUC", tCode: "2345-7" },
      ]),
      makeConceptMap("cm-b", "LAB_B | Y", ENC_CLASS, [
        { source: "LOCAL", code: "I", tCode: "IMP" },
      ]),
    ];
  });

  it("FHIR facet lists both Observation.code and Encounter.class with counts", async () => {
    const req = new Request("http://localhost/terminology/partials/facets/fhir");
    const res = await handleTerminologyFhirFacet(req);
    const text = await res.text();
    expect(text).toContain("Observation");
    expect(text).toContain("Encounter");
    expect(text).toContain("data-facet-row");
  });

  it("Sender facet lists both sender titles", async () => {
    const req = new Request("http://localhost/terminology/partials/facets/sender");
    const res = await handleTerminologySenderFacet(req);
    const text = await res.text();
    expect(text).toContain("LAB_A");
    expect(text).toContain("LAB_B");
  });
});

describe("handleTerminologyDetailPartial", () => {
  beforeEach(() => {
    mockConceptMaps = [
      makeConceptMap("cm-a", "LAB | X", OBS_CODE, [
        { source: "LOCAL", code: "GLUC", display: "Glucose", tCode: "2345-7", tDisplay: "Glucose [Mass/volume]" },
        { source: "LOCAL", code: "UNKNOWN^TEST", display: "Unknown", tCode: "LP0", tDisplay: "Unknown" },
      ]),
    ];
  });

  it("returns 400 when conceptMapId or code param missing", async () => {
    const req = new Request("http://localhost/terminology/partials/detail//");
    Object.defineProperty(req, "params", { value: {}, writable: false });
    const res = await handleTerminologyDetailPartial(req);
    expect(res.status).toBe(400);
  });

  it("returns empty-detail HTML when row not found", async () => {
    const req = new Request("http://localhost/terminology/partials/detail/cm-a/NOTFOUND?localSystem=LOCAL");
    Object.defineProperty(req, "params", { value: { conceptMapId: "cm-a", code: "NOTFOUND" }, writable: false });
    const res = await handleTerminologyDetailPartial(req);
    const text = await res.text();
    expect(text).toContain("Pick a mapping from the table");
  });

  it("returns detail HTML when row found", async () => {
    const req = new Request("http://localhost/terminology/partials/detail/cm-a/GLUC?localSystem=LOCAL");
    Object.defineProperty(req, "params", { value: { conceptMapId: "cm-a", code: "GLUC" }, writable: false });
    const res = await handleTerminologyDetailPartial(req);
    const text = await res.text();
    expect(text).toContain("GLUC");
    expect(text).toContain("2345-7");
    expect(text).toContain("Observation");
  });

  it("round-trips ^-containing localCode via decodeURIComponent (plan requirement)", async () => {
    const rawCode = "UNKNOWN%5ETEST";
    const req = new Request(`http://localhost/terminology/partials/detail/cm-a/${rawCode}?localSystem=LOCAL`);
    Object.defineProperty(req, "params", { value: { conceptMapId: "cm-a", code: rawCode }, writable: false });
    const res = await handleTerminologyDetailPartial(req);
    const text = await res.text();
    expect(text).toContain("UNKNOWN^TEST");
    expect(text).not.toContain("Pick a mapping"); // not empty state
  });

  it("returns 400 on malformed percent-encoding (does not crash the server)", async () => {
    // "%E0%A4%A" is a truncated UTF-8 sequence — decodeURIComponent throws.
    const rawCode = "%E0%A4%A";
    const req = new Request(
      `http://localhost/terminology/partials/detail/cm-a/${rawCode}?localSystem=LOCAL`,
    );
    Object.defineProperty(req, "params", { value: { conceptMapId: "cm-a", code: rawCode }, writable: false });
    const res = await handleTerminologyDetailPartial(req);
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// Empty state
// ============================================================================

describe("renderEmptyDetail", () => {
  it("renders a placeholder card with instructions", () => {
    const html = renderEmptyDetail();
    expect(html).toContain("terminology-detail");
    expect(html).toContain("Pick a mapping");
  });
});
