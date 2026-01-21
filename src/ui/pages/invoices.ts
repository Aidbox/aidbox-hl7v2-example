/**
 * Invoices UI Module
 *
 * Displays the Invoices page.
 */

import type { Patient } from "../../fhir/hl7-fhir-r4-core/Patient";
import type { Encounter } from "../../fhir/hl7-fhir-r4-core/Encounter";
import type { Procedure } from "../../fhir/hl7-fhir-r4-core/Procedure";
import type { Practitioner } from "../../fhir/hl7-fhir-r4-core/Practitioner";
import { aidboxFetch, getResources, type Bundle } from "../../aidbox";
import { parsePageParam, createPagination, PAGE_SIZE, renderPaginationControls, type PaginationData } from "../pagination";
import { renderNav, renderLayout, type NavData } from "../shared-layout";
import { htmlResponse, redirectResponse, getNavData } from "../shared";

// ============================================================================
// Types (internal)
// ============================================================================

interface Invoice {
  id: string;
  status: string;
  subject?: { reference: string };
  date?: string;
  totalGross?: { value: number; currency: string };
  extension?: Array<{
    url: string;
    valueCode?: string;
    valueString?: string;
    valueInteger?: number;
  }>;
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleInvoicesPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("processing-status") || undefined;
  const requestedPage = parsePageParam(url.searchParams);

  const [
    invoicesResult,
    patients,
    encounters,
    procedures,
    practitioners,
    pendingCount,
    errorCount,
    navData,
  ] = await Promise.all([
    getInvoices(statusFilter, requestedPage),
    getPatients(),
    getEncounters(),
    getProcedures(),
    getPractitioners(),
    getPendingInvoiceCount(),
    getErrorInvoiceCount(),
    getNavData(),
  ]);

  const pagination = createPagination(requestedPage, invoicesResult.total);

  return htmlResponse(
    renderInvoicesPage(
      navData,
      invoicesResult.invoices,
      patients,
      encounters,
      procedures,
      practitioners,
      statusFilter,
      pagination,
      pendingCount,
      errorCount,
    ),
  );
}

export async function createInvoice(req: Request): Promise<Response> {
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
        coding: [
          {
            system: "http://example.org/charge-codes",
            code: "invoice-item",
            display: "Invoice Item",
          },
        ],
      },
      subject: { reference: subject },
    };

    // Link to first encounter (ChargeItem.context is singular)
    if (encounterRefs.length > 0) {
      chargeItem.context = { reference: encounterRefs[0] };
    }

    // Link to procedures via service array
    if (procedureRefs.length > 0) {
      chargeItem.service = procedureRefs.map((ref) => ({
        reference: ref,
      }));
    }

    const chargeItemResponse = await aidboxFetch<{ id: string }>(
      "/fhir/ChargeItem",
      {
        method: "POST",
        body: JSON.stringify(chargeItem),
      },
    );

    if (chargeItemResponse.id) {
      chargeItemRefs.push(`ChargeItem/${chargeItemResponse.id}`);
    }

    // Create additional ChargeItems for remaining encounters (if any)
    for (let i = 1; i < encounterRefs.length; i++) {
      const additionalChargeItem: Record<string, unknown> = {
        resourceType: "ChargeItem",
        status: "billable",
        code: {
          coding: [
            {
              system: "http://example.org/charge-codes",
              code: "invoice-item",
              display: "Invoice Item",
            },
          ],
        },
        subject: { reference: subject },
        context: { reference: encounterRefs[i] },
      };

      const additionalResponse = await aidboxFetch<{ id: string }>(
        "/fhir/ChargeItem",
        {
          method: "POST",
          body: JSON.stringify(additionalChargeItem),
        },
      );

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

  return redirectResponse("/invoices");
}

// ============================================================================
// Helper Functions (internal)
// ============================================================================

function getProcessingStatus(invoice: Invoice): string {
  const ext = invoice.extension?.find(
    (e) => e.url === "http://example.org/invoice-processing-status",
  );
  return ext?.valueCode || "unknown";
}

function getErrorReason(invoice: Invoice): string | undefined {
  const ext = invoice.extension?.find(
    (e) => e.url === "http://example.org/invoice-processing-error-reason",
  );
  return ext?.valueString;
}

