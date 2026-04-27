/**
 * ConceptMap Entries API
 *
 * HTTP handlers for ConceptMap entry CRUD operations.
 * Parses requests, validates input, and delegates to service layer.
 *
 * Dual-mode response: when the caller sets `HX-Request: true`, the handler
 * returns the refreshed terminology table HTML fragment plus an
 * `HX-Trigger: concept-map-entry-saved` (or `-deleted`) header so the
 * Terminology Map modal can close itself via Alpine `x-on:...window` listeners.
 * Non-htmx callers (tests, direct form posts, legacy links) keep the original
 * `302 → /terminology?conceptMapId=...` behavior.
 */

import {
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
} from "../code-mapping/concept-map/service";
import {
  buildFiltersOnlyTerminologyUrl,
  parseFiltersFromFormData,
  parseFiltersFromReferer,
  renderTableAfterCrud,
  renderTableAndDetailAfterCrud,
} from "../ui/pages/terminology";

// ============================================================================
// htmx branching
// ============================================================================

function isHtmxRequest(req: Request): boolean {
  return req.headers.get("HX-Request") === "true";
}

/**
 * Build the htmx response: refreshed #terminology-table fragment + HX-Trigger
 * event so the modal can close itself. Filters come from the form data (Add/
 * Edit forms include hidden `q`/`fhir`/`sender` via `hx-include`) and fall
 * back to the Referer URL when absent.
 */
async function htmxTableResponse(
  req: Request,
  formData: { get(name: string): unknown },
  triggerEvent: "concept-map-entry-saved" | "concept-map-entry-deleted",
): Promise<Response> {
  const formFilters = parseFiltersFromFormData(formData);
  const hasFormFilters =
    formFilters.q || formFilters.fhir.length || formFilters.sender.length;
  const filters = hasFormFilters
    ? formFilters
    : parseFiltersFromReferer(req.headers.get("Referer"));
  const html = await renderTableAfterCrud(filters);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "HX-Trigger-After-Swap": triggerEvent,
    },
  });
}

/**
 * Like {@link htmxTableResponse} but also OOB-swaps the right-hand
 * `#terminology-detail` panel. Use for Edit (refreshes the panel with the
 * updated row data) and Delete (replaces the panel with the empty-state and
 * pushes a selection-less URL so a refresh doesn't restore the deleted entry).
 *
 * Pass `detailRowKey` for Edit; pass `null` for Delete. `pushFiltersOnlyUrl`
 * triggers an HX-Push-Url that strips `selectedMap/Code/Sys` from the address
 * bar — only meaningful for Delete.
 */
async function htmxTableAndDetailResponse(
  req: Request,
  formData: { get(name: string): unknown },
  triggerEvent: "concept-map-entry-saved" | "concept-map-entry-deleted",
  detailRowKey: { conceptMapId: string; localCode: string; localSystem: string } | null,
  pushFiltersOnlyUrl: boolean,
): Promise<Response> {
  const formFilters = parseFiltersFromFormData(formData);
  const hasFormFilters =
    formFilters.q || formFilters.fhir.length || formFilters.sender.length;
  const filters = hasFormFilters
    ? formFilters
    : parseFiltersFromReferer(req.headers.get("Referer"));
  const html = await renderTableAndDetailAfterCrud(filters, detailRowKey);
  const headers: Record<string, string> = {
    "Content-Type": "text/html",
    // HX-Trigger-After-Swap (not HX-Trigger) — the regular HX-Trigger fires
    // events BEFORE the swap, which causes the modal's
    // `concept-map-entry-saved.window` listener to remove $root before htmx
    // does the OOB swap on `#terminology-detail`. Once the form is detached,
    // htmx's contextElement-rooted lookup for the OOB target fails with
    // oobErrorNoTarget. -After-Swap defers the event until after the swap +
    // OOB completes, keeping the form attached during target resolution.
    "HX-Trigger-After-Swap": triggerEvent,
  };
  if (pushFiltersOnlyUrl) {
    headers["HX-Push-Url"] = buildFiltersOnlyTerminologyUrl(filters);
  }
  return new Response(html, { status: 200, headers });
}

/**
 * Build the htmx error response: re-render the table as-is but attach an
 * HX-Trigger that carries the failure message so Alpine can surface it in
 * the modal. Matches the non-htmx redirect-with-error semantics.
 */
async function htmxErrorResponse(
  req: Request,
  message: string,
): Promise<Response> {
  const filters = parseFiltersFromReferer(req.headers.get("Referer"));
  const html = await renderTableAfterCrud(filters);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html",
      "HX-Trigger": JSON.stringify({ "concept-map-entry-error": { message } }),
    },
  });
}

