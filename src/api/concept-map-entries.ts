/**
 * ConceptMap Entries API
 *
 * HTTP handlers for ConceptMap entry CRUD operations.
 * Parses requests, validates input, and delegates to service layer.
 *
 * Pattern follows api/mapping-tasks.ts - thin HTTP layer over business logic.
 */

import {
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
} from "../code-mapping/concept-map/service";

/**
 * Handle POST /api/concept-maps/:id/entries
 *
 * Adds a new entry to a ConceptMap.
 * - Parses form data: localCode, localDisplay, localSystem, targetCode, targetDisplay
 * - Validates required fields
 * - Delegates to addConceptMapEntry service function
 * - Returns redirect to /mapping/table with conceptMapId
 */
export async function handleAddEntry(
  req: Request & { params: { id: string } },
): Promise<Response> {
  const conceptMapId = req.params.id;

  const formData = await req.formData();
  const localCode = formData.get("localCode")?.toString();
  const localDisplay = formData.get("localDisplay")?.toString() || "";
  const localSystem = formData.get("localSystem")?.toString();
  // Support both old (loincCode) and new (targetCode) field names for backward compatibility
  const targetCode =
    formData.get("targetCode")?.toString() ||
    formData.get("loincCode")?.toString();
  const targetDisplay =
    formData.get("targetDisplay")?.toString() ||
    formData.get("loincDisplay")?.toString() ||
    "";

  if (!localCode || !localSystem || !targetCode) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent("Local code, local system, and target code are required")}`,
      },
    });
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
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(result.error || "Failed to add mapping")}`,
        },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}`,
      },
    });
  } catch (error) {
    console.error("Add mapping error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to add mapping";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(message)}`,
      },
    });
  }
}

/**
 * Handle POST /api/concept-maps/:id/entries/:code
 *
 * Updates an existing entry in a ConceptMap.
 * - Parses form data: localSystem, targetCode, targetDisplay
 * - URL param :code is the localCode to update
 * - Delegates to updateConceptMapEntry service function
 * - Returns redirect to /mapping/table with conceptMapId
 */
export async function handleUpdateEntry(
  req: Request & { params: { id: string; code: string } },
): Promise<Response> {
  const conceptMapId = req.params.id;
  const localCode = decodeURIComponent(req.params.code);

  const formData = await req.formData();
  const localSystem = formData.get("localSystem")?.toString();
  // Support both old (loincCode) and new (targetCode) field names for backward compatibility
  const targetCode =
    formData.get("targetCode")?.toString() ||
    formData.get("loincCode")?.toString();
  const targetDisplay =
    formData.get("targetDisplay")?.toString() ||
    formData.get("loincDisplay")?.toString() ||
    "";

  if (!localSystem || !targetCode) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent("Local system and target code are required")}`,
      },
    });
  }

  try {
    const result = await updateConceptMapEntry(
      conceptMapId,
      localCode,
      localSystem,
      targetCode,
      targetDisplay,
    );

    if (!result.success) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(result.error || "Failed to update mapping")}`,
        },
      });
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}`,
      },
    });
  } catch (error) {
    console.error("Update mapping error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update mapping";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(message)}`,
      },
    });
  }
}

/**
 * Handle POST /api/concept-maps/:id/entries/:code/delete
 *
 * Deletes an entry from a ConceptMap.
 * - Parses form data: localSystem
 * - URL param :code is the localCode to delete
 * - Delegates to deleteConceptMapEntry service function
 * - Returns redirect to /mapping/table with conceptMapId
 */
export async function handleDeleteEntry(
  req: Request & { params: { id: string; code: string } },
): Promise<Response> {
  const conceptMapId = req.params.id;
  const localCode = decodeURIComponent(req.params.code);

  const formData = await req.formData();
  const localSystem = formData.get("localSystem")?.toString();

  if (!localSystem) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent("Local system is required")}`,
      },
    });
  }

  try {
    await deleteConceptMapEntry(conceptMapId, localCode, localSystem);

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}`,
      },
    });
  } catch (error) {
    console.error("Delete mapping error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete mapping";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(message)}`,
      },
    });
  }
}