function getInvoiceRetryCount(invoice: Invoice): number {
  const ext = invoice.extension?.find(
    (e) => e.url === "http://example.org/invoice-processing-retry-count",
  );
  return ext?.valueInteger ?? 0;
}

// ============================================================================
// Service Functions (internal)
// ============================================================================

const getPatients = () => getResources<Patient>("Patient");
const getPractitioners = () => getResources<Practitioner>("Practitioner", "_sort=-_lastUpdated");
const getEncounters = () => getResources<Encounter>("Encounter", "_sort=-_lastUpdated");
const getProcedures = () => getResources<Procedure>("Procedure", "_sort=-_lastUpdated");

async function getInvoices(
  processingStatus?: string,
  page = 1,
): Promise<{ invoices: Invoice[]; total: number }> {
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
}

async function getPendingInvoiceCount(): Promise<number> {
  const bundle = await aidboxFetch<Bundle<Invoice>>(
    "/fhir/Invoice?processing-status=pending&_count=0",
  );
  return bundle.total ?? 0;
}

async function getErrorInvoiceCount(): Promise<number> {
  const bundle = await aidboxFetch<Bundle<Invoice>>(
    "/fhir/Invoice?processing-status=error&_count=0",
  );
  return bundle.total ?? 0;
}

// ============================================================================
// Rendering Functions (internal)
// ============================================================================

function renderInvoicesPage(
  navData: NavData,
  invoices: Invoice[],
  patients: Patient[],
  encounters: Encounter[],
  procedures: Procedure[],
  practitioners: Practitioner[],
  statusFilter: string | undefined,
  pagination: PaginationData,
  pendingCount: number,
  errorCount: number,
): string {
  const invoiceItems = invoices
    .map((inv) => {
      const processingStatus = getProcessingStatus(inv);
      const errorReason = getErrorReason(inv);
      const retryCount = getInvoiceRetryCount(inv);
      const statusClass =
        processingStatus === "completed"
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
      ${processingStatuses
        .map(
          (s) => `
        <a href="/invoices?processing-status=${s}" class="px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? "bg-gray-800 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}">
          ${s.charAt(0).toUpperCase() + s.slice(1)}
        </a>
      `,
        )
        .join("")}
    </div>

    <div id="add-invoice-form" class="hidden mb-6 bg-white rounded-lg shadow p-6">
      <h2 class="text-lg font-semibold text-gray-800 mb-4">Add New Invoice</h2>
      <form method="POST" action="/invoices" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Subject (Patient)</label>
          <select name="subject" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">No subject</option>
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
            ${practitioners
              .map((pr) => {
                const name = pr.name?.[0];
                const displayName = name
                  ? `${name.given?.join(" ") || ""} ${name.family || ""}`.trim()
                  : pr.id;
                return `<option value="Practitioner/${pr.id}">${displayName} (${pr.id})</option>`;
              })
              .join("")}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Encounters</label>
            <select name="encounters" id="encounters-select" multiple class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              ${encounters
                .map((e) => {
                  const patientRef = e.subject?.reference || "";
                  const classDisplay = e.class?.code || "";
                  const period = e.period?.start
                    ? new Date(e.period.start).toLocaleDateString()
                    : "";
                  return `<option value="Encounter/${e.id}" data-patient="${patientRef}">${e.id} - ${classDisplay} ${period}</option>`;
                })
                .join("")}
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Procedures</label>
            <select name="procedures" id="procedures-select" multiple class="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              ${procedures
                .map((proc) => {
                  const patientRef = proc.subject?.reference || "";
                  const code = proc.code?.coding?.[0];
                  const display = code?.display || code?.code || proc.id;
                  return `<option value="Procedure/${proc.id}" data-patient="${patientRef}">${display} (${proc.id})</option>`;
                })
                .join("")}
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
      <p class="text-sm text-gray-500">Total: ${pagination.total} invoices</p>
      ${renderPaginationControls({
        pagination,
        baseUrl: "/invoices",
        filterParams: statusFilter
          ? { "processing-status": statusFilter }
          : undefined,
      })}
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

  return renderLayout("Invoices", renderNav("invoices", navData), content);
}
