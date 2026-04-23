/**
 * Messages UI Module
 *
 * Displays Outgoing and Incoming HL7v2 messages pages.
 */

import { highlightHL7WithDataTooltip } from "../shared-layout";
import type {
  OutgoingBarMessage,
  IncomingHL7v2Message,
  UnmappedCode,
} from "../../fhir/aidbox-hl7v2-custom";
import type { Patient } from "../../fhir/hl7-fhir-r4-core/Patient";
import { aidboxFetch, getResources, type Bundle } from "../../aidbox";
import { escapeHtml } from "../../utils/html";
import { renderShell, renderLegacyBody } from "../shell";
import { htmlResponse, redirectResponse, getNavData, type NavData } from "../shared";
import { PAGE_SIZE } from "../pagination";

// ============================================================================
// Types (internal)
// ============================================================================

interface AccountRef {
  id: string;
  status: string;
}

interface MessageListItem {
  id: string;
  statusBadge: { text: string; class: string };
  meta: string[];
  hl7Message: string | undefined;
  error?: string;
  entries?: string;
  retryUrl?: string;
  unmappedCodes?: UnmappedCode[];
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleOutgoingMessagesPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || undefined;

  const [messages, patients, accountsResult, navData] = await Promise.all([
    getOutgoingMessages(statusFilter),
    getPatients(),
    getAccountRefs(),
    getNavData(),
  ]);

  return htmlResponse(
    renderOutgoingMessagesPage(navData, messages, patients, accountsResult.accounts, statusFilter),
  );
}

export async function createOutgoingMessage(req: Request): Promise<Response> {
  const formData = await req.formData();
  const patient = formData.get("patient") as string;
  const account = formData.get("account") as string;
  const hl7v2 = formData.get("hl7v2") as string;

  const newMessage = {
    resourceType: "OutgoingBarMessage",
    patient: { reference: patient },
    account: { reference: account },
    status: "pending",
    ...(hl7v2 && { hl7v2 }),
  };

  await aidboxFetch("/fhir/OutgoingBarMessage", {
    method: "POST",
    body: JSON.stringify(newMessage),
  });

  return redirectResponse("/outgoing-messages");
}

export async function handleIncomingMessagesPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || undefined;
  const batchFilter = url.searchParams.get("batch") || undefined;

  const [messages, batchSummary, batches, navData] = await Promise.all([
    getIncomingMessages(statusFilter, batchFilter),
    // When a batch is active, load *all* of it (not just the status slice)
    // so the summary shows full counts by status.
    batchFilter ? getIncomingMessages(undefined, batchFilter) : Promise.resolve([]),
    getDistinctBatches(),
    getNavData(),
  ]);

  return htmlResponse(
    renderIncomingMessagesPage(navData, messages, batchSummary, batches, statusFilter, batchFilter),
  );
}

// ============================================================================
// Helper Functions (internal)
// ============================================================================

function formatError(error: string): string {
  // Try to extract and format JSON from error message
  const jsonMatch = error.match(/^(HTTP \d+): (.+)$/s);
  if (jsonMatch && jsonMatch[2]) {
    const [, prefix, jsonStr] = jsonMatch;
    try {
      const parsed = JSON.parse(jsonStr);
      return `${prefix}:\n${JSON.stringify(parsed, null, 2)}`;
    } catch {
      return error;
    }
  }

  // Try to parse as pure JSON
  try {
    const parsed = JSON.parse(error);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return error;
  }
}

// ============================================================================
// Service Functions (internal)
// ============================================================================

const getPatients = () => getResources<Patient>("Patient");

async function getAccountRefs(): Promise<{ accounts: AccountRef[]; total: number }> {
  const bundle = await aidboxFetch<Bundle<AccountRef>>(`/fhir/Account?_sort=-lastUpdated&_count=${PAGE_SIZE}`);
  return {
    accounts: bundle.entry?.map((e) => e.resource) || [],
    total: bundle.total ?? 0,
  };
}

