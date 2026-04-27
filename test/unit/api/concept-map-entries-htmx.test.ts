/**
 * Unit tests for Task 12 — htmx-aware CRUD branch of
 * `src/api/concept-map-entries.ts`.
 *
 * Verifies:
 *   - Legacy (non-htmx) callers still receive a 302 → /terminology?...
 *   - htmx callers receive a 200 + HTML fragment + HX-Trigger header
 *   - Error paths on both branches
 *   - Delete round-trip via htmx
 */
import { describe, it, expect, mock, beforeEach } from "bun:test";

// ============================================================================
// Mocks
// ============================================================================

let addResult: { success: boolean; error?: string } = { success: true };
let updateResult: { success: boolean; error?: string } = { success: true };
let deleteFn: () => Promise<void> = async () => undefined;
let addCalls: unknown[] = [];
let updateCalls: unknown[] = [];
let deleteCalls: unknown[] = [];

mock.module("../../../src/code-mapping/concept-map/service", () => ({
  addConceptMapEntry: async (...args: unknown[]) => {
    addCalls.push(args);
    return addResult;
  },
  updateConceptMapEntry: async (...args: unknown[]) => {
    updateCalls.push(args);
    return updateResult;
  },
  deleteConceptMapEntry: async (...args: unknown[]) => {
    deleteCalls.push(args);
    return deleteFn();
  },
  // Not used in these tests, but imported by concept-map-entries.ts via its
  // indirect dependency graph when parseFiltersFromReferer loads terminology.
  listConceptMaps: async () => [],
  detectMappingTypeFromConceptMap: () => null,
  getKnownTargetSystems: () => new Set(["http://loinc.org"]),
}));

// terminology.ts is imported by concept-map-entries.ts for the htmx re-render
// helpers. We stub its CRUD output so tests assert the PLUMBING (HX-Trigger
// headers, 302 vs 200 branch), not the rendered HTML.
// Captured args from the new combined helper so tests can assert that Edit
// passes a row key (table + OOB-refreshed detail) and Delete passes null
// (table + empty-state detail) along with the push-URL flag.
let renderTableAndDetailCalls: Array<{
  detailRowKey: unknown;
}> = [];

mock.module("../../../src/ui/pages/terminology", () => ({
  parseFiltersFromFormData: () => ({ q: "", fhir: [], sender: [] }),
  parseFiltersFromReferer: () => ({ q: "", fhir: [], sender: [] }),
  renderTableAfterCrud: async () => `<div id="terminology-table">STUB</div>`,
  renderTableAndDetailAfterCrud: async (
    _filters: unknown,
    detailRowKey: unknown,
  ) => {
    renderTableAndDetailCalls.push({ detailRowKey });
    return `<div id="terminology-table">STUB</div><div id="terminology-detail" hx-swap-oob="true">DETAIL</div>`;
  },
  buildFiltersOnlyTerminologyUrl: () => "/terminology",
}));

const {
  handleAddEntry,
  handleUpdateEntry,
  handleDeleteEntry,
} = await import("../../../src/api/concept-map-entries");

// ============================================================================
// Helpers
// ============================================================================

function buildReq<P extends Record<string, string>>(opts: {
  url?: string;
  method?: string;
  htmx?: boolean;
  body?: Record<string, string>;
  params: P;
}): Request & { params: P } {
  const body = new URLSearchParams(opts.body ?? {}).toString();
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (opts.htmx) {headers["HX-Request"] = "true";}
  const req = new Request(opts.url ?? "http://localhost/x", {
    method: opts.method ?? "POST",
    body,
    headers,
  }) as Request & { params: P };
  Object.defineProperty(req, "params", { value: opts.params, writable: false });
  return req;
}

// ============================================================================
// handleAddEntry
// ============================================================================

