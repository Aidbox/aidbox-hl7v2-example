/**
 * Mapping Tasks API
 *
 * HTTP handlers for mapping task resolution.
 */

import { aidboxFetch } from "../aidbox";
import { getMappingTypeName } from "../code-mapping/mapping-types";
import { validateResolvedCode } from "../code-mapping/validation";
import { resolveTaskAndUpdateMessages } from "../ui/mapping-tasks-queue";

/**
 * Handle task resolution POST request.
 *
 * Expects form data with:
 * - resolvedCode (or legacy loincCode): The resolved target code
 * - resolvedDisplay (or legacy loincDisplay): Display text for the resolved code
 *
 * @param req - Request with params.id containing the task ID
 */
export async function handleTaskResolution(
  req: Request & { params: { id?: string } },
): Promise<Response> {
  const taskId = req.params.id;

  if (!taskId) {
    return new Response("Task ID is required", { status: 400 });
  }

  const formData = await req.formData();
  // Support both legacy "loincCode" and new "resolvedCode" parameter names
  const resolvedCode =
    formData.get("resolvedCode")?.toString() ||
    formData.get("loincCode")?.toString();
  const resolvedDisplay =
    formData.get("resolvedDisplay")?.toString() ||
    formData.get("loincDisplay")?.toString() ||
    "";

  if (!resolvedCode) {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/tasks?error=${encodeURIComponent("Resolved code is required")}`,
      },
    });
  }

  try {
    // Fetch the Task to determine its type
    const task = await aidboxFetch<{
      code?: { coding?: Array<{ code?: string }> };
    }>(`/fhir/Task/${taskId}`);

    const taskCode = task.code?.coding?.[0]?.code;
    if (!taskCode) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/mapping/tasks?error=${encodeURIComponent("Task has no code - cannot determine mapping type")}`,
        },
      });
    }

    // Get the mapping type from the task code
    const mappingType = getMappingTypeName(taskCode);

    // Validate the resolved code against the target value set
    const validationResult = validateResolvedCode(mappingType, resolvedCode);

    if (!validationResult.valid) {
      return new Response(null, {
        status: 302,
        headers: {
          Location: `/mapping/tasks?error=${encodeURIComponent(validationResult.error || "Invalid code")}`,
        },
      });
    }

    // Resolve the task and update affected messages
    await resolveTaskAndUpdateMessages(taskId, resolvedCode, resolvedDisplay);

    return new Response(null, {
      status: 302,
      headers: { Location: "/mapping/tasks" },
    });
  } catch (error) {
    console.error("Task resolution error:", error);
    const message =
      error instanceof Error ? error.message : "Resolution failed";
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/mapping/tasks?error=${encodeURIComponent(message)}`,
      },
    });
  }
}
