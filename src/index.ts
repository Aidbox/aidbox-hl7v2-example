import * as net from "node:net";
import { aidboxFetch, getResources, type Bundle } from "./aidbox";
import { processNextMessage } from "./bar/sender-service";
import { processNextInvoice } from "./bar/invoice-builder-service";
import { wrapWithMLLP, VT, FS, CR } from "./mllp/mllp-server";
import { highlightHL7Message, getHighlightStyles } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";
import type { Patient } from "./fhir/hl7-fhir-r4-core/Patient";
import type { ChargeItem } from "./fhir/hl7-fhir-r4-core/ChargeItem";
import type { Practitioner } from "./fhir/hl7-fhir-r4-core/Practitioner";
import type { Encounter } from "./fhir/hl7-fhir-r4-core/Encounter";
import type { Procedure } from "./fhir/hl7-fhir-r4-core/Procedure";

const getPatients = () => getResources<Patient>("Patient");
const getChargeItems = () => getResources<ChargeItem>("ChargeItem", "_sort=-_lastUpdated");
const getPractitioners = () => getResources<Practitioner>("Practitioner", "_sort=-_lastUpdated");
const getEncounters = () => getResources<Encounter>("Encounter", "_sort=-_lastUpdated");
const getProcedures = () => getResources<Procedure>("Procedure", "_sort=-_lastUpdated");

interface Invoice {
  id: string;
  status: string;
  subject?: { reference: string };
  date?: string;
  totalGross?: { value: number; currency: string };
  extension?: Array<{ url: string; valueCode?: string; valueString?: string; valueInteger?: number }>;
}

function getProcessingStatus(invoice: Invoice): string {
  const ext = invoice.extension?.find(e => e.url === "http://example.org/invoice-processing-status");
  return ext?.valueCode || "unknown";
}

function getErrorReason(invoice: Invoice): string | undefined {
  const ext = invoice.extension?.find(e => e.url === "http://example.org/invoice-processing-error-reason");
  return ext?.valueString;
}

