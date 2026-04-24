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
mock.module("../../../src/ui/pages/terminology", () => ({
  parseFiltersFromFormData: () => ({ q: "", fhir: [], sender: [] }),
  parseFiltersFromReferer: () => ({ q: "", fhir: [], sender: [] }),
  renderTableAfterCrud: async () => `<div id="terminology-table">STUB</div>`,
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

  it("htmx: returns 200 + text/html + HX-Trigger=concept-map-entry-saved on success", async () => {
    const res = await handleAddEntry(
      buildReq({
        params: { id: "cm-a" },
        htmx: true,
        body: { localCode: "X", localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("HX-Trigger")).toBe("concept-map-entry-saved");
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

  it("htmx: returns 200 + HX-Trigger=concept-map-entry-saved", async () => {
    const res = await handleUpdateEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        htmx: true,
        body: { localSystem: "L", targetCode: "1" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("HX-Trigger")).toBe("concept-map-entry-saved");
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

  it("htmx: returns 200 + text/html + HX-Trigger=concept-map-entry-deleted", async () => {
    const res = await handleDeleteEntry(
      buildReq({
        params: { id: "cm-a", code: "GLUC" },
        htmx: true,
        body: { localSystem: "L" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("HX-Trigger")).toBe("concept-map-entry-deleted");
    const body = await res.text();
    expect(body).toContain("terminology-table");
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
