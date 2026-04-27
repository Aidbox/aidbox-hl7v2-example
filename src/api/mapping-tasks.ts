/**
 * Mapping Tasks API
 *
 * HTTP handlers for mapping task resolution.
 */

import { aidboxFetch } from "../aidbox";
import { isMappingTypeName } from "../code-mapping/mapping-types";
import { validateResolvedCode } from "../code-mapping/validation";
import { resolveTaskAndUpdateMessages } from "./task-resolution";

/**
 * Build a redirect URL back to /unmapped-codes preserving the caller's
 * selection (so the editor stays populated on validation failure) and
 * attaching an error query param. On success we drop ?code=&sender=
 * because the resolved row is gone from the queue.
 *
 * `savedCode` + `replayedCount` power the post-save success banner so
 * the user can see "Mapped K_SERUM — 6 messages queued for replay."
 */
function buildRedirect(
  error: string | undefined,
  localCode: string | undefined,
  localSender: string | undefined,
  savedCode?: string,
  replayedCount?: number,
  clearOnSuccess?: boolean,
): Response {
  if (!error) {
    const params = new URLSearchParams();
    // `clear=1` suppresses default-select-first on the landing page so the
    // user sees the empty 'Select a code' state. Set when the saved entry
    // was the last in the queue at form-render time (the editor partial
    // appends ?clear=1 to the form action in that case).
    if (clearOnSuccess) {params.set("clear", "1");}
    if (savedCode) {params.set("saved", savedCode);}
    if (typeof replayedCount === "number") {
      params.set("replayed", String(replayedCount));
    }
    const qs = params.toString();
    return new Response(null, {
      status: 302,
      headers: { Location: qs ? `/unmapped-codes?${qs}` : "/unmapped-codes" },
    });
  }
  const params = new URLSearchParams();
  if (localCode) {params.set("code", localCode);}
  if (localSender) {params.set("sender", localSender);}
  params.set("error", error);
  return new Response(null, {
    status: 302,
    headers: { Location: `/unmapped-codes?${params.toString()}` },
  });
}

/**
 * Handle task resolution POST request.
 *
 * Expects form data with:
 * - resolvedCode: The resolved target code
 * - resolvedDisplay: Display text for the resolved code
 * - Optional: localCode, localSender — used to redirect back to the right
 *   editor view on validation failure.
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
  const resolvedCode = formData.get("resolvedCode")?.toString();
  const resolvedDisplay = formData.get("resolvedDisplay")?.toString() || "";
  const localCode = formData.get("localCode")?.toString() || undefined;
  const localSender = formData.get("localSender")?.toString() || undefined;
  // The editor partial appends ?clear=1 to the form action when the user
  // is on the last queue entry — propagated to the success redirect so
  // they land on the empty 'Select a code' state instead of auto-advancing.
  const clearOnSuccess = new URL(req.url).searchParams.has("clear");

  if (!resolvedCode) {
    return buildRedirect("Pick a LOINC code from the suggestions or type one in the search box.", localCode, localSender);
  }

  try {
    // Fetch the Task to determine its type
    const task = await aidboxFetch<{
      code?: { coding?: Array<{ code?: string }> };
    }>(`/fhir/Task/${taskId}`);

    const mappingType = task.code?.coding?.[0]?.code;
    if (!mappingType || !isMappingTypeName(mappingType)) {
      return buildRedirect(
        "Task has invalid mapping type — cannot determine target system",
        localCode,
        localSender,
      );
    }

    // Validate the resolved code against the target value set
    const validationResult = validateResolvedCode(mappingType, resolvedCode);

    if (!validationResult.valid) {
      return buildRedirect(
        `"${resolvedCode}" is not a valid ${mappingType} code — ${validationResult.error || "pick one from the suggestions below"}.`,
        localCode,
        localSender,
      );
    }

    // Resolve the task + auto-replay affected messages. Pass the count
    // back in the redirect so the /unmapped-codes landing can surface
    // "Mapped X — N messages queued for replay" banner.
    const { replayedCount } = await resolveTaskAndUpdateMessages(
      taskId,
      resolvedCode,
      resolvedDisplay,
    );

    return buildRedirect(
      undefined,
      undefined,
      undefined,
      resolvedCode,
      replayedCount,
      clearOnSuccess,
    );
  } catch (error) {
    console.error("Task resolution error:", error);
    const message =
      error instanceof Error ? error.message : "Resolution failed";
    return buildRedirect(message, localCode, localSender);
  }
}
