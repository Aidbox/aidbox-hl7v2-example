import * as net from "node:net";
import { aidboxFetch, getResources } from "./aidbox";
import { processNextMessage } from "./bar/sender-service";
import { processNextInvoice } from "./bar/invoice-builder-service";
import { wrapWithMLP, VT, FS, CR } from "./mlp/mlp-server";
import { highlightHL7Message, getHighlightStyles } from "./hl7v2/highlight";

interface Patient {
  id: string;
  name?: Array<{ family?: string; given?: string[] }>;
}

const getPatients = () => getResources<Patient>("Patient");

interface Invoice {
  id: string;
  status: string;
  subject?: { reference: string };
  date?: string;
  totalGross?: { value: number; currency: string };
}

interface OutgoingBarMessage {
  id: string;
  status: string;
  patient?: { reference: string };
  invoice?: { reference: string };
  hl7v2?: string;
  meta?: { lastUpdated?: string };
}

interface IncomingHL7v2Message {
  id: string;
  type: string;
  status?: string;
  date?: string;
  patient?: { reference: string };
  message: string;
  meta?: { lastUpdated?: string };
}

const getInvoices = (status?: string) =>
  getResources<Invoice>("Invoice", `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`);
const getOutgoingMessages = (status?: string) =>
  getResources<OutgoingBarMessage>("OutgoingBarMessage", `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`);
const getIncomingMessages = (status?: string) =>
  getResources<IncomingHL7v2Message>("IncomingHL7v2Message", `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`);

type NavTab = "invoices" | "outgoing" | "incoming" | "mlp-client";

function renderNav(active: NavTab): string {
  const tabs: Array<{ id: NavTab; href: string; label: string }> = [
    { id: "invoices", href: "/invoices", label: "Invoices" },
    { id: "outgoing", href: "/outgoing-messages", label: "Outgoing Messages" },
    { id: "incoming", href: "/incoming-messages", label: "Incoming Messages" },
    { id: "mlp-client", href: "/mlp-client", label: "MLP Test Client" },
  ];

  return `
  <nav class="bg-white shadow mb-6">
    <div class="container mx-auto px-4">
      <div class="flex space-x-4">
        ${tabs
          .map(
            (tab) => `
        <a href="${tab.href}" class="py-4 px-2 border-b-2 ${active === tab.id ? "border-blue-500 text-blue-600 font-semibold" : "border-transparent text-gray-600 hover:text-gray-800"}">
          ${tab.label}
        </a>`
          )
          .join("")}
      </div>
    </div>
  </nav>`;
}

function renderLayout(title: string, nav: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${getHighlightStyles()}</style>
</head>
<body class="bg-gray-100 min-h-screen">
  ${nav}
  <div class="container mx-auto px-4 pb-8">
    ${content}
  </div>
</body>
</html>`;
}

function renderInvoicesPage(invoices: Invoice[], patients: Patient[], statusFilter?: string): string {
  const rows = invoices
    .map(
      (inv) => `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="py-3 px-4 font-mono text-sm">${inv.id}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${
            inv.status === "issued"
              ? "bg-green-100 text-green-800"
              : inv.status === "draft"
                ? "bg-yellow-100 text-yellow-800"
                : inv.status === "balanced"
                  ? "bg-blue-100 text-blue-800"
                  : inv.status === "cancelled"
                    ? "bg-red-100 text-red-800"
                    : "bg-gray-100 text-gray-800"
          }">${inv.status}</span>
        </td>
        <td class="py-3 px-4 text-sm text-gray-600">${inv.subject?.reference || "-"}</td>
        <td class="py-3 px-4 text-sm text-gray-600">${inv.date || "-"}</td>
        <td class="py-3 px-4 text-sm text-right">${inv.totalGross ? `${inv.totalGross.value} ${inv.totalGross.currency}` : "-"}</td>
      </tr>`
    )
    .join("");

  const draftCount = invoices.filter((inv) => inv.status === "draft").length;
  const invoiceStatuses = ["draft", "issued", "balanced", "cancelled"];

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">Invoices</h1>
      <div class="flex gap-2">
        <form method="POST" action="/build-bar">
          <button type="submit" ${draftCount === 0 ? "disabled" : ""} class="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Build BAR (${draftCount} draft)
          </button>
        </form>
        <button onclick="document.getElementById('add-invoice-form').classList.toggle('hidden')" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          Add Invoice
        </button>
      </div>
    </div>

    <div class="mb-4 flex gap-2">
      <a href="/invoices" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        All
      </a>
      ${invoiceStatuses.map((s) => `
        <a href="/invoices?status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </a>
      `).join("")}
    </div>

    <div id="add-invoice-form" class="hidden mb-6 bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Invoice</h2>
      <form method="POST" action="/invoices" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Subject (Patient)</label>
            <select name="subject" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="">No subject</option>
              ${patients.map((p) => {
                const name = p.name?.[0];
                const displayName = name ? `${name.given?.join(" ") || ""} ${name.family || ""}`.trim() : p.id;
                return `<option value="Patient/${p.id}">${displayName} (${p.id})</option>`;
              }).join("")}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="draft">Draft</option>
              <option value="issued">Issued</option>
              <option value="balanced">Balanced</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" name="date" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
            <input type="number" name="amount" step="0.01" placeholder="0.00" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select name="currency" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2">
          <button type="submit" class="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
            Create Invoice
          </button>
          <button type="button" onclick="document.getElementById('add-invoice-form').classList.add('hidden')" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">
            Cancel
          </button>
        </div>
      </form>
    </div>

    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Subject</th>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
            <th class="py-3 px-4 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" class="py-8 text-center text-gray-500">No invoices found</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="mt-4 text-sm text-gray-500">Total: ${invoices.length} invoices</p>`;

  return renderLayout("Invoices", renderNav("invoices"), content);
}


