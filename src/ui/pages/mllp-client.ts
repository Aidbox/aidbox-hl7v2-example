/**
 * MLLP Client UI Module
 *
 * Displays the MLLP Test Client page.
 */

import * as net from "node:net";
import { wrapWithMLLP, VT, FS, CR } from "../../mllp/mllp-server";
import { renderNav, renderLayout, type NavData } from "../shared-layout";
import { htmlResponse, getNavData } from "../shared";

// ============================================================================
// Types (internal)
// ============================================================================

interface MLLPClientState {
  host: string;
  port: number;
  message: string;
  response?: string;
  error?: string;
  sent?: boolean;
}

// ============================================================================
// Handler Functions (exported)
// ============================================================================

export async function handleMLLPClientPage(): Promise<Response> {
  const navData = await getNavData();
  return htmlResponse(renderMLLPClientPage(navData));
}

export async function sendMLLPTest(req: Request): Promise<Response> {
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

  const navData = await getNavData();
  return htmlResponse(renderMLLPClientPage(navData, state));
}

// ============================================================================
// Service Functions (internal)
// ============================================================================

/**
 * Send HL7v2 message via MLLP protocol and wait for ACK
 */
function sendMLLPMessage(
  host: string,
  port: number,
  message: string,
): Promise<string> {
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

// ============================================================================
// Rendering Functions (internal)
// ============================================================================

function renderMLLPClientPage(
  navData: NavData,
  state: MLLPClientState = { host: "localhost", port: 2575, message: "" },
): string {
  const sampleMessages = [
    {
      name: "ADT^A01 (Admit - Simple)",
      message: `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ADT^A01|MSG${Date.now()}|P|2.4\rEVN|A01|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rPID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||123 Main St^^Anytown^CA^12345||555-555-5555\rPV1|1|I|ICU^101^A|E|||12345^Jones^Mary^A|||MED||||1|||12345^Jones^Mary^A|IN||||||||||||||||||||||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}`,
    },
    {
      name: "ADT^A01 (Admit - Full)",
      message: `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ADT^A01^ADT_A01|MSG${Date.now()}|P|2.5.1|||AL|AL\rEVN|A01|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}|||OPERATOR\rPID|1||P12345^^^HOSPITAL^MR||Smith^John^Robert||19850315|M|||123 Main St^^Anytown^CA^12345^USA||^PRN^PH^^1^555^1234567|^WPN^PH^^1^555^9876543||M||P12345\rPV1|1|I|WARD1^ROOM1^BED1||||123^ATTENDING^DOCTOR|||MED||||ADM|||||VN001|||||||||||||||||||||||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rNK1|1|Smith^Jane||456 Oak St^^Othertown^CA^54321^USA|^PRN^PH^^1^555^5551234||||||||||||||||||||||||||||||||\rDG1|1||I10^Essential Hypertension^ICD10||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 8)}|||||||||||001^PHYSICIAN^DIAGNOSING\rAL1|1|DA|PCN^Penicillin^RXNORM|SV|Rash||\rIN1|1|BCBS^Blue Cross Blue Shield||Blue Cross||||GRP001|Blue Cross Group|||20230101|20231231||HMO||SEL|||||||||||||||||||POL123`,
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
    {
      name: "ORU^R01 (Lab Result, Inline LOINC)",
      message: `MSH|^~\\&|LAB|HOSPITAL|EMR|DEST|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ORU^R01|MSG${Date.now()}|P|2.5.1\rPID|1||TEST-0001^^^HOSPITAL^MR||TESTPATIENT^ALPHA||20000101|M\rPV1|1|O|LAB||||||||||||||||VN${Date.now().toString().slice(-6)}\rORC|RE|ORD001|FIL001\rOBR|1|ORD001|FIL001|LAB100^METABOLIC PANEL^LOCAL|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}|||||||||PROV001^TEST^PROVIDER||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||Lab|F\rOBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rOBX|2|NM|2951-2^Sodium^LN||140|mmol/L|136-145||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rOBX|3|NM|2160-0^Creatinine^LN||1.1|mg/dL|0.7-1.3||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rNTE|1|L|All results within normal limits.`,
    },
    {
      name: "ORU^R01 (Lab Result, Known LOINC)",
      message: `MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ORU^R01|MSG${Date.now()}|P|2.5.1\rPID|1||TEST-0002^^^HOSPITAL^MR||TESTPATIENT^BETA||19850515|F\rPV1|1|O|LAB||||||||||||||||VN${Date.now().toString().slice(-6)}\rORC|RE|ORD002|FIL002\rOBR|1|ORD002|FIL002|CHEM7^CHEMISTRY PANEL^LOCAL|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}|||||||||PROV002^LAB^DOCTOR||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||Lab|F\rOBX|1|NM|K_SERUM^Potassium [Serum/Plasma]^LOCAL||4.5|mmol/L|3.5-5.5||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rOBX|2|NM|NA_SERUM^Sodium [Serum/Plasma]^LOCAL||142|mmol/L|136-145||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rOBX|3|NM|GLU_FASTING^Glucose Fasting^LOCAL||95|mg/dL|70-100||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rNTE|1|L|Local codes used - LOINC mapping required.`,
    },
    {
      name: "ORU^R01 (Lab Result, Unknown LOINC)",
      message: `MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||ORU^R01|MSG${Date.now()}|P|2.5.1\rPID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M\rPV1|1|O|LAB||||||||||||||||VN${Date.now().toString().slice(-6)}\rORC|RE|ORD003|FIL003\rOBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}|||||||||PROV003^LAB^DOCTOR||||||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}||Lab|F\rOBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL||123|units|0-200||||F|||${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}\rNTE|1|L|This code has no LOINC mapping in ConceptMap.`,
    },
  ];

  const content = `
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-3xl font-bold text-gray-800">MLLP Test Client</h1>
      <div class="text-sm text-gray-500">
        Send HL7v2 messages via MLLP protocol
      </div>
    </div>

    ${
      state.error
        ? `
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex items-center gap-2 text-red-800">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span class="font-medium">Error</span>
        </div>
        <p class="mt-1 text-sm text-red-700">${state.error}</p>
      </div>
    `
        : ""
    }

    ${
      state.sent && state.response
        ? `
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
    `
        : ""
    }

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
            ${sampleMessages
              .map(
                (sample, i) => `
              <button type="button" onclick="document.querySelector('textarea[name=message]').value = decodeURIComponent('${encodeURIComponent(sample.message)}')"
                class="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-700 transition-colors">
                ${sample.name}
              </button>
            `,
              )
              .join("")}
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

  return renderLayout(
    "MLLP Test Client",
    renderNav("mllp-client", navData),
    content,
  );
}
