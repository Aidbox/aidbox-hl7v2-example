/**
 * DESIGN PROTOTYPE: concept-map-refactoring.md
 *
 * ConceptMap Entries API
 *
 * HTTP handlers for ConceptMap entry CRUD operations.
 * Parses requests, validates input, and delegates to service layer.
 *
 * Pattern follows api/mapping-tasks.ts - thin HTTP layer over business logic.
 */

// DESIGN PROTOTYPE: Import from service layer (not UI)
// import {
//   addConceptMapEntry,
//   updateConceptMapEntry,
//   deleteConceptMapEntry,
// } from "../code-mapping/concept-map/service";

/**
 * DESIGN PROTOTYPE: Handle POST /api/concept-maps/:id/entries
 *
 * Adds a new entry to a ConceptMap.
 * - Parses form data: localCode, localDisplay, localSystem, targetCode, targetDisplay
 * - Validates required fields
 * - Delegates to addConceptMapEntry service function
 * - Returns redirect to /mapping/table with conceptMapId
 */
export async function handleAddEntry(req: Request): Promise<Response> {
  // DESIGN PROTOTYPE: Implementation will be moved from src/index.ts inline handler
  // const conceptMapId = req.params.id;
  // const formData = await req.formData();
  // const localCode = formData.get("localCode")?.toString();
  // const localDisplay = formData.get("localDisplay")?.toString() || "";
  // const localSystem = formData.get("localSystem")?.toString();
  // const targetCode = formData.get("targetCode")?.toString() || formData.get("loincCode")?.toString();
  // const targetDisplay = formData.get("targetDisplay")?.toString() || formData.get("loincDisplay")?.toString() || "";
  //
  // if (!localCode || !localSystem || !targetCode) {
  //   return redirect with error
  // }
  //
  // const result = await addConceptMapEntry(conceptMapId, localCode, localDisplay, localSystem, targetCode, targetDisplay);
  // return redirect based on result.success
  throw new Error("DESIGN PROTOTYPE - not implemented");
}

/**
 * DESIGN PROTOTYPE: Handle POST /api/concept-maps/:id/entries/:code
 *
 * Updates an existing entry in a ConceptMap.
 * - Parses form data: localSystem, targetCode, targetDisplay
 * - URL param :code is the localCode to update
 * - Delegates to updateConceptMapEntry service function
 * - Returns redirect to /mapping/table with conceptMapId
 */
export async function handleUpdateEntry(req: Request): Promise<Response> {
  // DESIGN PROTOTYPE: Implementation will be moved from src/index.ts inline handler
  // const conceptMapId = req.params.id;
  // const localCode = decodeURIComponent(req.params.code);
  // const formData = await req.formData();
  // const localSystem = formData.get("localSystem")?.toString();
  // const targetCode = formData.get("targetCode")?.toString() || formData.get("loincCode")?.toString();
  // const targetDisplay = formData.get("targetDisplay")?.toString() || formData.get("loincDisplay")?.toString() || "";
  //
  // if (!localSystem || !targetCode) {
  //   return redirect with error
  // }
  //
  // const result = await updateConceptMapEntry(conceptMapId, localCode, localSystem, targetCode, targetDisplay);
  // return redirect based on result.success
  throw new Error("DESIGN PROTOTYPE - not implemented");
}

/**
 * DESIGN PROTOTYPE: Handle POST /api/concept-maps/:id/entries/:code/delete
 *
 * Deletes an entry from a ConceptMap.
 * - Parses form data: localSystem
 * - URL param :code is the localCode to delete
 * - Delegates to deleteConceptMapEntry service function
 * - Returns redirect to /mapping/table with conceptMapId
 */
export async function handleDeleteEntry(req: Request): Promise<Response> {
  // DESIGN PROTOTYPE: Implementation will be moved from src/index.ts inline handler
  // const conceptMapId = req.params.id;
  // const localCode = decodeURIComponent(req.params.code);
  // const formData = await req.formData();
  // const localSystem = formData.get("localSystem")?.toString();
  //
  // if (!localSystem) {
  //   return redirect with error
  // }
  //
  // await deleteConceptMapEntry(conceptMapId, localCode, localSystem);
  // return redirect to /mapping/table
  throw new Error("DESIGN PROTOTYPE - not implemented");
}