function redirect(conceptMapId: string, error?: string): Response {
  const qs = new URLSearchParams({ conceptMapId });
  if (error) {qs.set("error", error);}
  return new Response(null, {
    status: 302,
    headers: { Location: `/terminology?${qs.toString()}` },
  });
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Handle POST /api/concept-maps/:id/entries
 *
 * Adds a new entry to a ConceptMap.
 * Form fields: localCode, localDisplay, localSystem, targetCode, targetDisplay.
 */
export async function handleAddEntry(
  req: Request & { params: { id: string } },
): Promise<Response> {
  const conceptMapId = req.params.id;
  const htmx = isHtmxRequest(req);

  const formData = await req.formData();
  const localCode = formData.get("localCode")?.toString();
  const localDisplay = formData.get("localDisplay")?.toString() || "";
  const localSystem = formData.get("localSystem")?.toString();
  const targetCode = formData.get("targetCode")?.toString();
  const targetDisplay = formData.get("targetDisplay")?.toString() || "";

  if (!localCode || !localSystem || !targetCode) {
    const msg = "Local code, local system, and target code are required";
    return htmx ? htmxErrorResponse(req, msg) : redirect(conceptMapId, msg);
  }

  try {
    const result = await addConceptMapEntry(
      conceptMapId,
      localCode,
      localDisplay,
      localSystem,
      targetCode,
      targetDisplay,
    );

    if (!result.success) {
      const msg = result.error || "Failed to add mapping";
      return htmx ? htmxErrorResponse(req, msg) : redirect(conceptMapId, msg);
    }

    return htmx
      ? htmxTableResponse(req, formData, "concept-map-entry-saved")
      : redirect(conceptMapId);
  } catch (error) {
    console.error("Add mapping error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to add mapping";
    return htmx ? htmxErrorResponse(req, message) : redirect(conceptMapId, message);
  }
}

/**
 * Handle POST /api/concept-maps/:id/entries/:code
 *
 * Updates an existing entry. URL param :code is the localCode.
 * Form fields: localSystem, targetCode, targetDisplay.
 */
export async function handleUpdateEntry(
  req: Request & { params: { id: string; code: string } },
): Promise<Response> {
  const conceptMapId = req.params.id;
  const htmx = isHtmxRequest(req);
  let localCode: string;
  try {
    localCode = decodeURIComponent(req.params.code);
  } catch {
    return new Response("Malformed URL", { status: 400 });
  }

  const formData = await req.formData();
  const localSystem = formData.get("localSystem")?.toString();
  const targetCode = formData.get("targetCode")?.toString();
  const targetDisplay = formData.get("targetDisplay")?.toString() || "";
  // localDisplay is the human-readable label for the local code (FHIR
  // ConceptMap `element.display`). It's a legitimate part of the resource,
  // so changes in the modal must reach the server, not be silently dropped.
  const localDisplay = formData.get("localDisplay")?.toString() ?? "";

  if (!localSystem || !targetCode) {
    const msg = "Local system and target code are required";
    return htmx ? htmxErrorResponse(req, msg) : redirect(conceptMapId, msg);
  }

  try {
    const result = await updateConceptMapEntry(
      conceptMapId,
      localCode,
      localSystem,
      targetCode,
      targetDisplay,
      localDisplay,
    );

    if (!result.success) {
      const msg = result.error || "Failed to update mapping";
      return htmx ? htmxErrorResponse(req, msg) : redirect(conceptMapId, msg);
    }

    return htmx
      ? htmxTableAndDetailResponse(
          req,
          formData,
          "concept-map-entry-saved",
          { conceptMapId, localCode, localSystem },
          false,
        )
      : redirect(conceptMapId);
  } catch (error) {
    console.error("Update mapping error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update mapping";
    return htmx ? htmxErrorResponse(req, message) : redirect(conceptMapId, message);
  }
}

/**
 * Handle POST /api/concept-maps/:id/entries/:code/delete
 *
 * Deletes an entry. URL param :code is the localCode.
 * Form fields: localSystem (required).
 */
export async function handleDeleteEntry(
  req: Request & { params: { id: string; code: string } },
): Promise<Response> {
  const conceptMapId = req.params.id;
  const htmx = isHtmxRequest(req);
  let localCode: string;
  try {
    localCode = decodeURIComponent(req.params.code);
  } catch {
    return new Response("Malformed URL", { status: 400 });
  }

  const formData = await req.formData();
  const localSystem = formData.get("localSystem")?.toString();

  if (!localSystem) {
    const msg = "Local system is required";
    return htmx ? htmxErrorResponse(req, msg) : redirect(conceptMapId, msg);
  }

  try {
    await deleteConceptMapEntry(conceptMapId, localCode, localSystem);

    return htmx
      ? htmxTableAndDetailResponse(
          req,
          formData,
          "concept-map-entry-deleted",
          null,
          true,
        )
      : redirect(conceptMapId);
  } catch (error) {
    console.error("Delete mapping error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete mapping";
    return htmx ? htmxErrorResponse(req, message) : redirect(conceptMapId, message);
  }
}
