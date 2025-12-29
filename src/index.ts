import * as net from "node:net";
import { aidboxFetch, getResources, type Bundle } from "./aidbox";
import { processNextMessage } from "./bar/sender-service";
import { processNextInvoice, pollPendingInvoice, updateInvoiceStatus, getRetryCount } from "./bar/invoice-builder-service";
import { wrapWithMLLP, VT, FS, CR } from "./mllp/mllp-server";
import { highlightHL7Message, getHighlightStyles } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";
import type { Patient } from "./fhir/hl7-fhir-r4-core/Patient";
import type { ChargeItem } from "./fhir/hl7-fhir-r4-core/ChargeItem";
import type { Practitioner } from "./fhir/hl7-fhir-r4-core/Practitioner";
import type { Encounter } from "./fhir/hl7-fhir-r4-core/Encounter";
import type { Procedure } from "./fhir/hl7-fhir-r4-core/Procedure";
import type { OutgoingBarMessage, IncomingHL7v2Message } from "./fhir/aidbox-hl7v2-custom";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightHL7WithDataTooltip(message: string | undefined): string {
  const html = highlightHL7Message(message);
  // Replace title= with data-tooltip= to avoid native browser tooltip
  return html.replace(/\btitle="/g, 'data-tooltip="');
}

function formatError(error: string): string {
  // Try to extract and format JSON from error message
  const jsonMatch = error.match(/^(HTTP \d+): (.+)$/s);
  if (jsonMatch) {
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

function getInvoiceRetryCount(invoice: Invoice): number {
  const ext = invoice.extension?.find(e => e.url === "http://example.org/invoice-processing-retry-count");
  return ext?.valueInteger ?? 0;
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
const getPendingInvoiceCount = async (): Promise<number> => {
  const bundle = await aidboxFetch<Bundle<Invoice>>("/fhir/Invoice?processing-status=pending&_count=0");
  return bundle.total ?? 0;
};
const getErrorInvoiceCount = async (): Promise<number> => {
  const bundle = await aidboxFetch<Bundle<Invoice>>("/fhir/Invoice?processing-status=error&_count=0");
  return bundle.total ?? 0;
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
  <style>
    ${getHighlightStyles()}

    /* Custom tooltips for HL7 messages (show on hover) */
    .hl7-message-container [data-tooltip] {
      position: relative;
    }
    .hl7-message-container [data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      left: 0;
      top: 100%;
      background: #1e293b;
      color: #f8fafc;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      z-index: 100;
      pointer-events: none;
      margin-top: 4px;
      font-weight: normal;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.15s, visibility 0.15s;
    }
    .hl7-message-container [data-tooltip]:hover::after {
      opacity: 1;
      visibility: visible;
    }
  </style>
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
  total = 0,
  pendingCount = 0,
  errorCount = 0
): string {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const invoiceItems = invoices
    .map((inv) => {
      const processingStatus = getProcessingStatus(inv);
      const errorReason = getErrorReason(inv);
      const retryCount = getInvoiceRetryCount(inv);
      const statusClass = processingStatus === "completed"
        ? "bg-green-100 text-green-800"
        : processingStatus === "pending"
          ? "bg-yellow-100 text-yellow-800"
          : processingStatus === "error"
            ? "bg-red-100 text-red-800"
            : processingStatus === "failed"
              ? "bg-red-200 text-red-900"
              : "bg-gray-100 text-gray-800";

      return `
      <li class="bg-white rounded-lg shadow">
        <details class="group">
          <summary class="cursor-pointer list-none p-4 flex items-center justify-between hover:bg-gray-50 rounded-lg">
            <div class="flex items-center gap-3">
              <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <span class="font-mono text-sm font-medium">${inv.id}</span>
              <span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${processingStatus}</span>
              ${retryCount > 0 ? `<span class="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">retry: ${retryCount}</span>` : ""}
              ${errorReason ? `<span class="text-xs text-red-600">${errorReason}</span>` : ""}
            </div>
            <div class="flex items-center gap-4 text-sm text-gray-500">
              ${inv.subject?.reference ? `<span><span class="text-gray-400">Subject:</span> ${inv.subject.reference}</span>` : ""}
              ${inv.date ? `<span><span class="text-gray-400">Date:</span> ${inv.date}</span>` : ""}
              ${inv.totalGross ? `<span><span class="text-gray-400">Total:</span> ${inv.totalGross.value} ${inv.totalGross.currency}</span>` : ""}
            </div>
          </summary>
          <div class="px-4 pb-4">
            <pre class="p-3 bg-gray-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${JSON.stringify(inv, null, 2)}</pre>
          </div>
        </details>
      </li>`;
    })
    .join("");

  const processingStatuses = ["pending", "error", "failed", "completed"];

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">Invoices</h1>
      <div class="flex gap-2">
        <form method="POST" action="/build-bar" class="spinner-form">
          <button type="submit" ${pendingCount === 0 ? "disabled" : ""} class="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4 btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <svg class="w-4 h-4 btn-spinner hidden animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="btn-text">Build BAR (${pendingCount} pending)</span>
          </button>
        </form>
        <form method="POST" action="/reprocess-errors" class="spinner-form">
          <button type="submit" ${errorCount === 0 ? "disabled" : ""} class="px-4 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2">
            <svg class="w-4 h-4 btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <svg class="w-4 h-4 btn-spinner hidden animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="btn-text">Reprocess (${errorCount} errors)</span>
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

    <ul class="space-y-2">
      ${invoiceItems || '<li class="bg-white rounded-lg shadow p-8 text-center text-gray-500">No invoices found</li>'}
    </ul>
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
    </div>

    <script>
      document.querySelectorAll('.spinner-form').forEach(form => {
        form.addEventListener('submit', function() {
          const btn = this.querySelector('button');
          const icon = btn.querySelector('.btn-icon');
          const spinner = btn.querySelector('.btn-spinner');
          const text = btn.querySelector('.btn-text');

          btn.disabled = true;
          btn.classList.add('bg-gray-400');
          btn.classList.remove('bg-purple-600', 'bg-orange-600', 'hover:bg-purple-700', 'hover:bg-orange-700');
          icon.classList.add('hidden');
          spinner.classList.remove('hidden');
          text.textContent = 'Processing...';
        });
      });
    </script>`;

  return renderLayout("Invoices", renderNav("invoices"), content);
}


interface MessageListItem {
  id: string;
  statusBadge: { text: string; class: string };
  meta: string[];
  hl7Message: string | undefined;
  error?: string;
  bundle?: string;
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
          ${item.error ? `
            <details class="mb-3" open>
              <summary class="cursor-pointer text-sm font-medium text-red-700 hover:text-red-800">Error</summary>
              <div class="mt-2 p-3 bg-red-50 border border-red-200 rounded font-mono text-xs overflow-x-auto whitespace-pre">${escapeHtml(formatError(item.error))}</div>
            </details>
          ` : ''}
          <div class="hl7-message-container p-3 bg-gray-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${highlightHL7WithDataTooltip(item.hl7Message)}</div>
          ${item.bundle ? `
            <details class="mt-3">
              <summary class="cursor-pointer text-sm text-gray-600 hover:text-gray-800">FHIR Bundle</summary>
              <div class="mt-2 p-3 bg-blue-50 rounded font-mono text-xs overflow-x-auto whitespace-pre">${escapeHtml(item.bundle)}</div>
            </details>
          ` : ''}
        </div>
      </details>
    </li>
  `).join('');
}

function renderOutgoingMessagesPage(messages: OutgoingBarMessage[], patients: Patient[], invoices: Invoice[], statusFilter?: string): string {
  const listItems: MessageListItem[] = messages.map(msg => ({
    id: msg.id ?? "",
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
      name: "ADT^A01 (Admit - Simple)",
      message: `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ADT^A01|MSG${Date.now()}|P|2.4\rEVN|A01|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rPID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||123 Main St^^Anytown^CA^12345||555-555-5555\rPV1|1|I|ICU^101^A|E|||12345^Jones^Mary^A|||MED||||1|||12345^Jones^Mary^A|IN||||||||||||||||||||||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`,
    },
    {
      name: "ADT^A01 (Admit - Full)",
      message: `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ADT^A01^ADT_A01|MSG${Date.now()}|P|2.5.1|||AL|AL\rEVN|A01|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}|||OPERATOR\rPID|1||P12345^^^HOSPITAL^MR||Smith^John^Robert||19850315|M|||123 Main St^^Anytown^CA^12345^USA||^PRN^PH^^1^555^1234567|^WPN^PH^^1^555^9876543||M||P12345\rPV1|1|I|WARD1^ROOM1^BED1||||123^ATTENDING^DOCTOR|||MED||||ADM|||||VN001|||||||||||||||||||||||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rNK1|1|Smith^Jane||456 Oak St^^Othertown^CA^54321^USA|^PRN^PH^^1^555^5551234||||||||||||||||||||||||||||||||\rDG1|1||I10^Essential Hypertension^ICD10||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8)}|||||||||||001^PHYSICIAN^DIAGNOSING\rAL1|1|DA|PCN^Penicillin^RXNORM|SV|Rash||\rIN1|1|BCBS^Blue Cross Blue Shield||Blue Cross|||GRP001|Blue Cross Group||20230101|20231231||HMO||18|SEL||||||||||||||POL123`,
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
    id: msg.id ?? "",
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
    hl7Message: msg.message,
    error: msg.error,
    bundle: msg.bundle
  }));

  const statuses = ["received", "processed", "error"];

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Incoming Messages</h1>

    <div class="mb-4 flex gap-2 items-center justify-between">
      <div class="flex gap-2">
        <a href="/incoming-messages" class="px-3 py-1.5 rounded-lg text-sm font-medium ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          All
        </a>
        ${statuses.map(s => `
          <a href="/incoming-messages?status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
            ${s.charAt(0).toUpperCase() + s.slice(1)}
          </a>
        `).join("")}
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

  return renderLayout("Incoming Messages", renderNav("incoming"), content);
}

Bun.serve({
  port: 3000,
  routes: {
    "/": async (req) => {
      const url = new URL(req.url);
      const statusFilter = url.searchParams.get("processing-status") || undefined;
      const page = parseInt(url.searchParams.get("_page") || "1", 10);
      const [invoicesResult, patients, encounters, procedures, practitioners, pendingCount, errorCount] = await Promise.all([
        getInvoices(statusFilter, page),
        getPatients(),
        getEncounters(),
        getProcedures(),
        getPractitioners(),
        getPendingInvoiceCount(),
        getErrorInvoiceCount(),
      ]);
      return new Response(renderInvoicesPage(invoicesResult.invoices, patients, encounters, procedures, practitioners, statusFilter, page, invoicesResult.total, pendingCount, errorCount), {
        headers: { "Content-Type": "text/html" },
      });
    },
    "/invoices": {
      GET: async (req) => {
        const url = new URL(req.url);
        const statusFilter = url.searchParams.get("processing-status") || undefined;
        const page = parseInt(url.searchParams.get("_page") || "1", 10);
        const [invoicesResult, patients, encounters, procedures, practitioners, pendingCount, errorCount] = await Promise.all([
          getInvoices(statusFilter, page),
          getPatients(),
          getEncounters(),
          getProcedures(),
          getPractitioners(),
          getPendingInvoiceCount(),
          getErrorInvoiceCount(),
        ]);
        return new Response(renderInvoicesPage(invoicesResult.invoices, patients, encounters, procedures, practitioners, statusFilter, page, invoicesResult.total, pendingCount, errorCount), {
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
        // Run processing in background
        (async () => {
          while (await pollPendingInvoice()) {
            await processNextInvoice();
          }
        })().catch(console.error);

        // Redirect immediately
        return new Response(null, {
          status: 302,
          headers: { Location: "/invoices" },
        });
      },
    },
    "/reprocess-errors": {
      POST: async () => {
        const MAX_RETRIES = 3;

        // Run reprocessing in background
        (async () => {
          // Update all error invoices to pending or failed using pagination
          let hasMore = true;
          while (hasMore) {
            const bundle = await aidboxFetch<Bundle<Invoice>>("/fhir/Invoice?processing-status=error&_count=100");
            const errorInvoices = bundle.entry?.map((e) => e.resource) || [];

            if (errorInvoices.length === 0) {
              hasMore = false;
            } else {
              for (const invoice of errorInvoices) {
                if (invoice?.id && "resourceType" in invoice) {
                  const currentRetryCount = getRetryCount(invoice as any);
                  const newRetryCount = currentRetryCount + 1;

                  if (newRetryCount >= MAX_RETRIES) {
                    // Max retries exceeded - mark as failed
                    await updateInvoiceStatus(invoice.id, "failed", { retryCount: newRetryCount });
                  } else {
                    // Retry - set to pending with incremented count
                    await updateInvoiceStatus(invoice.id, "pending", { retryCount: newRetryCount });
                  }
                }
              }
            }
          }

          // Process all pending invoices
          while (await pollPendingInvoice()) {
            await processNextInvoice();
          }
        })().catch(console.error);

        // Redirect immediately
        return new Response(null, {
          status: 302,
          headers: { Location: "/invoices" },
        });
      },
    },
    "/process-incoming-messages": {
      POST: async () => {
        // Run processing in background
        (async () => {
          const { processNextMessage } = await import("./v2-to-fhir/processor-service");
          while (await processNextMessage()) {
            // Process until queue empty
          }
        })().catch(console.error);

        // Redirect immediately
        return new Response(null, {
          status: 302,
          headers: { Location: "/incoming-messages" },
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
