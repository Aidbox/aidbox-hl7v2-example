const AIDBOX_URL = "http://localhost:8080";
const CLIENT_ID = "root";
const CLIENT_SECRET = "Vbro4upIT1";

const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

async function aidboxFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(`${AIDBOX_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/fhir+json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

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
}

interface Bundle<T> {
  total?: number;
  entry?: Array<{ resource: T }>;
}

async function getInvoices(): Promise<Invoice[]> {
  const bundle = (await aidboxFetch("/fhir/Invoice?_count=100")) as Bundle<Invoice>;
  return bundle.entry?.map((e) => e.resource) || [];
}

async function getOutgoingMessages(): Promise<OutgoingBarMessage[]> {
  const bundle = (await aidboxFetch("/fhir/OutgoingBarMessage?_count=100")) as Bundle<OutgoingBarMessage>;
  return bundle.entry?.map((e) => e.resource) || [];
}

function renderNav(active: "invoices" | "messages"): string {
  return `
  <nav class="bg-white shadow mb-6">
    <div class="container mx-auto px-4">
      <div class="flex space-x-4">
        <a href="/invoices" class="py-4 px-2 border-b-2 ${active === "invoices" ? "border-blue-500 text-blue-600 font-semibold" : "border-transparent text-gray-600 hover:text-gray-800"}">
          Invoices
        </a>
        <a href="/outgoing-messages" class="py-4 px-2 border-b-2 ${active === "messages" ? "border-blue-500 text-blue-600 font-semibold" : "border-transparent text-gray-600 hover:text-gray-800"}">
          Outgoing Messages
        </a>
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
</head>
<body class="bg-gray-100 min-h-screen">
  ${nav}
  <div class="container mx-auto px-4 pb-8">
    ${content}
  </div>
</body>
</html>`;
}

function renderInvoicesPage(invoices: Invoice[]): string {
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
                : "bg-gray-100 text-gray-800"
          }">${inv.status}</span>
        </td>
        <td class="py-3 px-4 text-sm text-gray-600">${inv.subject?.reference || "-"}</td>
        <td class="py-3 px-4 text-sm text-gray-600">${inv.date || "-"}</td>
        <td class="py-3 px-4 text-sm text-right">${inv.totalGross ? `${inv.totalGross.value} ${inv.totalGross.currency}` : "-"}</td>
      </tr>`
    )
    .join("");

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Invoices</h1>
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

function renderMessagesPage(messages: OutgoingBarMessage[]): string {
  const rows = messages
    .map(
      (msg) => `
      <tr class="border-b border-gray-200">
        <td class="py-3 px-4">
          <details class="group">
            <summary class="cursor-pointer list-none flex items-center gap-2">
              <svg class="w-4 h-4 text-gray-400 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <span class="font-mono text-sm">${msg.id}</span>
            </summary>
            <div class="mt-3 ml-6 p-3 bg-gray-50 rounded font-mono text-xs text-gray-600 overflow-x-auto whitespace-pre">${msg.hl7v2 || "No HL7v2 message"}</div>
          </details>
        </td>
        <td class="py-3 px-4">
          <span class="px-2 py-1 rounded-full text-xs font-medium ${
            msg.status === "sent"
              ? "bg-green-100 text-green-800"
              : msg.status === "pending"
                ? "bg-yellow-100 text-yellow-800"
                : msg.status === "error"
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
          }">${msg.status}</span>
        </td>
        <td class="py-3 px-4 text-sm text-gray-600">${msg.patient?.reference || "-"}</td>
        <td class="py-3 px-4 text-sm text-gray-600">${msg.invoice?.reference || "-"}</td>
      </tr>`
    )
    .join("");

  const content = `
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Outgoing Messages</h1>
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">ID / HL7v2</th>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
            <th class="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" class="py-8 text-center text-gray-500">No messages found</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="mt-4 text-sm text-gray-500">Total: ${messages.length} messages</p>`;

  return renderLayout("Outgoing Messages", renderNav("messages"), content);
}

Bun.serve({
  port: 3000,
  routes: {
    "/": async () => {
      const invoices = await getInvoices();
      return new Response(renderInvoicesPage(invoices), {
        headers: { "Content-Type": "text/html" },
      });
    },
    "/invoices": async () => {
      const invoices = await getInvoices();
      return new Response(renderInvoicesPage(invoices), {
        headers: { "Content-Type": "text/html" },
      });
    },
    "/outgoing-messages": async () => {
      const messages = await getOutgoingMessages();
      return new Response(renderMessagesPage(messages), {
        headers: { "Content-Type": "text/html" },
      });
    },
  },
});

console.log("Server running at http://localhost:3000");
