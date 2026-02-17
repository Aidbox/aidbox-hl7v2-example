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
import { renderNav, renderLayout, type NavData } from "../shared-layout";
import { htmlResponse, redirectResponse, getNavData } from "../shared";
import { PAGE_SIZE } from "../pagination";

// ============================================================================
// Types (internal)
// ============================================================================

interface Invoice {
  id: string;
  status: string;
}

interface MessageListItem {
  id: string;
  statusBadge: { text: string; class: string };
  meta: string[];
  hl7Message: string | undefined;
  error?: string;
  bundle?: string;
  retryUrl?: string;
  unmappedCodes?: UnmappedCode[];
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleOutgoingMessagesPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status") || undefined;

  const [messages, patients, invoicesResult, navData] = await Promise.all([
    getOutgoingMessages(statusFilter),
    getPatients(),
    getInvoices(),
    getNavData(),
  ]);

  return htmlResponse(
    renderOutgoingMessagesPage(navData, messages, patients, invoicesResult.invoices, statusFilter),
  );
}

export async function createOutgoingMessage(req: Request): Promise<Response> {
  const formData = await req.formData();
  const patient = formData.get("patient") as string;
  const invoice = formData.get("invoice") as string;
  const hl7v2 = formData.get("hl7v2") as string;

  const newMessage = {
    resourceType: "OutgoingBarMessage",
    patient: { reference: patient },
    invoice: { reference: invoice },
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

  const [messages, navData] = await Promise.all([
    getIncomingMessages(statusFilter),
    getNavData(),
  ]);

  return htmlResponse(renderIncomingMessagesPage(navData, messages, statusFilter));
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

async function getInvoices(): Promise<{ invoices: Invoice[]; total: number }> {
  const bundle = await aidboxFetch<Bundle<Invoice>>(`/fhir/Invoice?_sort=-lastUpdated&_count=${PAGE_SIZE}`);
  return {
    invoices: bundle.entry?.map((e) => e.resource) || [],
    total: bundle.total ?? 0,
  };
}

const getOutgoingMessages = (status?: string) =>
  getResources<OutgoingBarMessage>(
    "OutgoingBarMessage",
    `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`,
  );

const getIncomingMessages = (status?: string) =>
  getResources<IncomingHL7v2Message>(
    "IncomingHL7v2Message",
    `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`,
  );

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
                      <a href="/mapping/tasks" class="text-blue-600 hover:text-blue-800 text-xs">View Tasks →</a>
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
            item.bundle
              ? `
            <details class="mt-3">
              <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">FHIR Bundle</summary>
              <div class="mt-2 p-3 bg-blue-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${escapeHtml(item.bundle)}</div>
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
  invoices: Invoice[],
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
      msg.invoice?.reference?.replace("Invoice/", "") || "-",
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
          <label class="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
          <select name="invoice" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Select an invoice...</option>
            ${invoices.map((inv) => `<option value="Invoice/${inv.id}">${inv.id} (${inv.status})</option>`).join("")}
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

  return renderLayout(
    "Outgoing Messages",
    renderNav("outgoing", navData),
    content,
  );
}

function renderIncomingMessagesPage(
  navData: NavData,
  messages: IncomingHL7v2Message[],
  statusFilter?: string,
): string {
  const getStatusBadgeClass = (status: string | undefined) => {
    switch (status) {
      case "processed":
        return "bg-green-100 text-green-800";
      case "warning":
        return "bg-amber-100 text-amber-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "mapping_error":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  const formatStatusLabel = (status: string) => {
    if (status === "mapping_error") return "Mapping Error";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const listItems: MessageListItem[] = messages.map((msg) => ({
    id: msg.id ?? "",
    statusBadge: {
      text: formatStatusLabel(msg.status || "received"),
      class: getStatusBadgeClass(msg.status),
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
    bundle: msg.bundle,
    retryUrl:
      (msg.status === "error" || msg.status === "mapping_error" || msg.status === "warning") && msg.id
        ? `/mark-for-retry/${msg.id}`
        : undefined,
    unmappedCodes: msg.status === "mapping_error" ? msg.unmappedCodes : undefined,
  }));

  const statuses = ["received", "processed", "warning", "mapping_error", "error"];

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Incoming Messages</h1>

    <div class="mb-4 flex gap-2 items-center justify-between">
      <div class="flex gap-2">
        <a href="/incoming-messages" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          All
        </a>
        ${statuses
          .map(
            (s) => `
          <a href="/incoming-messages?status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
            ${formatStatusLabel(s)}
          </a>
        `,
          )
          .join("")}
      </div>
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

    <ul class="space-y-2">
      ${renderMessageList(listItems)}
    </ul>
    <p class="mt-4 text-sm text-gray-500">Total: ${messages.length} messages</p>`;

  return renderLayout(
    "Incoming Messages",
    renderNav("incoming", navData),
    content,
  );
}