const getOutgoingMessages = (status?: string) =>
  getResources<OutgoingBarMessage>(
    "OutgoingBarMessage",
    `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`,
  );

const getIncomingMessages = (status?: string, batchTag?: string) => {
  // Batch mode can contain large imports — pull up to 1000 per page so the
  // grouping summary is accurate. FHIR _count cap varies; Aidbox allows this.
  const count = batchTag ? 1000 : 100;
  const params: string[] = [`_sort=-_lastUpdated`, `_count=${count}`];
  if (status) params.push(`status=${status}`);
  if (batchTag) params.push(`batch-tag=${encodeURIComponent(batchTag)}`);
  return aidboxFetch<Bundle<IncomingHL7v2Message>>(
    `/fhir/IncomingHL7v2Message?${params.join("&")}`,
  ).then((bundle) => bundle.entry?.map((e) => e.resource) || []);
};

async function getDistinctBatches(): Promise<string[]> {
  // Fetch recent batch tags. Aidbox doesn't support DISTINCT natively, so we
  // pull the most recent slice of messages and dedupe in memory.
  const bundle = await aidboxFetch<Bundle<Pick<IncomingHL7v2Message, "batchTag">>>(
    `/fhir/IncomingHL7v2Message?_sort=-_lastUpdated&_count=500&_elements=batchTag`,
  );
  const tags = new Set<string>();
  for (const entry of bundle.entry ?? []) {
    if (entry.resource.batchTag) tags.add(entry.resource.batchTag);
  }
  return [...tags].sort().reverse();
}

// ============================================================================
// Rendering Functions (internal)
// ============================================================================

function renderMessageList(items: MessageListItem[]): string {
  if (items.length === 0) {
    return '<li class="bg-white rounded-lg shadow p-8 text-center text-gray-500">No messages found</li>';
  }

  return items
    .map(
      (item) => `
    <li class="bg-white rounded-lg shadow">
      <details class="group">
        <summary class="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-gray-50 rounded-lg">
          <div class="flex items-center gap-3">
            <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
            <span class="font-mono text-sm font-medium">${item.id}</span>
            <span class="px-2 py-1 rounded-full text-xs font-medium ${item.statusBadge.class}">${item.statusBadge.text}</span>
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-500">
            ${item.meta.map((m) => `<span>${m}</span>`).join("")}
          </div>
        </summary>
        <div class="px-4 pb-4">
          ${
            item.retryUrl
              ? `
            <form method="POST" action="${item.retryUrl}" class="mb-3">
              <button type="submit" class="px-3 py-1.5 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600 flex items-center gap-1.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                Mark for Retry
              </button>
            </form>
          `
              : ""
          }
          ${
            item.error
              ? `
            <details class="mb-3" open>
              <summary class="cursor-pointer text-sm font-medium text-red-700 hover:text-red-800">Error</summary>
              <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded font-mono text-xs overflow-x-auto whitespace-pre">${escapeHtml(formatError(item.error))}</div>
            </details>
          `
              : ""
          }
          ${
            item.unmappedCodes?.length
              ? `
            <details class="mb-3" open>
              <summary class="cursor-pointer text-sm font-medium text-yellow-700 hover:text-yellow-800">Unmapped Codes (${item.unmappedCodes.length})</summary>
              <div class="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <ul class="space-y-1 text-sm">
                  ${item.unmappedCodes
                    .map(
                      (code) => `
                    <li class="flex items-center justify-between">
                      <span>
                        <code class="font-mono text-yellow-800">${escapeHtml(code.localCode)}</code>
                        ${code.localDisplay ? `<span class="text-gray-600">(${escapeHtml(code.localDisplay)})</span>` : ""}
                        ${code.localSystem ? `<span class="text-gray-400">- ${escapeHtml(code.localSystem)}</span>` : ""}
                      </span>
                      <a href="/unmapped-codes" class="text-blue-600 hover:text-blue-800 text-xs">View Tasks →</a>
                    </li>
                  `,
                    )
                    .join("")}
                </ul>
              </div>
            </details>
          `
              : ""
          }
          <div class="hl7-message-container p-3 bg-gray-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${highlightHL7WithDataTooltip(item.hl7Message)}</div>
          ${
            item.entries
              ? `
            <details class="mt-3">
              <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">FHIR Resources</summary>
              <div class="mt-2 p-3 bg-blue-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${escapeHtml(item.entries)}</div>
            </details>
          `
              : ""
          }
        </div>
      </details>
    </li>
  `,
    )
    .join("");
}

