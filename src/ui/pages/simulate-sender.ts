/**
 * Simulate Sender page.
 *
 * Composer for HL7v2 messages: pick a message type template, tweak the raw
 * text, fire it at the local MLLP listener. After the ACK comes back, polls
 * IncomingHL7v2Message by MSH-10 to surface the post-send processor verdict
 * (sent / held for mapping / error).
 */

import { aidboxFetch, type Bundle } from "../../aidbox";
import type { IncomingHL7v2Message } from "../../fhir/aidbox-hl7v2-custom";
import { sendMLLPMessage, rewriteMessageControlId } from "../../mllp/client";
import { renderShell } from "../shell";
import { htmlResponse, getNavData } from "../shared";
import { escapeHtml } from "../../utils/html";

// ============================================================================
// Message templates
// ============================================================================
// Lifted verbatim from ai/tickets/ui-refactoring/hl7v2-v2/project/design/page-simulate.jsx:8-56.
// Exported so the Task 6 scripted demo can reuse the same samples without
// duplicating them.

export interface MessageType {
  id: string;
  label: string;
  desc: string;
  tone: "ok" | "warn";
  build: (sender: string) => string[];
}

export const MESSAGE_TYPES: MessageType[] = [
  {
    id: "ORU^R01",
    label: "ORU^R01",
    desc: "Lab result · maps cleanly",
    tone: "ok",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ORU^R01|MSG1776853125726|P|2.5.1`,
      `PID|1||TEST-0041^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M`,
      `PV1|1|O|LAB||||||||||||||||||VN125726`,
      `ORC|RE|ORD003|FIL003`,
      `OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||20260422142154`,
      `OBX|1|NM|2345-7^Glucose [Mass/volume]^LOINC||96|mg/dL|70-200|||F|`,
    ],
  },
  {
    id: "ORU^R01-unknown",
    label: "ORU^R01 · unknown code",
    desc: "Lab result · contains a code with no LOINC mapping",
    tone: "warn",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ORU^R01|MSG1776853125726|P|2.5.1`,
      `PID|1||TEST-0041^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M`,
      `PV1|1|O|LAB||||||||||||||||||VN125726`,
      `ORC|RE|ORD003|FIL003`,
      `OBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||20260422142154`,
      `OBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL||123|mg/dL|70-200|||F|`,
    ],
  },
  {
    id: "ADT^A01",
    label: "ADT^A01",
    desc: "Admit patient",
    tone: "ok",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ADT^A01|MSG1776853125726|P|2.5.1`,
      `EVN|A01|20260422142151`,
      `PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F`,
      `PV1|1|I|ICU^1^A||||123456^SMITH^JOHN^^^DR|||CAR`,
    ],
  },
  {
    id: "ADT^A08",
    label: "ADT^A08",
    desc: "Update patient info",
    tone: "ok",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ADT^A08|MSG1776853125726|P|2.5.1`,
      `EVN|A08|20260422142151`,
      `PID|1||00088412^^^HOSPITAL^MR||GARCIA^MARIA||19910304|F|||123 PINE ST^^AUSTIN^TX^78701`,
      `PV1|1|I|MED^2^B`,
    ],
  },
  {
    id: "VXU^V04",
    label: "VXU^V04",
    desc: "Immunization update · CVX-coded",
    tone: "ok",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||VXU^V04|MSG1776853125726|P|2.5.1`,
      `PID|1||PED-0412^^^HOSPITAL^MR||CHEN^LUCAS||20190511|M`,
      `ORC|RE||12345^PEDCLINIC`,
      `RXA|0|1|20260422|20260422|88^Influenza, unspecified formulation^CVX|0.5|mL||00^new immunization record|`,
    ],
  },
  {
    id: "ORM^O01",
    label: "ORM^O01",
    desc: "Order message",
    tone: "ok",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||ORM^O01|MSG1776853125726|P|2.5.1`,
      `PID|1||TEST-0042^^^HOSPITAL^MR||TESTPATIENT^DELTA||19800615|F`,
      `ORC|NW|ORD004|||SC||^^^20260422142151^^R`,
      `OBR|1|ORD004||CBC^COMPLETE BLOOD COUNT^LOCAL|||20260422142154`,
    ],
  },
  {
    id: "BAR^P01",
    label: "BAR^P01",
    desc: "Billing account add",
    tone: "ok",
    build: (sender) => [
      `MSH|^~\\&|${sender}|${sender}_FACILITY|ACME_HOSP|DEST|20260422142151||BAR^P01|MSG1776853125726|P|2.5.1`,
      `EVN|P01|20260422142151`,
      `PID|1||P12345^^^HOSPITAL^MR||DOE^JANE||19850707|F`,
      `PV1|1|I|MED^2^B`,
      `ACC|20260422|AUTO|12345|NONE`,
    ],
  },
];