describe("handleAddEntry", () => {
  beforeEach(() => {
    addCalls = [];
    addResult = { success: true };
  });

  it("legacy (no HX-Request): returns 302 to /terminology on success", async () => {
    const res = await handleAddEntry(
      buildReq({
        params: { id: "cm-a" },
        body: { localCode: "X", localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/terminology?conceptMapId=cm-a");
    expect(addCalls).toHaveLength(1);
  });

  it("htmx: returns 200 + text/html + HX-Trigger-After-Swap=concept-map-entry-saved on success", async () => {
    const res = await handleAddEntry(
      buildReq({
        params: { id: "cm-a" },
        htmx: true,
        body: { localCode: "X", localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    // -After-Swap (not the bare HX-Trigger): plain HX-Trigger fires *before*
    // the swap, which removes the modal hosting the form before htmx can
    // resolve the OOB target — see comment in htmxTableAndDetailResponse.
    expect(res.headers.get("HX-Trigger-After-Swap")).toBe("concept-map-entry-saved");
    expect(res.headers.get("HX-Trigger")).toBeNull();
    const body = await res.text();
    expect(body).toContain("terminology-table");
  });

  it("legacy: returns 302 with error in query when required fields missing", async () => {
    const res = await handleAddEntry(
      buildReq({
        params: { id: "cm-a" },
        body: { localCode: "X" }, // missing localSystem + targetCode
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=");
    expect(addCalls).toHaveLength(0);
  });

  it("htmx: surfaces validation error via HX-Trigger JSON detail", async () => {
    const res = await handleAddEntry(
      buildReq({
        params: { id: "cm-a" },
        htmx: true,
        body: { localCode: "X" },
      }),
    );
    expect(res.status).toBe(200);
    const trigger = res.headers.get("HX-Trigger");
    expect(trigger).toContain("concept-map-entry-error");
    expect(trigger).toContain("required");
  });

  it("htmx: service failure is returned via concept-map-entry-error trigger", async () => {
    addResult = { success: false, error: "Already exists" };
    const res = await handleAddEntry(
      buildReq({
        params: { id: "cm-a" },
        htmx: true,
        body: { localCode: "X", localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("HX-Trigger")).toContain("Already exists");
  });
});

// ============================================================================
// handleUpdateEntry
// ============================================================================

describe("handleUpdateEntry", () => {
  beforeEach(() => {
    updateCalls = [];
    updateResult = { success: true };
    renderTableAndDetailCalls = [];
  });

  it("legacy: returns 302 to /terminology on success", async () => {
    const res = await handleUpdateEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        body: { localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(302);
    expect(updateCalls).toHaveLength(1);
  });

  it("htmx: returns 200 + HX-Trigger-After-Swap=concept-map-entry-saved + OOB detail body", async () => {
    const res = await handleUpdateEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        htmx: true,
        body: { localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(200);
    // -After-Swap so the modal closes AFTER the OOB swap on
    // #terminology-detail completes; otherwise htmx loses its rootNode.
    expect(res.headers.get("HX-Trigger-After-Swap")).toBe("concept-map-entry-saved");
    expect(res.headers.get("HX-Trigger")).toBeNull();
    // No URL push on update — the row identity is unchanged.
    expect(res.headers.get("HX-Push-Url")).toBeNull();
    const body = await res.text();
    expect(body).toContain("terminology-detail");
    expect(body).toContain('hx-swap-oob="true"');
    // Update routes the post-CRUD render through the table+detail helper with
    // a row key so the right-hand panel re-renders the just-edited row.
    expect(renderTableAndDetailCalls).toHaveLength(1);
    expect(renderTableAndDetailCalls[0]?.detailRowKey).toEqual({
      conceptMapId: "cm-a",
      localCode: "GLUC",
      localSystem: "L",
    });
  });

  it("decodes ^-containing localCode from params", async () => {
    await handleUpdateEntry(
      buildReq({
        params: { id: "cm-a", code: encodeURIComponent("UNKNOWN^TEST") },
        htmx: true,
        body: { localSystem: "L", targetCode: "1" },
      }),
    );
    // 6th arg is localDisplay (new — Task 13+ regression fix: edit
    // modal's "Local display" input now reaches the service instead of
    // being silently dropped).
    expect(updateCalls[0]).toEqual(["cm-a", "UNKNOWN^TEST", "L", "1", "", ""]);
  });

  it("returns 400 on malformed percent-encoding in code param", async () => {
    const res = await handleUpdateEntry(
      buildReq({
        params: { id: "cm-a", code: "%E0%A4%A" }, // truncated UTF-8
        body: { localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(400);
  });
});

// ============================================================================
// handleDeleteEntry
// ============================================================================

describe("handleDeleteEntry", () => {
  beforeEach(() => {
    deleteCalls = [];
    deleteFn = async () => undefined;
    renderTableAndDetailCalls = [];
  });

  it("legacy: returns 302 on success", async () => {
    const res = await handleDeleteEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        body: { localSystem: "L" },
      }),
    );
    expect(res.status).toBe(302);
    expect(deleteCalls).toHaveLength(1);
  });

  it("htmx: returns 200 + text/html + HX-Trigger-After-Swap=concept-map-entry-deleted + OOB empty-state + HX-Push-Url", async () => {
    const res = await handleDeleteEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        htmx: true,
        body: { localSystem: "L" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    // -After-Swap: same reason as update — the delete confirm modal hosts
    // the requesting button, so the close listener must fire post-OOB.
    expect(res.headers.get("HX-Trigger-After-Swap")).toBe("concept-map-entry-deleted");
    expect(res.headers.get("HX-Trigger")).toBeNull();
    // Drop selectedMap/Code/Sys from the address bar so a refresh after
    // delete doesn't try to restore the now-gone selection.
    expect(res.headers.get("HX-Push-Url")).toBe("/terminology");
    const body = await res.text();
    expect(body).toContain("terminology-table");
    expect(body).toContain("terminology-detail");
    // null detailRowKey forces the empty-state placeholder.
    expect(renderTableAndDetailCalls).toHaveLength(1);
    expect(renderTableAndDetailCalls[0]?.detailRowKey).toBeNull();
  });

  it("htmx + missing localSystem: returns 200 with concept-map-entry-error trigger", async () => {
    const res = await handleDeleteEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        htmx: true,
        body: {},
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("HX-Trigger")).toContain("concept-map-entry-error");
    expect(deleteCalls).toHaveLength(0);
  });

  it("htmx + service throws: returns 200 with error trigger (table stays rendered)", async () => {
    deleteFn = async () => {
      throw new Error("boom");
    };
    const res = await handleDeleteEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        htmx: true,
        body: { localSystem: "L" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("HX-Trigger")).toContain("boom");
  });
});