function getRetryCount(invoice: Invoice): number {
  const ext = invoice.extension?.find(e => e.url === "http://example.org/invoice-processing-retry-count");
  return ext?.valueInteger ?? 0;
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

const PAGE_SIZE = 20;

const getInvoices = async (processingStatus?: string, page = 1): Promise<{ invoices: Invoice[]; total: number }> => {
  const params = new URLSearchParams({
    _sort: "-lastUpdated",
    _count: String(PAGE_SIZE),
    _page: String(page),
  });
  if (processingStatus) params.set("processing-status", processingStatus);

  const bundle = await aidboxFetch<Bundle<Invoice>>(`/fhir/Invoice?${params}`);
  return {
    invoices: bundle.entry?.map((e) => e.resource) || [],
    total: bundle.total ?? 0,
  };
};
const getOutgoingMessages = (status?: string) =>
  getResources<OutgoingBarMessage>("OutgoingBarMessage", `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`);
const getIncomingMessages = (status?: string) =>
  getResources<IncomingHL7v2Message>("IncomingHL7v2Message", `_sort=-_lastUpdated${status ? `&status=${status}` : ""}`);

type NavTab = "invoices" | "outgoing" | "incoming" | "mllp-client";

function renderNav(active: NavTab): string {
  const tabs: Array<{ id: NavTab; href: string; label: string }> = [
    { id: "invoices", href: "/invoices", label: "Invoices" },
    { id: "outgoing", href: "/outgoing-messages", label: "Outgoing Messages" },
    { id: "incoming", href: "/incoming-messages", label: "Incoming Messages" },
    { id: "mllp-client", href: "/mllp-client", label: "MLLP Test Client" },
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

function renderInvoicesPage(
  invoices: Invoice[],
  patients: Patient[],
  encounters: Encounter[],
  procedures: Procedure[],
  practitioners: Practitioner[],
  statusFilter?: string,
  currentPage = 1,
  total = 0
): string {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const rows = invoices
    .map((inv) => {
      const processingStatus = getProcessingStatus(inv);
      const errorReason = getErrorReason(inv);
      const retryCount = getRetryCount(inv);
      return `
      <tr class="border-b border-gray-200 hover:bg-gray-50">
        <td class="py-3 px-4 font-mono text-sm">${inv.id}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${
            processingStatus === "sent"
              ? "bg-green-100 text-green-800"
              : processingStatus === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : processingStatus === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
          }"${errorReason ? ` title="${errorReason}"` : ""}>${processingStatus}</span>
          ${retryCount > 0 ? `<span class="ml-1 px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800" title="Retry attempts">${retryCount}/3</span>` : ""}
        </td>
        <td class="py-3 px-4 text-sm text-gray-600">${inv.subject?.reference || "-"}</td>
        <td class="py-3 px-4 text-sm text-gray-600">${inv.date || "-"}</td>
        <td class="py-3 px-4 text-sm text-right">${inv.totalGross ? `${inv.totalGross.value} ${inv.totalGross.currency}` : "-"}</td>
      </tr>`;
    })
    .join("");

  const pendingCount = invoices.filter((inv) => getProcessingStatus(inv) === "pending").length;
  const processingStatuses = ["pending", "error", "completed"];

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">Invoices</h1>
      <div class="flex gap-2">
        <form method="POST" action="/build-bar">
          <button type="submit" ${pendingCount === 0 ? "disabled" : ""} class="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Build BAR (${pendingCount} pending)
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
      ${processingStatuses.map((s) => `
        <a href="/invoices?processing-status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </a>
      `).join("")}
    </div>

    <div id="add-invoice-form" class="hidden mb-6 bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Invoice</h2>
      <form method="POST" action="/invoices" class="space-y-4">
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
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Practitioner</label>
          <select name="practitioner" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">No practitioner</option>
            ${practitioners.map((pr) => {
              const name = pr.name?.[0];
              const displayName = name ? `${name.given?.join(" ") || ""} ${name.family || ""}`.trim() : pr.id;
              return `<option value="Practitioner/${pr.id}">${displayName} (${pr.id})</option>`;
            }).join("")}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Encounters</label>
            <select name="encounters" id="encounters-select" multiple class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              ${encounters.map((e) => {
                const patientRef = e.subject?.reference || "";
                const classDisplay = e.class?.code || "";
                const period = e.period?.start ? new Date(e.period.start).toLocaleDateString() : "";
                return `<option value="Encounter/${e.id}" data-patient="${patientRef}">${e.id} - ${classDisplay} ${period}</option>`;
              }).join("")}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Procedures</label>
            <select name="procedures" id="procedures-select" multiple class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              ${procedures.map((proc) => {
                const patientRef = proc.subject?.reference || "";
                const code = proc.code?.coding?.[0];
                const display = code?.display || code?.code || proc.id;
                return `<option value="Procedure/${proc.id}" data-patient="${patientRef}">${display} (${proc.id})</option>`;
              }).join("")}
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
      <script>
      (function() {
        const patientSelect = document.querySelector('select[name="subject"]');
        const encountersSelect = document.getElementById('encounters-select');
        const proceduresSelect = document.getElementById('procedures-select');

        function filterByPatient(selectedPatient) {
          // Filter encounters
          Array.from(encountersSelect.options).forEach(option => {
            const patientRef = option.dataset.patient;
            option.style.display = (!selectedPatient || patientRef === selectedPatient) ? '' : 'none';
            if (option.style.display === 'none') {
              option.selected = false;
            }
          });

          // Filter procedures
          Array.from(proceduresSelect.options).forEach(option => {
            const patientRef = option.dataset.patient;
            option.style.display = (!selectedPatient || patientRef === selectedPatient) ? '' : 'none';
            if (option.style.display === 'none') {
              option.selected = false;
            }
          });
        }

        patientSelect.addEventListener('change', function() {
          filterByPatient(this.value);
        });

        // Initial filter on page load
        filterByPatient(patientSelect.value);
      })();
      </script>
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
    <div class="mt-4 flex items-center justify-between">
      <p class="text-sm text-gray-500">Total: ${total} invoices</p>
      ${totalPages > 1 ? `
        <div class="flex items-center gap-1">
          <a href="/invoices?_page=1${statusFilter ? `&processing-status=${statusFilter}` : ""}"
             class="px-3 py-1.5 rounded-lg text-sm font-medium ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
             ${currentPage === 1 ? 'aria-disabled="true"' : ''}>
            First
          </a>
          <a href="/invoices?_page=${currentPage - 1}${statusFilter ? `&processing-status=${statusFilter}` : ""}"
             class="px-3 py-1.5 rounded-lg text-sm font-medium ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
             ${currentPage === 1 ? 'aria-disabled="true"' : ''}>
            Prev
          </a>
          <span class="px-3 py-1.5 text-sm text-gray-600">${currentPage} / ${totalPages}</span>
          <a href="/invoices?_page=${currentPage + 1}${statusFilter ? `&processing-status=${statusFilter}` : ""}"
             class="px-3 py-1.5 rounded-lg text-sm font-medium ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
             ${currentPage === totalPages ? 'aria-disabled="true"' : ''}>
            Next
          </a>
          <a href="/invoices?_page=${totalPages}${statusFilter ? `&processing-status=${statusFilter}` : ""}"
             class="px-3 py-1.5 rounded-lg text-sm font-medium ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}"
             ${currentPage === totalPages ? 'aria-disabled="true"' : ''}>
            Last
          </a>
        </div>
      ` : ''}
    </div>`;

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

interface MLLPClientState {
  host: string;
  port: number;
  message: string;
  response?: string;
  error?: string;
  sent?: boolean;
}

function renderMLLPClientPage(state: MLLPClientState = { host: "localhost", port: 2575, message: "" }): string {
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
      <h1 class="text-3xl font-bold text-gray-800">MLLP Test Client</h1>
      <div class="text-sm text-gray-500">
        Send HL7v2 messages via MLLP protocol
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
        <form method="POST" action="/mllp-client" class="bg-white rounded-lg shadow p-6 space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">MLLP Server Host</label>
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
              Send via MLLP
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
          <h2 class="text-lg font-semibold text-blue-800 mb-2">MLLP Protocol Info</h2>
          <div class="text-sm text-blue-700 space-y-2">
            <p><strong>Start Block:</strong> VT (0x0B)</p>
            <p><strong>End Block:</strong> FS + CR (0x1C 0x0D)</p>
            <p><strong>Default Port:</strong> 2575</p>
          </div>
        </div>

        <div class="mt-4 bg-yellow-50 rounded-lg shadow p-6">
          <h2 class="text-lg font-semibold text-yellow-800 mb-2">Start MLLP Server</h2>
          <pre class="text-xs font-mono bg-white p-2 rounded overflow-x-auto">bun run mllp</pre>
        </div>
      </div>
    </div>`;

  return renderLayout("MLLP Test Client", renderNav("mllp-client"), content);
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
      const statusFilter = url.searchParams.get("processing-status") || undefined;
      const page = parseInt(url.searchParams.get("_page") || "1", 10);
      const [invoicesResult, patients, encounters, procedures, practitioners] = await Promise.all([
        getInvoices(statusFilter, page),
        getPatients(),
        getEncounters(),
        getProcedures(),
        getPractitioners(),
      ]);
      return new Response(renderInvoicesPage(invoicesResult.invoices, patients, encounters, procedures, practitioners, statusFilter, page, invoicesResult.total), {
        headers: { "Content-Type": "text/html" },
      });
    },
    "/invoices": {
      GET: async (req) => {
        const url = new URL(req.url);
        const statusFilter = url.searchParams.get("processing-status") || undefined;
        const page = parseInt(url.searchParams.get("_page") || "1", 10);
        const [invoicesResult, patients, encounters, procedures, practitioners] = await Promise.all([
          getInvoices(statusFilter, page),
          getPatients(),
          getEncounters(),
          getProcedures(),
          getPractitioners(),
        ]);
        return new Response(renderInvoicesPage(invoicesResult.invoices, patients, encounters, procedures, practitioners, statusFilter, page, invoicesResult.total), {
          headers: { "Content-Type": "text/html" },
        });
      },
      POST: async (req) => {
        const formData = await req.formData();
        const subject = formData.get("subject") as string;
        const date = formData.get("date") as string;
        const amount = formData.get("amount") as string;
        const currency = formData.get("currency") as string;
        const practitioner = formData.get("practitioner") as string;
        const encounterRefs = formData.getAll("encounters") as string[];
        const procedureRefs = formData.getAll("procedures") as string[];

        // Create ChargeItems for selected encounters and procedures
        const chargeItemRefs: string[] = [];

        if (subject && (encounterRefs.length > 0 || procedureRefs.length > 0)) {
          // Create a ChargeItem linking encounters and procedures
          const chargeItem: Record<string, unknown> = {
            resourceType: "ChargeItem",
            status: "billable",
            code: {
              coding: [{ system: "http://example.org/charge-codes", code: "invoice-item", display: "Invoice Item" }],
            },
            subject: { reference: subject },
          };

          // Link to first encounter (ChargeItem.context is singular)
          if (encounterRefs.length > 0) {
            chargeItem.context = { reference: encounterRefs[0] };
          }

          // Link to procedures via service array
          if (procedureRefs.length > 0) {
            chargeItem.service = procedureRefs.map((ref) => ({ reference: ref }));
          }

          const chargeItemResponse = await aidboxFetch<{ id: string }>("/fhir/ChargeItem", {
            method: "POST",
            body: JSON.stringify(chargeItem),
          });

          if (chargeItemResponse.id) {
            chargeItemRefs.push(`ChargeItem/${chargeItemResponse.id}`);
          }

          // Create additional ChargeItems for remaining encounters (if any)
          for (let i = 1; i < encounterRefs.length; i++) {
            const additionalChargeItem: Record<string, unknown> = {
              resourceType: "ChargeItem",
              status: "billable",
              code: {
                coding: [{ system: "http://example.org/charge-codes", code: "invoice-item", display: "Invoice Item" }],
              },
              subject: { reference: subject },
              context: { reference: encounterRefs[i] },
            };

            const additionalResponse = await aidboxFetch<{ id: string }>("/fhir/ChargeItem", {
              method: "POST",
              body: JSON.stringify(additionalChargeItem),
            });

            if (additionalResponse.id) {
              chargeItemRefs.push(`ChargeItem/${additionalResponse.id}`);
            }
          }
        }

        const newInvoice: Record<string, unknown> = {
          resourceType: "Invoice",
          status: "draft",
          extension: [
            {
              url: "http://example.org/invoice-processing-status",
              valueCode: "pending",
            },
          ],
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

        // Add lineItems referencing the created ChargeItems
        if (chargeItemRefs.length > 0) {
          newInvoice.lineItem = chargeItemRefs.map((ref, index) => ({
            sequence: index + 1,
            chargeItemReference: { reference: ref },
          }));
        }

        // Add participant for practitioner
        if (practitioner) {
          newInvoice.participant = [
            {
              actor: { reference: practitioner },
            },
          ];
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
        const [messages, patients, invoicesResult] = await Promise.all([
          getOutgoingMessages(statusFilter),
          getPatients(),
          getInvoices(),
        ]);
        return new Response(renderOutgoingMessagesPage(messages, patients, invoicesResult.invoices, statusFilter), {
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
        // Process all pending invoices
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
    "/mllp-client": {
      GET: () => {
        return new Response(renderMLLPClientPage(), {
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

        const state: MLLPClientState = { host, port, message: rawMessage };

        try {
          const response = await sendMLLPMessage(host, port, message);
          state.response = response;
          state.sent = true;
        } catch (error) {
          state.error = error instanceof Error ? error.message : "Unknown error";
        }

        return new Response(renderMLLPClientPage(state), {
          headers: { "Content-Type": "text/html" },
        });
      },
    },
  },
});

/**
 * Send HL7v2 message via MLLP protocol and wait for ACK
 */
async function sendMLLPMessage(host: string, port: number, message: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host, port }, () => {
      client.write(wrapWithMLLP(message));
    });

    const timeout = setTimeout(() => {
      client.destroy();
      reject(new Error("Connection timeout (10s)"));
    }, 10000);

    let buffer = Buffer.alloc(0);

    client.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);

      // Look for MLLP framing
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
