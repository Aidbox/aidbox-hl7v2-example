/**
 * Outgoing Messages UI.
 *
 * Renders the legacy Outgoing Messages page body inside the warm-paper shell's
 * gray-card frame (`renderLegacyBody`). The Inbound half of this module was
 * removed in Task 13 — the new warm-paper inbound UI lives in `./inbound.ts`
 * and `./inbound-detail.ts`.
 */

import { highlightHL7WithDataTooltip } from "../hl7-display";
import type { OutgoingBarMessage } from "../../fhir/aidbox-hl7v2-custom";
import type { Patient } from "../../fhir/hl7-fhir-r4-core/Patient";
import { aidboxFetch, getResources, type Bundle } from "../../aidbox";
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
          <div class="hl7-message-container p-3 bg-gray-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${highlightHL7WithDataTooltip(item.hl7Message)}</div>
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