function renderOutgoingMessagesPage(
  navData: NavData,
  messages: OutgoingBarMessage[],
  patients: Patient[],
  accounts: AccountRef[],
  statusFilter?: string,
): string {
  const listItems: MessageListItem[] = messages.map((msg) => ({
    id: msg.id ?? "",
    statusBadge: {
      text: msg.status,
      class:
        msg.status === "sent"
          ? "bg-green-100 text-green-800"
          : msg.status === "pending"
            ? "bg-yellow-100 text-yellow-800"
            : msg.status === "error"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800",
    },
    meta: [
      msg.patient?.reference?.replace("Patient/", "") || "-",
      msg.account?.reference?.replace("Account/", "") || "-",
      msg.meta?.lastUpdated
        ? new Date(msg.meta.lastUpdated).toLocaleString()
        : "-",
    ],
    hl7Message: msg.hl7v2,
  }));

  const pendingCount = messages.filter((m) => m.status === "pending").length;

  const statuses = ["pending", "sent", "error"];

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">Outgoing Messages</h1>
      <div class="flex gap-2">
        <button onclick="document.getElementById('add-form').classList.toggle('hidden')" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Message
        </button>
        <form method="POST" action="/send-messages">
          <button type="submit" ${pendingCount === 0 ? "disabled" : ""} class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            Send Pending (${pendingCount})
          </button>
        </form>
      </div>
    </div>

    <div class="mb-4 flex gap-2">
      <a href="/outgoing-messages" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        All
      </a>
      ${statuses
        .map(
          (s) => `
        <a href="/outgoing-messages?status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </a>
      `,
        )
        .join("")}
    </div>

    <div id="add-form" class="hidden mb-6 bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Outgoing Message</h2>
      <form method="POST" action="/outgoing-messages" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select name="patient" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Select a patient...</option>
            ${patients
              .map((p) => {
                const name = p.name?.[0];
                const displayName = name
                  ? `${name.given?.join(" ") || ""} ${name.family || ""}`.trim()
                  : p.id;
                return `<option value="Patient/${p.id}">${displayName} (${p.id})</option>`;
              })
              .join("")}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Account</label>
          <select name="account" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Select an account...</option>
            ${accounts.map((acct) => `<option value="Account/${acct.id}">${acct.id} (${acct.status})</option>`).join("")}
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">HL7v2 Message</label>
          <textarea name="hl7v2" rows="5" placeholder="MSH|^~\\&|..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"></textarea>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
            Create Message
          </button>
          <button type="button" onclick="document.getElementById('add-form').classList.add('hidden')" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">
            Cancel
          </button>
        </div>
      </form>
    </div>

    <ul class="space-y-2">
      ${renderMessageList(listItems)}
    </ul>
    <p class="mt-4 text-sm text-gray-500">Total: ${messages.length} messages</p>`;

  return renderShell({
    active: "outgoing",
    title: "Outgoing Messages",
    content: renderLegacyBody(content),
    navData,
  });
}

const INCOMING_STATUSES = [
  "received",
  "processed",
  "warning",
  "parsing_error",
  "conversion_error",
  "code_mapping_error",
  "sending_error",
  "deferred",
] as const;

const ERROR_STATUSES = new Set([
  "parsing_error",
  "conversion_error",
  "code_mapping_error",
  "sending_error",
]);

function getIncomingStatusBadgeClass(status: string | undefined): string {
  switch (status) {
    case "processed":
      return "bg-green-100 text-green-800";
    case "warning":
      return "bg-amber-100 text-amber-800";
    case "parsing_error":
    case "conversion_error":
      return "bg-red-100 text-red-800";
    case "code_mapping_error":
      return "bg-yellow-100 text-yellow-800";
    case "sending_error":
      return "bg-orange-100 text-orange-800";
    case "deferred":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-blue-100 text-blue-800";
  }
}

function formatIncomingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    parsing_error: "Parsing Error",
    conversion_error: "Conversion Error",
    code_mapping_error: "Code Mapping Error",
    sending_error: "Sending Error",
    deferred: "Deferred",
  };
  return labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1);
}

function buildIncomingMessagesUrl(
  statusFilter?: string,
  batchFilter?: string,
): string {
  const params = new URLSearchParams();
  if (batchFilter) params.set("batch", batchFilter);
  if (statusFilter) params.set("status", statusFilter);
  const qs = params.toString();
  return qs ? `/incoming-messages?${qs}` : "/incoming-messages";
}

// Group errored messages by status + type for the batch summary.
function groupErrorsForSummary(
  messages: IncomingHL7v2Message[],
): Array<{ status: string; type: string; count: number; sampleError?: string }> {
  const groups = new Map<
    string,
    { status: string; type: string; count: number; sampleError?: string }
  >();
  for (const msg of messages) {
    const status = msg.status ?? "received";
    if (!ERROR_STATUSES.has(status)) continue;
    const key = `${status}|${msg.type}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
    } else {
      groups.set(key, {
        status,
        type: msg.type,
        count: 1,
        sampleError: msg.error,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function renderBatchSummary(
  batchFilter: string,
  batchMessages: IncomingHL7v2Message[],
): string {
  const countsByStatus = new Map<string, number>();
  for (const msg of batchMessages) {
    const status = msg.status ?? "received";
    countsByStatus.set(status, (countsByStatus.get(status) ?? 0) + 1);
  }
  const total = batchMessages.length;
  const errorGroups = groupErrorsForSummary(batchMessages);
  const erroredTotal = errorGroups.reduce((sum, g) => sum + g.count, 0);

  const statusChips = [...countsByStatus.entries()]
    .sort()
    .map(
      ([status, count]) => `
        <a href="${buildIncomingMessagesUrl(status, batchFilter)}"
           class="px-2 py-1 rounded-full text-xs font-medium ${getIncomingStatusBadgeClass(status)} hover:opacity-80">
          ${formatIncomingStatusLabel(status)}: ${count}
        </a>`,
    )
    .join("");

  const errorGroupRows = errorGroups
    .map(
      (g) => `
        <tr class="border-t border-gray-200">
          <td class="px-3 py-2">
            <span class="px-2 py-1 rounded-full text-xs font-medium ${getIncomingStatusBadgeClass(g.status)}">
              ${formatIncomingStatusLabel(g.status)}
            </span>
          </td>
          <td class="px-3 py-2 font-mono text-sm">${escapeHtml(g.type)}</td>
          <td class="px-3 py-2 text-sm text-gray-700">${g.count}</td>
          <td class="px-3 py-2 text-xs text-gray-500 truncate max-w-xl" title="${escapeHtml(g.sampleError ?? "")}">
            ${escapeHtml((g.sampleError ?? "").split("\n")[0] ?? "")}
          </td>
        </tr>`,
    )
    .join("");

  const retryAllForm = erroredTotal
    ? `
      <form method="POST" action="/mark-batch-for-retry/${encodeURIComponent(batchFilter)}">
        <button type="submit"
          class="px-3 py-1.5 bg-amber-500 text-white rounded text-sm font-medium hover:bg-amber-600">
          Retry all ${erroredTotal} errored
        </button>
      </form>`
    : "";

  return `
    <div class="mb-4 p-4 bg-white rounded-lg shadow">
      <div class="flex items-center justify-between mb-3">
        <div>
          <div class="text-sm text-gray-500">Active batch</div>
          <div class="text-lg font-semibold font-mono">${escapeHtml(batchFilter)}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm text-gray-500">${total} message(s)</span>
          ${retryAllForm}
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mb-3">${statusChips}</div>
      ${
        errorGroupRows
          ? `
        <details open>
          <summary class="cursor-pointer text-sm font-medium text-gray-700">
            Error groups (${errorGroups.length})
          </summary>
          <div class="mt-2 overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-gray-600">
                <tr>
                  <th class="px-3 py-2 text-left">Status</th>
                  <th class="px-3 py-2 text-left">Type</th>
                  <th class="px-3 py-2 text-left">Count</th>
                  <th class="px-3 py-2 text-left">Sample error</th>
                </tr>
              </thead>
              <tbody>${errorGroupRows}</tbody>
            </table>
          </div>
        </details>`
          : `<p class="text-sm text-green-700">No errored messages in this batch.</p>`
      }
    </div>`;
}

function renderIncomingMessagesPage(
  navData: NavData,
  messages: IncomingHL7v2Message[],
  batchMessages: IncomingHL7v2Message[],
  batches: string[],
  statusFilter?: string,
  batchFilter?: string,
): string {
  const listItems: MessageListItem[] = messages.map((msg) => ({
    id: msg.id ?? "",
    statusBadge: {
      text: formatIncomingStatusLabel(msg.status || "received"),
      class: getIncomingStatusBadgeClass(msg.status),
    },
    meta: [
      msg.type,
      msg.patient?.reference?.replace("Patient/", "") || "-",
      msg.meta?.lastUpdated
        ? new Date(msg.meta.lastUpdated).toLocaleString()
        : "-",
    ],
    hl7Message: msg.message,
    error: msg.error,
    entries: msg.entries?.length ? JSON.stringify(msg.entries, null, 2) : undefined,
    retryUrl:
      (msg.status === "parsing_error" || msg.status === "conversion_error" || msg.status === "code_mapping_error" || msg.status === "sending_error" || msg.status === "warning" || msg.status === "deferred") && msg.id
        ? `/mark-for-retry/${msg.id}`
        : undefined,
    unmappedCodes: msg.status === "code_mapping_error" ? msg.unmappedCodes : undefined,
  }));

  const batchSelector = batches.length
    ? `
      <form method="GET" action="/incoming-messages" class="flex items-center gap-2">
        ${statusFilter ? `<input type="hidden" name="status" value="${escapeHtml(statusFilter)}">` : ""}
        <label class="text-sm text-gray-600">Batch:</label>
        <select name="batch" onchange="this.form.submit()"
          class="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">(all)</option>
          ${batches
            .map(
              (b) => `
            <option value="${escapeHtml(b)}" ${b === batchFilter ? "selected" : ""}>
              ${escapeHtml(b)}
            </option>`,
            )
            .join("")}
        </select>
      </form>`
    : "";

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Inbound Messages</h1>

    ${batchFilter ? renderBatchSummary(batchFilter, batchMessages) : ""}

    <div class="mb-4 flex gap-2 items-center justify-between flex-wrap">
      <div class="flex gap-2 items-center flex-wrap">
        <a href="${buildIncomingMessagesUrl(undefined, batchFilter)}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          All
        </a>
        ${INCOMING_STATUSES
          .map(
            (s) => `
          <a href="${buildIncomingMessagesUrl(s, batchFilter)}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
            ${formatIncomingStatusLabel(s)}
          </a>
        `,
          )
          .join("")}
      </div>
      <div class="flex gap-3 items-center">
        ${batchSelector}
        <form method="POST" action="/process-incoming-messages" class="spinner-form">
          <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2">
            <svg class="w-4 h-4 btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="btn-text">Process All</span>
            <svg class="w-4 h-4 spinner hidden" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </form>
      </div>
    </div>

    <ul class="space-y-2">
      ${renderMessageList(listItems)}
    </ul>
    <p class="mt-4 text-sm text-gray-500">Total: ${messages.length} messages</p>`;

  return renderShell({
    active: "inbound",
    title: "Inbound Messages",
    content,
    navData,
  });
}