export const SENDERS = ["ACME_LAB", "StMarys", "CHILDRENS", "billing"] as const;

// ============================================================================
// Send endpoint
// ============================================================================

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 3000;

export type SendOutcome = "sent" | "held" | "error";

export interface SendResult {
  status: SendOutcome;
  ack: string;
  messageControlId: string;
  messageStatus?: string;
  error?: string;
}

// HL7v2 2.5.1 caps MSH-10 (ST) at 20 characters. Format: `SIM-` (4) +
// base36 epoch-ms (~8) + `-` (1) + 4 hex random = 17 chars. Keeps outgoing
// messages spec-compliant for any downstream receiver that checks length.
function newMessageControlId(): string {
  const epoch = Date.now().toString(36);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
  return `SIM-${epoch}-${suffix}`;
}

async function pollForStatus(
  messageControlId: string,
): Promise<string | undefined> {
  const query = `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(messageControlId)}&_elements=status&_count=1`;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  const terminalStatuses = new Set([
    "processed",
    "warning",
    "code_mapping_error",
    "parsing_error",
    "conversion_error",
    "sending_error",
  ]);

  while (Date.now() < deadline) {
    const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(query);
    const status = bundle.entry?.[0]?.resource?.status;
    if (status && terminalStatuses.has(status)) {
      return status;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return undefined;
}

function outcomeFromStatus(status: string | undefined): SendOutcome {
  if (status === "code_mapping_error") return "held";
  if (status && status.endsWith("_error")) return "error";
  return "sent";
}

export async function sendSimulateMessage(raw: string): Promise<SendResult> {
  const messageControlId = newMessageControlId();
  const rewritten = rewriteMessageControlId(raw, messageControlId);
  const normalized = rewritten.replace(/\r\n/g, "\r").replace(/\n/g, "\r");

  const host = process.env.MLLP_HOST || "localhost";
  const port = parseInt(process.env.MLLP_PORT || "2575", 10);

  let ack: string;
  try {
    ack = await sendMLLPMessage(host, port, normalized);
  } catch (error) {
    return {
      status: "error",
      ack: "",
      messageControlId,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Polling is best-effort — the ACK already confirms the listener received
  // the message. If Aidbox is unreachable mid-poll, we still report the send
  // as accepted and let the Inbound page surface the real status later.
  let messageStatus: string | undefined;
  try {
    messageStatus = await pollForStatus(messageControlId);
  } catch (error) {
    console.error(
      `[simulate-sender] poll failed for ${messageControlId}:`,
      error instanceof Error ? error.message : error,
    );
  }

  return {
    status: outcomeFromStatus(messageStatus),
    ack,
    messageControlId,
    messageStatus,
  };
}

export async function handleSimulateSenderSend(req: Request): Promise<Response> {
  let body: { raw?: unknown };
  try {
    body = (await req.json()) as { raw?: unknown };
  } catch {
    return Response.json(
      { status: "error", error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const raw = typeof body.raw === "string" ? body.raw : "";
  if (!raw.trim()) {
    return Response.json(
      { status: "error", error: "Empty HL7v2 message" },
      { status: 400 },
    );
  }

  const result = await sendSimulateMessage(raw);
  return Response.json(result);
}

// ============================================================================
// Page handler
// ============================================================================

export async function handleSimulateSenderPage(): Promise<Response> {
  const navData = await getNavData();
  return htmlResponse(
    renderShell({
      active: "simulate",
      title: "Simulate Sender",
      content: renderSimulateBody(),
      navData,
    }),
  );
}

function renderSimulateBody(): string {
  const typesJson = escapeHtml(JSON.stringify(
    MESSAGE_TYPES.map(({ id, label, desc, tone, build }) => ({
      id,
      label,
      desc,
      tone,
      template: build("__SENDER__"),
    })),
  ));
  const sendersJson = escapeHtml(JSON.stringify(SENDERS));

  return `
  <div x-data="simulateEditor(${typesJson}, ${sendersJson})" x-init="refreshFromTemplate()">
    ${renderHero()}
    <div style="display:grid; grid-template-columns: minmax(0, 1fr) 360px; gap:22px; align-items:start;">
      ${renderEditorCard()}
      <div style="display:flex; flex-direction:column; gap:16px;">
        ${renderTweaksCard()}
        ${renderSendCard()}
      </div>
    </div>
  </div>
  ${renderSimulateScript()}
  `;
}

function renderHero(): string {
  return `
  <div>
    <div class="eyebrow">Compose &amp; send · MLLP</div>
    <h1 class="h1" style="margin-top:6px;">Simulate Sender</h1>
    <div class="sub">Pick a message type, tweak the text, fire it at the listener. Pairs with Inbound to show the whole loop.</div>
  </div>
  `;
}

function renderEditorCard(): string {
  return `
  <div class="card" style="display:flex; flex-direction:column; overflow:hidden;">
    <div style="display:flex; align-items:center; gap:10px; padding:12px 18px; border-bottom:1px solid var(--line); background:var(--paper-2);">
      <span class="mono" style="font-size:11.5px; color:var(--ink-2); font-weight:500;">message.hl7</span>
      <span class="chip" style="font-size:10.5px;">HL7v2 · 2.5.1</span>
      <span class="chip" style="font-size:10.5px;" x-text="segmentCount + ' segments'"></span>
    </div>
    <textarea
      class="mono clean-scroll"
      x-ref="editor"
      x-model="raw"
      spellcheck="false"
      style="padding:20px 22px; font-size:13px; line-height:1.7; border:none; outline:none; background:var(--surface); color:var(--ink); min-height:360px; resize:vertical; width:100%;"
    ></textarea>
    <div style="display:flex; align-items:center; gap:14px; padding:10px 18px; border-top:1px solid var(--line); background:var(--paper-2); font-size:11.5px; color:var(--ink-3); font-family:var(--mono);">
      <span>pipe-delimited · CR or LF endings ok</span>
      <span style="margin-left:auto;"><span x-text="raw.length"></span> chars · <span x-text="segmentCount"></span> segments</span>
    </div>
  </div>
  `;
}

function renderTweaksCard(): string {
  return `
  <div class="card card-pad">
    <div class="eyebrow" style="margin-bottom:12px;">Quick tweaks</div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      <div>
        <label style="font-size:11px; color:var(--ink-3); letter-spacing:0.04em; text-transform:uppercase;">Sender (MSH-3)</label>
        <select class="inp mono" x-model="sender" @change="refreshFromTemplate()" style="margin-top:4px;">
          <template x-for="s in senders" :key="s">
            <option :value="s" x-text="s"></option>
          </template>
        </select>
      </div>
      <div>
        <label style="font-size:11px; color:var(--ink-3); letter-spacing:0.04em; text-transform:uppercase;">Message type</label>
        <select class="inp mono" x-model="typeId" @change="refreshFromTemplate()" style="margin-top:4px;">
          <template x-for="t in types" :key="t.id">
            <option :value="t.id" x-text="t.label"></option>
          </template>
        </select>
        <div style="margin-top:6px; font-size:11.5px; line-height:1.5;" :style="selected.tone === 'warn' ? 'color:var(--warn)' : 'color:var(--ink-3)'">
          <span x-show="selected.tone === 'warn'" style="margin-right:6px; font-weight:600;">⚠</span>
          <span x-text="selected.desc"></span>
        </div>
      </div>
    </div>
  </div>
  `;
}

function renderSendCard(): string {
  return `
  <div class="card card-pad">
    <template x-if="state === 'idle'">
      <div>
        <button @click="send()" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px 12px;">Send</button>
        <div style="margin-top:10px; font-size:11.5px; color:var(--ink-3); text-align:center;">
          then jump to <a href="/incoming-messages" style="color:var(--accent-ink); text-decoration:none; border-bottom:1px solid var(--accent);">Inbound</a> to see it land
        </div>
      </div>
    </template>

    <template x-if="state === 'sending'">
      <div>
        <button disabled class="btn btn-primary" style="width:100%; justify-content:center; padding:10px 12px; opacity:0.9; gap:10px; cursor:default;">
          <span class="spinner"></span> Sending…
        </button>
        <div style="margin-top:14px; display:flex; flex-direction:column; gap:6px;">
          <template x-for="step in sendSteps" :key="step.label">
            <div style="display:flex; align-items:center; gap:10px; font-size:12px;" :style="step.done ? 'color:var(--ink-2)' : 'color:var(--ink-3)'">
              <template x-if="step.done">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </template>
              <template x-if="!step.done">
                <span class="spinner" style="width:10px; height:10px; border-width:1.5px; color:var(--ink-3);"></span>
              </template>
              <span x-text="step.label"></span>
            </div>
          </template>
        </div>
        <div style="margin-top:12px; text-align:center; font-size:10.5px; color:var(--ink-3); font-family:var(--mono);">
          <span x-text="(elapsedMs / 1000).toFixed(1)"></span>s · MLLP
        </div>
      </div>
    </template>

    <template x-if="state === 'sent'">
      <div>
        <div :style="messageStatus ? 'padding:12px 14px; background:var(--ok-soft); border-radius:7px; display:flex; align-items:center; gap:10px; margin-bottom:12px;' : 'padding:12px 14px; background:var(--paper-2); border-radius:7px; display:flex; align-items:center; gap:10px; margin-bottom:12px;'">
          <template x-if="messageStatus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M20 6 9 17l-5-5"/></svg>
          </template>
          <template x-if="!messageStatus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 8v4l3 2"/></svg>
          </template>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:500;" :style="messageStatus ? 'color:var(--ok)' : 'color:var(--ink)'" x-text="messageStatus ? 'Sent · accepted' : 'Sent · processor catching up'"></div>
            <div class="mono" style="font-size:11px; color:var(--ink-2); margin-top:1px;" x-text="ackSummary"></div>
          </div>
        </div>
        <button @click="reset()" class="btn" style="width:100%; justify-content:center;">Send another</button>
        <div style="margin-top:8px; font-size:11px; color:var(--ink-3); text-align:center;">
          or jump to <a href="/incoming-messages" style="color:var(--accent-ink); text-decoration:none; border-bottom:1px solid var(--accent);">Inbound</a> to see it land
        </div>
      </div>
    </template>

    <template x-if="state === 'held'">
      <div>
        <div style="padding:12px 14px; background:var(--warn-soft); border-radius:7px; display:flex; align-items:flex-start; gap:10px; margin-bottom:12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 8v5M12 16h.01"/></svg>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:500; color:var(--warn);">Held for mapping</div>
            <div class="mono" style="font-size:11px; color:var(--ink-2); margin-top:1px;" x-text="ackSummary"></div>
            <div style="font-size:11.5px; color:var(--ink-2); margin-top:6px; line-height:1.5;">Message parked in triage queue. Map the code to release it — or replay automatically once mapped.</div>
          </div>
        </div>
        <button @click="reset()" class="btn" style="width:100%; justify-content:center;">Send another</button>
        <div style="margin-top:8px; font-size:11px; color:var(--ink-3); text-align:center;">
          see it in <a href="/unmapped-codes" style="color:var(--accent-ink); text-decoration:none; border-bottom:1px solid var(--accent);">Unmapped codes</a>
        </div>
      </div>
    </template>

    <template x-if="state === 'error'">
      <div>
        <div style="padding:12px 14px; background:var(--err-soft); border-radius:7px; display:flex; align-items:flex-start; gap:10px; margin-bottom:12px;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:1px;"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:500; color:var(--err);">Send failed</div>
            <div class="mono" style="font-size:11px; color:var(--ink-2); margin-top:1px; white-space:pre-wrap;" x-text="errorMessage"></div>
          </div>
        </div>
        <button @click="reset()" class="btn" style="width:100%; justify-content:center;">Try again</button>
      </div>
    </template>
  </div>
  `;
}

function renderSimulateScript(): string {
  // Alpine factory — registered globally so the templates above can x-data="simulateEditor(...)".
  // The `types` arg has each template pre-built with __SENDER__ placeholder so swapping senders
  // is a pure string replace on the client with no server round-trip.
  return `
  <script>
  function simulateEditor(types, senders) {
    return {
      types,
      senders,
      typeId: 'ORU^R01-unknown',
      sender: 'ACME_LAB',
      raw: '',
      state: 'idle',
      elapsedMs: 0,
      elapsedTimer: null,
      ackSummary: '',
      errorMessage: '',
      messageStatus: '',

      get selected() {
        return this.types.find(t => t.id === this.typeId) || this.types[0];
      },

      get segmentCount() {
        if (!this.raw) return 0;
        return this.raw.split(/\\r\\n|\\r|\\n/).filter(Boolean).length;
      },

      get sendSteps() {
        return [
          { label: 'Open MLLP connection', done: this.elapsedMs > 200 },
          { label: 'Transmit message', done: this.elapsedMs > 600 },
          { label: 'Await ACK from listener', done: this.elapsedMs > 1100 },
        ];
      },

      refreshFromTemplate() {
        const t = this.selected;
        this.raw = t.template.map(line => line.replace(/__SENDER__/g, this.sender)).join('\\n');
      },

      reset() {
        this.state = 'idle';
        this.elapsedMs = 0;
        this.ackSummary = '';
        this.errorMessage = '';
        this.messageStatus = '';
        if (this.elapsedTimer) clearInterval(this.elapsedTimer);
        this.elapsedTimer = null;
      },

      async send() {
        this.state = 'sending';
        this.elapsedMs = 0;
        const started = Date.now();
        this.elapsedTimer = setInterval(() => {
          this.elapsedMs = Date.now() - started;
        }, 50);

        try {
          const response = await fetch('/simulate-sender/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: this.raw }),
          });
          const data = await response.json();
          clearInterval(this.elapsedTimer);
          this.elapsedTimer = null;

          if (data.status === 'error') {
            this.state = 'error';
            this.errorMessage = data.error || 'Send failed';
            return;
          }

          this.messageStatus = data.messageStatus || '';
          const statusLabel = data.messageStatus || 'pending';
          this.ackSummary = 'ACK · MSH-10 ' + data.messageControlId + ' · status ' + statusLabel;
          this.state = data.status;
        } catch (err) {
          clearInterval(this.elapsedTimer);
          this.elapsedTimer = null;
          this.state = 'error';
          this.errorMessage = err instanceof Error ? err.message : String(err);
        }
      },
    };
  }
  </script>
  `;
}