interface MessageListItem {
  id: string;
  statusBadge: { text: string; class: string };
  meta: string[];
  hl7Message: string | undefined;
}

function renderMessageList(items: MessageListItem[]): string {
  if (items.length === 0) {
    return '<li class="bg-white rounded-lg shadow p-8 text-center text-gray-500">No messages found</li>';
  }

  return items.map(item => `
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
            ${item.meta.map(m => `<span>${m}</span>`).join('')}
          </div>
        </summary>
        <div class="px-4 pb-4">
          <div class="p-3 bg-gray-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${highlightHL7Message(item.hl7Message)}</div>
        </div>
      </details>
    </li>
  `).join('');
}

function renderOutgoingMessagesPage(messages: OutgoingBarMessage[], patients: Patient[], invoices: Invoice[], statusFilter?: string): string {
  const listItems: MessageListItem[] = messages.map(msg => ({
    id: msg.id,
    statusBadge: {
      text: msg.status,
      class: msg.status === "sent"
        ? "bg-green-100 text-green-800"
        : msg.status === "pending"
          ? "bg-yellow-100 text-yellow-800"
          : msg.status === "error"
            ? "bg-red-100 text-red-800"
            : "bg-gray-100 text-gray-800"
    },
    meta: [
      msg.patient?.reference?.replace("Patient/", "") || "-",
      msg.invoice?.reference?.replace("Invoice/", "") || "-",
      msg.meta?.lastUpdated ? new Date(msg.meta.lastUpdated).toLocaleString() : "-"
    ],
    hl7Message: msg.hl7v2
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
      ${statuses.map((s) => `
        <a href="/outgoing-messages?status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </a>
      `).join("")}
    </div>

    <div id="add-form" class="hidden mb-6 bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Outgoing Message</h2>
      <form method="POST" action="/outgoing-messages" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <select name="patient" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Select a patient...</option>
            ${patients.map((p) => {
              const name = p.name?.[0];
              const displayName = name ? `${name.given?.join(" ") || ""} ${name.family || ""}`.trim() : p.id;
              return `<option value="Patient/${p.id}">${displayName} (${p.id})</option>`;
            }).join("")}
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

  return renderLayout("Outgoing Messages", renderNav("outgoing"), content);
}

interface MLPClientState {
  host: string;
  port: number;
  message: string;
  response?: string;
  error?: string;
  sent?: boolean;
}

function renderMLPClientPage(state: MLPClientState = { host: "localhost", port: 2575, message: "" }): string {
  const sampleMessages = [
    {
      name: "ADT^A01 (Admit)",
      message: `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ADT^A01|MSG${Date.now()}|P|2.4\rEVN|A01|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rPID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||123 Main St^^Anytown^CA^12345||555-555-5555\rPV1|1|I|ICU^101^A|E|||12345^Jones^Mary^A|||MED||||1|||12345^Jones^Mary^A|IN||||||||||||||||||||||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`,
    },
    {
      name: "ADT^A08 (Update)",
      message: `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ADT^A08|MSG${Date.now()}|P|2.4\rEVN|A08|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rPID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||456 New St^^Newtown^CA^54321||555-555-1234`,
    },
    {
      name: "BAR^P01 (Add Account)",
      message: `MSH|^~\\&|BILLING|HOSPITAL|RECEIVER|FAC|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||BAR^P01|MSG${Date.now()}|P|2.5\rEVN|P01|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rPID|1||MRN12345||Doe^Jane^M||19850315|F\rPV1|1|O|CLINIC^201||||||12345^Smith^Robert|||||||||||ACCT001`,
    },
    {
      name: "ORM^O01 (Order)",
      message: `MSH|^~\\&|ORDER_SYS|HOSPITAL|LAB|LAB_FAC|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ORM^O01|MSG${Date.now()}|P|2.4\rPID|1||PAT001^^^HOSP^MR||Johnson^Mary||19900520|F\rORC|NW|ORD001||||||||||12345^Doctor^Test\rOBR|1|ORD001||CBC^Complete Blood Count^L|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`,
    },
  ];

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">MLP Test Client</h1>
      <div class="text-sm text-gray-500">
        Send HL7v2 messages via MLP protocol
      </div>
    </div>

    ${state.error ? `
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center gap-2 text-red-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="font-medium">Error</span>
        </div>
        <p class="mt-1 text-sm text-red-700">${state.error}</p>
      </div>
    ` : ""}

    ${state.sent && state.response ? `
      <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
        <div class="flex items-center gap-2 text-green-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="font-medium">Message Sent Successfully</span>
        </div>
        <div class="mt-2">
          <p class="text-sm font-medium text-green-800 mb-1">ACK Response:</p>
          <pre class="p-2 bg-white rounded text-xs font-mono overflow-x-auto">${state.response.replace(/\r/g, "\n")}</pre>
        </div>
      </div>
    ` : ""}

    <div class="grid grid-cols-3 gap-6">
      <div class="col-span-2">
        <form method="POST" action="/mlp-client" class="bg-white rounded-lg shadow p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">MLP Server Host</label>
              <input type="text" name="host" value="${state.host}" required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="localhost">
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">Port</label>
              <input type="number" name="port" value="${state.port}" required
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="2575">
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">HL7v2 Message</label>
            <textarea name="message" rows="12" required
              class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="MSH|^~\\&|...">${state.message}</textarea>
            <p class="mt-1 text-xs text-gray-500">Use \\r for segment separators or paste multi-line message</p>
          </div>

          <div class="flex gap-2">
            <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
              Send via MLP
            </button>
            <button type="reset" class="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300">
              Clear
            </button>
          </div>
        </form>
      </div>

      <div>
        <div class="bg-white rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-gray-800 mb-4">Sample Messages</h2>
          <div class="space-y-2">
            ${sampleMessages.map((sample, i) => `
              <button type="button" onclick="document.querySelector('textarea[name=message]').value = decodeURIComponent('${encodeURIComponent(sample.message)}')"
                class="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                ${sample.name}
              </button>
            `).join("")}
          </div>
        </div>

        <div class="mt-4 bg-blue-50 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-blue-800 mb-2">MLP Protocol Info</h2>
          <div class="text-sm text-blue-700 space-y-2">
            <p><strong>Start Block:</strong> VT (0x0B)</p>
            <p><strong>End Block:</strong> FS + CR (0x1C 0x0D)</p>
            <p><strong>Default Port:</strong> 2575</p>
          </div>
        </div>

        <div class="mt-4 bg-yellow-50 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-yellow-800 mb-2">Start MLP Server</h2>
          <pre class="text-xs font-mono bg-white p-2 rounded overflow-x-auto">bun run mlp</pre>
        </div>
      </div>
    </div>`;

  return renderLayout("MLP Test Client", renderNav("mlp-client"), content);
}

function renderIncomingMessagesPage(messages: IncomingHL7v2Message[], statusFilter?: string): string {
  const listItems: MessageListItem[] = messages.map(msg => ({
    id: msg.id,
    statusBadge: {
      text: msg.status || "received",
      class: msg.status === "processed"
        ? "bg-green-100 text-green-800"
        : msg.status === "error"
          ? "bg-red-100 text-red-800"
          : "bg-blue-100 text-blue-800"
    },
    meta: [
      msg.type,
      msg.patient?.reference?.replace("Patient/", "") || "-",
      msg.meta?.lastUpdated ? new Date(msg.meta.lastUpdated).toLocaleString() : "-"
    ],
    hl7Message: msg.message
  }));

  const statuses = ["received", "processed", "error"];

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Incoming Messages</h1>

    <div class="mb-4 flex gap-2">
      <a href="/incoming-messages" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
        All
      </a>
      ${statuses.map(s => `
        <a href="/incoming-messages?status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </a>
      `).join("")}
    </div>

    <ul class="space-y-2">
      ${renderMessageList(listItems)}
    </ul>
    <p class="mt-4 text-sm text-gray-500">Total: ${messages.length} messages</p>`;

  return renderLayout("Incoming Messages", renderNav("incoming"), content);
}

Bun.serve({
  port: 3000,
  routes: {
    "/": async (req) => {
      const url = new URL(req.url);
      const statusFilter = url.searchParams.get("status") || undefined;
      const [invoices, patients] = await Promise.all([getInvoices(statusFilter), getPatients()]);
      return new Response(renderInvoicesPage(invoices, patients, statusFilter), {
        headers: { "Content-Type": "text/html" },
      });
    },
    "/invoices": {
      GET: async (req) => {
        const url = new URL(req.url);
        const statusFilter = url.searchParams.get("status") || undefined;
        const [invoices, patients] = await Promise.all([getInvoices(statusFilter), getPatients()]);
        return new Response(renderInvoicesPage(invoices, patients, statusFilter), {
          headers: { "Content-Type": "text/html" },
        });
      },
      POST: async (req) => {
        const formData = await req.formData();
        const subject = formData.get("subject") as string;
        const status = formData.get("status") as string;
        const date = formData.get("date") as string;
        const amount = formData.get("amount") as string;
        const currency = formData.get("currency") as string;

        const newInvoice: Record<string, unknown> = {
          resourceType: "Invoice",
          status,
        };

        if (subject) {
          newInvoice.subject = { reference: subject };
        }
        if (date) {
          newInvoice.date = date;
        }
        if (amount) {
          newInvoice.totalGross = {
            value: parseFloat(amount),
            currency: currency || "USD",
          };
        }

        await aidboxFetch("/fhir/Invoice", {
          method: "POST",
          body: JSON.stringify(newInvoice),
        });

        return new Response(null, {
          status: 302,
          headers: { Location: "/invoices" },
        });
      },
    },
    "/outgoing-messages": {
      GET: async (req) => {
        const url = new URL(req.url);
        const statusFilter = url.searchParams.get("status") || undefined;
        const [messages, patients, invoices] = await Promise.all([
          getOutgoingMessages(statusFilter),
          getPatients(),
          getInvoices(),
        ]);
        return new Response(renderOutgoingMessagesPage(messages, patients, invoices, statusFilter), {
          headers: { "Content-Type": "text/html" },
        });
      },
      POST: async (req) => {
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

        return new Response(null, {
          status: 302,
          headers: { Location: "/outgoing-messages" },
        });
      },
    },
    "/incoming-messages": async (req) => {
      const url = new URL(req.url);
      const statusFilter = url.searchParams.get("status") || undefined;
      const messages = await getIncomingMessages(statusFilter);
      return new Response(renderIncomingMessagesPage(messages, statusFilter), {
        headers: { "Content-Type": "text/html" },
      });
    },
    "/send-messages": {
      POST: async () => {
        let sentCount = 0;
        // Process all pending messages
        while (await processNextMessage()) {
          sentCount++;
        }
        // Redirect back to outgoing messages page
        return new Response(null, {
          status: 302,
          headers: { Location: "/outgoing-messages" },
        });
      },
    },
    "/build-bar": {
      POST: async () => {
        // Process all draft invoices
        while (await processNextInvoice()) {
          // Continue processing
        }
        // Redirect back to invoices page
        return new Response(null, {
          status: 302,
          headers: { Location: "/invoices" },
        });
      },
    },
    "/mlp-client": {
      GET: () => {
        return new Response(renderMLPClientPage(), {
          headers: { "Content-Type": "text/html" },
        });
      },
      POST: async (req) => {
        const formData = await req.formData();
        const host = (formData.get("host") as string) || "localhost";
        const port = parseInt((formData.get("port") as string) || "2575", 10);
        const rawMessage = (formData.get("message") as string) || "";

        // Normalize line endings to \r (HL7v2 standard)
        const message = rawMessage.replace(/\r\n/g, "\r").replace(/\n/g, "\r");

        const state: MLPClientState = { host, port, message: rawMessage };

        try {
          const response = await sendMLPMessage(host, port, message);
          state.response = response;
          state.sent = true;
        } catch (error) {
          state.error = error instanceof Error ? error.message : "Unknown error";
        }

        return new Response(renderMLPClientPage(state), {
          headers: { "Content-Type": "text/html" },
        });
      },
    },
  },
});

/**
 * Send HL7v2 message via MLP protocol and wait for ACK
 */
async function sendMLPMessage(host: string, port: number, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port }, () => {
      client.write(wrapWithMLP(message));
    });

    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error("Connection timeout (10s)"));
    }, 10000);

    let buffer = Buffer.alloc(0);

    client.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Look for MLP framing
      const startIndex = buffer.indexOf(VT);
      if (startIndex === -1) return;

      for (let i = startIndex + 1; i < buffer.length - 1; i++) {
        if (buffer[i] === FS && buffer[i + 1] === CR) {
          const response = buffer.subarray(startIndex + 1, i).toString("utf-8");
          clearTimeout(timeout);
          client.end();
          resolve(response);
          return;
        }
      }
    });

    client.on("error", (err) => {
      clearTimeout(timeout);
      reject(new Error(`Connection failed: ${err.message}`));
    });

    client.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

console.log("Server running at http://localhost:3000");
