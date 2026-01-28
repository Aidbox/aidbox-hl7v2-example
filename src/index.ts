import { aidboxFetch, putResource, type Bundle } from "./aidbox";
import { processNextMessage } from "./bar/sender-service";
import {
  processNextInvoice,
  pollPendingInvoice,
  updateInvoiceStatus,
  getRetryCount,
} from "./bar/invoice-builder-service";
import type { IncomingHL7v2Message } from "./fhir/aidbox-hl7v2-custom";

// Handler Functions from UI Modules
import { handleInvoicesPage, createInvoice } from "./ui/pages/invoices";
import {
  handleOutgoingMessagesPage,
  createOutgoingMessage,
  handleIncomingMessagesPage,
} from "./ui/pages/messages";
import { handleMappingTasksPage } from "./ui/pages/mapping-tasks";
import {
  handleCodeMappingsPage,
  addConceptMapEntry,
  updateConceptMapEntry,
  deleteConceptMapEntry,
} from "./ui/pages/code-mappings";
import { handleMLLPClientPage, sendMLLPTest } from "./ui/pages/mllp-client";

// ============================================================================
// Server
// ============================================================================

Bun.serve({
  port: 3000,
  routes: {
    // =========================================================================
    // UI Routes - HTTP methods are explicit
    // =========================================================================
    "/": handleInvoicesPage,
    "/invoices": {
      GET: handleInvoicesPage,
      POST: createInvoice,
    },
    "/outgoing-messages": {
      GET: handleOutgoingMessagesPage,
      POST: createOutgoingMessage,
    },
    "/incoming-messages": handleIncomingMessagesPage,
    "/mapping/tasks": handleMappingTasksPage,
    "/mapping/table": handleCodeMappingsPage,
    "/mllp-client": {
      GET: handleMLLPClientPage,
      POST: sendMLLPTest,
    },

    // =========================================================================
    // Terminology API (JSON)
    // =========================================================================
    "/api/terminology/loinc": async (req) => {
      const url = new URL(req.url);
      const query = url.searchParams.get("q");
      if (!query || query.length < 2) {
        return Response.json({ results: [] });
      }
      const { searchLoincCodes } = await import("./code-mapping/terminology-api");
      try {
        const results = await searchLoincCodes(query);
        return Response.json({ results });
      } catch (error) {
        console.error("LOINC search error:", error);
        return Response.json({ error: "Search failed" }, { status: 500 });
      }
    },
    "/api/terminology/loinc/:code": async (req) => {
      const url = new URL(req.url);
      const code = url.pathname.split("/").pop();
      if (!code) {
        return Response.json({ error: "Code required" }, { status: 400 });
      }
      const { validateLoincCode } = await import("./code-mapping/terminology-api");
      try {
        const result = await validateLoincCode(code);
        if (result) {
          return Response.json(result);
        }
        return Response.json({ error: "Code not found" }, { status: 404 });
      } catch (error) {
        console.error("LOINC validation error:", error);
        return Response.json({ error: "Validation failed" }, { status: 500 });
      }
    },

    // =========================================================================
    // Task Resolution API
    // =========================================================================
    "/api/mapping/tasks/:id/resolve": {
      POST: async (req) => {
        const taskId = req.params.id;

        if (!taskId) {
          return new Response("Task ID is required", { status: 400 });
        }

        const formData = await req.formData();
        // Support both legacy "loincCode" and new "resolvedCode" parameter names
        const resolvedCode = formData.get("resolvedCode")?.toString() || formData.get("loincCode")?.toString();
        const resolvedDisplay = formData.get("resolvedDisplay")?.toString() || formData.get("loincDisplay")?.toString() || "";

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
          const task = await aidboxFetch<{ code?: { coding?: Array<{ code?: string }> } }>(
            `/fhir/Task/${taskId}`,
          );

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
          const { getMappingTypeName } = await import("./code-mapping/mapping-types");
          const mappingType = getMappingTypeName(taskCode);

          // Validate the resolved code against the target value set
          const { validateResolvedCode } = await import("./code-mapping/validation");
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
          const { resolveTaskAndUpdateMessages } = await import("./ui/mapping-tasks-queue");
          await resolveTaskAndUpdateMessages(taskId, resolvedCode, resolvedDisplay);

          return new Response(null, {
            status: 302,
            headers: { Location: "/mapping/tasks" },
          });
        } catch (error) {
          console.error("Task resolution error:", error);
          const message = error instanceof Error ? error.message : "Resolution failed";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/mapping/tasks?error=${encodeURIComponent(message)}`,
            },
          });
        }
      },
    },

    // =========================================================================
    // ConceptMap Entry API
    // =========================================================================
    "/api/concept-maps/:id/entries": {
      POST: async (req) => {
        const conceptMapId = req.params.id;

        const formData = await req.formData();
        const localCode = formData.get("localCode")?.toString();
        const localDisplay = formData.get("localDisplay")?.toString() || "";
        const localSystem = formData.get("localSystem")?.toString();
        const loincCode = formData.get("loincCode")?.toString();
        const loincDisplay = formData.get("loincDisplay")?.toString() || "";

        if (!localCode || !localSystem || !loincCode) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent("Local code, local system, and LOINC code are required")}`,
            },
          });
        }

        try {
          const result = await addConceptMapEntry(
            conceptMapId,
            localCode,
            localDisplay,
            localSystem,
            loincCode,
            loincDisplay,
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
          const message = error instanceof Error ? error.message : "Failed to add mapping";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(message)}`,
            },
          });
        }
      },
    },
    "/api/concept-maps/:id/entries/:code": {
      POST: async (req) => {
        const conceptMapId = req.params.id;
        const localCode = decodeURIComponent(req.params.code);

        const formData = await req.formData();
        const localSystem = formData.get("localSystem")?.toString();
        const loincCode = formData.get("loincCode")?.toString();
        const loincDisplay = formData.get("loincDisplay")?.toString() || "";

        if (!localSystem || !loincCode) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent("Local system and LOINC code are required")}`,
            },
          });
        }

        try {
          const result = await updateConceptMapEntry(
            conceptMapId,
            localCode,
            localSystem,
            loincCode,
            loincDisplay,
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
          const message = error instanceof Error ? error.message : "Failed to update mapping";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(message)}`,
            },
          });
        }
      },
    },
    "/api/concept-maps/:id/entries/:code/delete": {
      POST: async (req) => {
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
          const message = error instanceof Error ? error.message : "Failed to delete mapping";
          return new Response(null, {
            status: 302,
            headers: {
              Location: `/mapping/table?conceptMapId=${conceptMapId}&error=${encodeURIComponent(message)}`,
            },
          });
        }
      },
    },

    // =========================================================================
    // Action Routes (background processing)
    // =========================================================================
    "/send-messages": {
      POST: async () => {
        let sentCount = 0;
        while (await processNextMessage()) {
          sentCount++;
        }
        return new Response(null, {
          status: 302,
          headers: { Location: "/outgoing-messages" },
        });
      },
    },
    "/build-bar": {
      POST: async () => {
        (async () => {
          while (await pollPendingInvoice()) {
            await processNextInvoice();
          }
        })().catch(console.error);

        return new Response(null, {
          status: 302,
          headers: { Location: "/invoices" },
        });
      },
    },
    "/reprocess-errors": {
      POST: async () => {
        const MAX_RETRIES = 3;

        (async () => {
          let hasMore = true;
          while (hasMore) {
            const bundle = await aidboxFetch<Bundle<{ id?: string }>>(
              "/fhir/Invoice?processing-status=error&_count=100",
            );
            const errorInvoices = bundle.entry?.map((e) => e.resource) || [];

            if (errorInvoices.length === 0) {
              hasMore = false;
            } else {
              for (const invoice of errorInvoices) {
                if (invoice?.id && "resourceType" in invoice) {
                  const currentRetryCount = getRetryCount(invoice as any);
                  const newRetryCount = currentRetryCount + 1;

                  if (newRetryCount >= MAX_RETRIES) {
                    await updateInvoiceStatus(invoice.id, "failed", {
                      retryCount: newRetryCount,
                    });
                  } else {
                    await updateInvoiceStatus(invoice.id, "pending", {
                      retryCount: newRetryCount,
                    });
                  }
                }
              }
            }
          }

          while (await pollPendingInvoice()) {
            await processNextInvoice();
          }
        })().catch(console.error);

        return new Response(null, {
          status: 302,
          headers: { Location: "/invoices" },
        });
      },
    },
    "/process-incoming-messages": {
      POST: async () => {
        (async () => {
          const { processNextMessage } = await import("./v2-to-fhir/processor-service");
          while (await processNextMessage()) {
            // Process until queue empty
          }
        })().catch(console.error);

        return new Response(null, {
          status: 302,
          headers: { Location: "/incoming-messages" },
        });
      },
    },
    "/mark-for-retry/:id": {
      POST: async (req) => {
        const messageId = req.params.id;

        const message = await aidboxFetch<IncomingHL7v2Message>(
          `/fhir/IncomingHL7v2Message/${messageId}`,
        );

        const updated: IncomingHL7v2Message = {
          ...message,
          status: "received",
          error: undefined,
          bundle: undefined,
        };

        await putResource("IncomingHL7v2Message", messageId, updated);

        return new Response(null, {
          status: 302,
          headers: { Location: "/incoming-messages" },
        });
      },
    },
  },
});

console.log("Server running at http://localhost:3000");
