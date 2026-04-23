import { aidboxFetch, putResource, type Bundle } from "./aidbox";
import { processNextMessage } from "./bar/sender-service";
import {
  processNextAccount,
  pollPendingAccount,
  updateAccountStatus,
  getRetryCount,
} from "./bar/account-builder-service";
import type { IncomingHL7v2Message } from "./fhir/aidbox-hl7v2-custom";

// Handler Functions from UI Modules
import { handleAccountsPage, createAccount } from "./ui/pages/accounts";
import {
  handleOutgoingMessagesPage,
  createOutgoingMessage,
  handleIncomingMessagesPage,
} from "./ui/pages/messages";
import { handleMappingTasksPage } from "./ui/pages/mapping-tasks";
import { handleCodeMappingsPage } from "./ui/pages/code-mappings";
import { highlightHL7WithDataTooltip } from "./ui/shared-layout";
import {
  handleAddEntry,
  handleUpdateEntry,
  handleDeleteEntry,
} from "./api/concept-map-entries";
import { handleMLLPClientPage, sendMLLPTest } from "./ui/pages/mllp-client";
import { handleTaskResolution } from "./api/mapping-tasks";
import { searchLoincCodes, validateLoincCode } from "./code-mapping/terminology-api";
import { processNextMessage as processNextV2ToFhirMessage } from "./v2-to-fhir/processor-service";
import {
  startAllPollingServices,
  isPollingDisabled,
  type WorkersHandle,
} from "./workers";
import { handleStaticAsset } from "./ui/static";

// ============================================================================
// Server
// ============================================================================

Bun.serve({
  port: 3000,
  routes: {
    // =========================================================================
    // UI Routes - HTTP methods are explicit
    // =========================================================================
    "/": handleAccountsPage,
    "/accounts": {
      GET: handleAccountsPage,
      POST: createAccount,
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
    // Static Assets (vendored JS/CSS/fonts under public/)
    // =========================================================================
    "/static/*": { GET: handleStaticAsset },

    // =========================================================================
    // Terminology API (JSON)
    // =========================================================================
    "/api/terminology/loinc": async (req) => {
      const url = new URL(req.url);
      const query = url.searchParams.get("q");
      if (!query || query.length < 2) {
        return Response.json({ results: [] });
      }
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
    // Health
    // =========================================================================
    "/api/health": async () => {
      const start = performance.now();
      try {
        await aidboxFetch("/fhir/metadata", {
          signal: AbortSignal.timeout(1500),
        });
        return Response.json({
          ok: true,
          aidbox: "up",
          ms: Math.round(performance.now() - start),
        });
      } catch (error) {
        return Response.json({
          ok: false,
          aidbox: "down",
          ms: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    // =========================================================================
    // HL7v2 Highlight API
    // =========================================================================
    "/api/hl7v2/highlight": {
      POST: async (req) => {
        const { message } = (await req.json()) as { message: string };
        return Response.json({ html: highlightHL7WithDataTooltip(message) });
      },
    },

    // =========================================================================
    // Task Resolution API
    // =========================================================================
    "/api/mapping/tasks/:id/resolve": {
      POST: handleTaskResolution,
    },

    // =========================================================================
    // ConceptMap Entry API
    // =========================================================================
    "/api/concept-maps/:id/entries": { POST: handleAddEntry },
    "/api/concept-maps/:id/entries/:code": { POST: handleUpdateEntry },
    "/api/concept-maps/:id/entries/:code/delete": { POST: handleDeleteEntry },

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
          while (await pollPendingAccount()) {
            await processNextAccount();
          }
        })().catch(console.error);

        return new Response(null, {
          status: 302,
          headers: { Location: "/accounts" },
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
              "/fhir/Account?processing-status=error&_count=100",
            );
            const errorAccounts = bundle.entry?.map((e) => e.resource) || [];

            if (errorAccounts.length === 0) {
              hasMore = false;
            } else {
              for (const account of errorAccounts) {
                if (account?.id && "resourceType" in account) {
                  const currentRetryCount = getRetryCount(account as any);
                  const newRetryCount = currentRetryCount + 1;

                  if (newRetryCount >= MAX_RETRIES) {
                    await updateAccountStatus(account.id, "failed", {
                      retryCount: newRetryCount,
                    });
                  } else {
                    await updateAccountStatus(account.id, "pending", {
                      retryCount: newRetryCount,
                    });
                  }
                }
              }
            }
          }

          while (await pollPendingAccount()) {
            await processNextAccount();
          }
        })().catch(console.error);

        return new Response(null, {
          status: 302,
          headers: { Location: "/accounts" },
        });
      },
    },
    "/process-incoming-messages": {
      POST: async () => {
        (async () => {
          let hasMore = true;
          while (hasMore) {
            try {
              hasMore = await processNextV2ToFhirMessage();
            } catch (error) {
              // Error already recorded on the message by processNextMessage.
              // Log and continue to process remaining messages.
              console.error("Error processing message (continuing):", error instanceof Error ? error.message : error);
            }
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
          entries: undefined,
        };

        await putResource("IncomingHL7v2Message", messageId, updated);

        return new Response(null, {
          status: 302,
          headers: { Location: "/incoming-messages" },
        });
      },
    },
    "/mark-batch-for-retry/:batchTag": {
      POST: async (req) => {
        const batchTag = decodeURIComponent(req.params.batchTag);
        const erroredStatuses = [
          "parsing_error",
          "conversion_error",
          "code_mapping_error",
          "sending_error",
        ].join(",");

        let requeued = 0;
        // Page until empty: each requeue flips status=received, removing the
        // message from this query, so looping drains the errored set.
        while (true) {
          const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
            `/fhir/IncomingHL7v2Message?batch-tag=${encodeURIComponent(batchTag)}&status=${erroredStatuses}&_count=100`,
          );
          const batch = bundle.entry?.map((e) => e.resource) ?? [];
          if (batch.length === 0) break;

          for (const msg of batch) {
            if (!msg.id) continue;
            const updated: IncomingHL7v2Message = {
              ...msg,
              status: "received",
              error: undefined,
              entries: undefined,
            };
            await putResource("IncomingHL7v2Message", msg.id, updated);
            requeued++;
          }
        }

        console.log(`[batch retry] requeued ${requeued} message(s) in batch ${batchTag}`);

        return new Response(null, {
          status: 302,
          headers: {
            Location: `/incoming-messages?batch=${encodeURIComponent(batchTag)}`,
          },
        });
      },
    },
    "/defer/:id": {
      POST: async (req) => {
        const messageId = req.params.id;

        const message = await aidboxFetch<IncomingHL7v2Message>(
          `/fhir/IncomingHL7v2Message/${messageId}`,
        );

        const updated: IncomingHL7v2Message = {
          ...message,
          status: "deferred",
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

// `bun --hot` re-executes this module on every save. Without this, each reload
// starts a new set of polling services without stopping the previous set,
// leaking poll loops. Cache the handle on globalThis so reloads can stop the
// prior instance before starting a new one.
const globalState = globalThis as typeof globalThis & {
  __workers?: WorkersHandle | null;
};

globalState.__workers?.stop();

if (isPollingDisabled()) {
  globalState.__workers = null;
  console.log("[workers] skipped (DISABLE_POLLING=1)");
} else {
  globalState.__workers = startAllPollingServices();
}

function shutdown(signal: string): void {
  console.log(`\n[server] received ${signal}, shutting down...`);
  globalState.__workers?.stop();
  process.exit(0);
}

process.removeAllListeners("SIGINT");
process.removeAllListeners("SIGTERM");
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
