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
// Restored from `main` branch's MLLP test client so the samples keep their
// clinical detail and realistic sender identities; grouped by message type
// for a more usable <select> with <optgroup>. Exported so Task 6's scripted
// demo can reuse the same samples via stable ids without re-hardcoding them.

export interface MessageSample {
  id: string;
  name: string;
  tone: "ok" | "warn";
  desc: string;
}

export interface MessageGroup {
  type: string;
  label: string;
  messages: MessageSample[];
}

interface TemplateContext {
  now: string;
  nowDate: string;
  msgId: string;
  vnSuffix: string;
}

function buildTemplateContext(): TemplateContext {
  const now = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
  const nowDate = now.slice(0, 8);
  const msgId = String(Date.now());
  const vnSuffix = msgId.slice(-6);
  return { now, nowDate, msgId, vnSuffix };
}

// Template builders. Keyed by stable sample id — Task 6's scripted demo
// imports this map and looks up by id. Keeping the id strings short and
// meaningful so code-search for "adt-a01-full" finds both the scheduler
// and the producer.
export const SAMPLE_BUILDERS: Record<string, (ctx: TemplateContext) => string> = {
  "adt-a01-simple": ({ now }) =>
    `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|${now}||ADT^A01|MSG${now}|P|2.4\rEVN|A01|${now}\rPID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||123 Main St^^Anytown^CA^12345||555-555-5555\rPV1|1|I|ICU^101^A|E|||12345^Jones^Mary^A|||MED||||1|||12345^Jones^Mary^A|IN||||||||||||||||||||||||||${now}`,

  "adt-a01-full": ({ now, nowDate, msgId }) =>
    `MSH|^~\\&|SENDER|FACILITY|RECEIVER|DEST|${now}||ADT^A01^ADT_A01|MSG${msgId}|P|2.5.1|||AL|AL\rEVN|A01|${now}|||OPERATOR\rPID|1||P12345^^^HOSPITAL^MR||Smith^John^Robert||19850315|M|||123 Main St^^Anytown^CA^12345^USA||^PRN^PH^^1^555^1234567|^WPN^PH^^1^555^9876543||M||P12345\rPV1|1|I|WARD1^ROOM1^BED1||||123^ATTENDING^DOCTOR|||MED||||ADM|||||VN001|||||||||||||||||||||||||||${now}\rNK1|1|Smith^Jane||456 Oak St^^Othertown^CA^54321^USA|^PRN^PH^^1^555^5551234||||||||||||||||||||||||||||||||\rDG1|1||I10^Essential Hypertension^ICD10||${nowDate}|||||||||||001^PHYSICIAN^DIAGNOSING\rAL1|1|DA|PCN^Penicillin^RXNORM|SV|Rash||\rIN1|1|BCBS^Blue Cross Blue Shield||Blue Cross||||GRP001|Blue Cross Group|||20230101|20231231||HMO||SEL|||||||||||||||||||POL123`,

  "adt-a08-update": ({ now }) =>
    `MSH|^~\\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|${now}||ADT^A08|MSG${now}|P|2.4\rEVN|A08|${now}\rPID|1||12345^^^HOSPITAL^MR||Smith^John^A||19800101|M|||456 New St^^Newtown^CA^54321||555-555-1234`,

  "bar-p01-add-account": ({ now, msgId }) =>
    `MSH|^~\\&|BILLING|HOSPITAL|RECEIVER|FAC|${now}||BAR^P01|MSG${msgId}|P|2.5\rEVN|P01|${now}\rPID|1||MRN12345||Doe^Jane^M||19850315|F\rPV1|1|O|CLINIC^201||||||12345^Smith^Robert|||||||||||ACCT001`,

  "orm-o01-order": ({ now, msgId }) =>
    `MSH|^~\\&|ORDER_SYS|HOSPITAL|LAB|LAB_FAC|${now}||ORM^O01|MSG${msgId}|P|2.4\rPID|1||PAT001^^^HOSP^MR||Johnson^Mary||19900520|F\rORC|NW|ORD001||||||||||12345^Doctor^Test\rOBR|1|ORD001||CBC^Complete Blood Count^L|||${now}`,

  "oru-r01-inline-loinc": ({ now, msgId, vnSuffix }) =>
    `MSH|^~\\&|LAB|HOSPITAL|EMR|DEST|${now}||ORU^R01|MSG${msgId}|P|2.5.1\rPID|1||TEST-0001^^^HOSPITAL^MR||TESTPATIENT^ALPHA||20000101|M\rPV1|1|O|LAB||||||||||||||||VN${vnSuffix}\rORC|RE|ORD001|FIL001\rOBR|1|ORD001|FIL001|LAB100^METABOLIC PANEL^LOCAL|||${now}|||||||||PROV001^TEST^PROVIDER||||||${now}||Lab|F\rOBX|1|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.5||||F|||${now}\rOBX|2|NM|2951-2^Sodium^LN||140|mmol/L|136-145||||F|||${now}\rOBX|3|NM|2160-0^Creatinine^LN||1.1|mg/dL|0.7-1.3||||F|||${now}\rNTE|1|L|All results within normal limits.`,

  "oru-r01-known-loinc": ({ now, msgId, vnSuffix }) =>
    `MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|${now}||ORU^R01|MSG${msgId}|P|2.5.1\rPID|1||TEST-0002^^^HOSPITAL^MR||TESTPATIENT^BETA||19850515|F\rPV1|1|O|LAB||||||||||||||||VN${vnSuffix}\rORC|RE|ORD002|FIL002\rOBR|1|ORD002|FIL002|CHEM7^CHEMISTRY PANEL^LOCAL|||${now}|||||||||PROV002^LAB^DOCTOR||||||${now}||Lab|F\rOBX|1|NM|K_SERUM^Potassium [Serum/Plasma]^LOCAL||4.5|mmol/L|3.5-5.5||||F|||${now}\rOBX|2|NM|NA_SERUM^Sodium [Serum/Plasma]^LOCAL||142|mmol/L|136-145||||F|||${now}\rOBX|3|NM|GLU_FASTING^Glucose Fasting^LOCAL||95|mg/dL|70-100||||F|||${now}\rNTE|1|L|Local codes used - LOINC mapping required.`,

  "oru-r01-unknown-loinc": ({ now, msgId, vnSuffix }) =>
    `MSH|^~\\&|ACME_LAB|ACME_HOSP|EMR|DEST|${now}||ORU^R01|MSG${msgId}|P|2.5.1\rPID|1||TEST-0003^^^HOSPITAL^MR||TESTPATIENT^GAMMA||19901225|M\rPV1|1|O|LAB||||||||||||||||VN${vnSuffix}\rORC|RE|ORD003|FIL003\rOBR|1|ORD003|FIL003|CHEM7^CHEMISTRY PANEL^LOCAL|||${now}|||||||||PROV003^LAB^DOCTOR||||||${now}||Lab|F\rOBX|1|NM|UNKNOWN_TEST^Unknown Lab Test^LOCAL||123|units|0-200||||F|||${now}\rNTE|1|L|This code has no LOINC mapping in ConceptMap.`,

  "vxu-v04-covid-flu": ({ now, nowDate }) =>
    `MSH|^~\\&|EHR_APP|CLINIC_A^54321|IIS_RECV|STATE_DOH|${now}||VXU^V04^VXU_V04|VXU${now}-001|P|2.8.2|||AL|AL|||||Z32^CDCPHINVS\rPID|1||PAT100^^^CLINIC_A^MR||TESTPATIENT^DELTA^M^^^L||20100615|M||2054-5^Black or African American^CDCREC|100 ELM ST^^PORTLAND^OR^97201^USA||^PRN^PH^^^503^5550100\rPD1|||CLINIC_A^54321^L|||||02^Reminder/Recall - any method^HL70215\rNK1|1|TESTPATIENT^ALICE^L|MTH^Mother^HL70063|100 ELM ST^^PORTLAND^OR^97201^USA|^PRN^PH^^^503^5550101\rORC|RE||IMM${now}-001^CLINIC_A||||||${nowDate}|||5678^PROVIDER^SARAH^J^^^MD^NPI^L|||CLINIC_A^54321^L\rRXA|0|1|${nowDate}|${nowDate}|207^COVID-19 mRNA, LNP-S, PF, 30 mcg/0.3 mL dose^CVX|0.3|mL^milliliter^UCUM||00^New immunization record^NIP001|5678^PROVIDER^SARAH^J^^^MD^NPI^L|^^^CLINIC_A^54321^L||||LOT12345|20271231|PFR^Pfizer^MVX|||CP|A\rRXR|IM^Intramuscular^HL70162|LD^Left Deltoid^HL70163\rOBX|1|CE|64994-7^Vaccine funding program eligibility category^LN|1|V02^VFC eligible - Medicaid^HL70064||||||F\rOBX|2|CE|69764-9^Document type^LN|2|253088698300026411121116^COVID-19 Vaccine^cdcgs1vis||||||F\rOBX|3|TS|29768-9^Date vaccine information statement published^LN|2|20230806||||||F\rOBX|4|TS|29769-7^Date vaccine information statement presented^LN|2|${nowDate}||||||F\rORC|RE||IMM${now}-002^CLINIC_A||||||${nowDate}|||5678^PROVIDER^SARAH^J^^^MD^NPI^L|||CLINIC_A^54321^L\rRXA|0|1|${nowDate}|${nowDate}|158^Influenza, injectable, quadrivalent^CVX|0.5|mL^milliliter^UCUM||00^New immunization record^NIP001|5678^PROVIDER^SARAH^J^^^MD^NPI^L|^^^CLINIC_A^54321^L||||FLULOT789|20270601|SKB^GlaxoSmithKline^MVX|||CP|A\rRXR|IM^Intramuscular^HL70162|RD^Right Deltoid^HL70163\rOBX|1|CE|64994-7^Vaccine funding program eligibility category^LN|1|V02^VFC eligible - Medicaid^HL70064||||||F`,

  "vxu-v04-full-pd1-nk1-obx": () =>
    `MSH|^~\\&|EMR_SYS|SAMPLE_CLINIC^99999|STATE_IIS|STATE_DOH|20260211103000-0800||VXU^V04^VXU_V04|VXU20260211-00001|P|2.5.1|||AL|AL|||||Z32^CDCPHINVS\rPID|1||PAT200^^^SAMPLE_CLINIC^MR||TESTPATIENT^ECHO^A^^^L||20141023|F||2106-3^White^CDCREC|500 MAPLE AVE^^ANYTOWN^WA^98000^USA||^PRN^PH^^^555^5550200|^NET^Internet^test@example.com||S\rPD1|||SAMPLE_CLINIC^99999^L|||||02^Reminder/Recall - any method^HL70215|||N^No^HL70136\rNK1|1|TESTPATIENT^FRANK^B|FTH^Father^HL70063|500 MAPLE AVE^^ANYTOWN^WA^98000^USA|^PRN^PH^^^555^5550201\rORC|RE||IMM20260211-990011^SAMPLE_CLINIC||||||20260211|||9876^DOCTOR^LISA^M^^^MD^NPI^L|||SAMPLE_CLINIC^99999^L\rRXA|0|1|20260211|20260211|207^COVID-19 mRNA, LNP-S, PF, 30 mcg/0.3 mL dose^CVX|0.3|mL^milliliter^UCUM||00^New immunization record^NIP001|9876^DOCTOR^LISA^M^^^MD^NPI^L|^^^SAMPLE_CLINIC^99999^L||||SAMPLELT456|20270131|PFR^Pfizer^MVX|||CP|A\rRXR|IM^Intramuscular^HL70162|RA^Right Arm^HL70163\rOBX|1|CE|64994-7^Vaccine funding program eligibility category^LN|1|V02^VFC eligible - Medicaid^HL70064||||||F\rOBX|2|CE|69764-9^Document type^LN|2|253088698300026411121116^COVID-19 Vaccine^cdcgs1vis||||||F\rOBX|3|TS|29768-9^Date vaccine information statement published^LN|2|20230806||||||F\rOBX|4|TS|29769-7^Date vaccine information statement presented^LN|2|20260211||||||F`,

  "vxu-v04-broken-snomed": () =>
    `MSH|^~\\&|TEST_APP|TEST_CLINIC|||20231005162929.774+0000||VXU^V04^VXU_V04|MSG0000020000001|P|2.5.1\rPID|1||PAT300^^^^FI||TESTPATIENT^ZETA||20000101|U||2076-8^Native Hawaiian or Other Pacific Islander^HL70005|100 TEST ST^^ANYTOWN^CA^99999^USA|||||||||||U^Unknown^HL70189\rPV1|1|R||||||||||||||||||||||||||||||||||||||||||20230906050813\rRXA|0|1|||1119349007^COVID-19 mRNA vaccine^SCT|40 mg|||||||||1|20190815|^Generic\rRXR|78421000^ID (Intradermal) Route^HL70162|368209003^Left Deltoid (Upper arm)^HL70163`,
};

export const MESSAGE_GROUPS: MessageGroup[] = [
  {
    type: "ADT",
    label: "ADT (Admit/Discharge/Transfer)",
    messages: [
      { id: "adt-a01-simple", name: "ADT^A01 (Admit - Simple)", tone: "ok", desc: "Inpatient admit · minimal PID/PV1" },
      { id: "adt-a01-full", name: "ADT^A01 (Admit - Full)", tone: "ok", desc: "Inpatient admit · NK1/DG1/AL1/IN1" },
      { id: "adt-a08-update", name: "ADT^A08 (Update)", tone: "ok", desc: "Patient demographic update" },
    ],
  },
  {
    type: "BAR",
    label: "BAR (Billing Account Record)",
    messages: [
      { id: "bar-p01-add-account", name: "BAR^P01 (Add Account)", tone: "ok", desc: "Add billing account" },
    ],
  },
  {
    type: "ORM",
    label: "ORM (Orders)",
    messages: [
      { id: "orm-o01-order", name: "ORM^O01 (Order)", tone: "ok", desc: "New CBC order" },
    ],
  },
  {
    type: "ORU",
    label: "ORU (Observation Results)",
    messages: [
      { id: "oru-r01-inline-loinc", name: "ORU^R01 (Lab Result, Inline LOINC)", tone: "ok", desc: "Metabolic panel · direct LOINC codes" },
      { id: "oru-r01-known-loinc", name: "ORU^R01 (Lab Result, Known LOINC)", tone: "ok", desc: "Local codes with established ConceptMap" },
      { id: "oru-r01-unknown-loinc", name: "ORU^R01 (Lab Result, Unknown LOINC)", tone: "warn", desc: "Contains a code with no LOINC mapping — triggers code_mapping_error" },
    ],
  },
  {
    type: "VXU",
    label: "VXU (Vaccination Update)",
    messages: [
      { id: "vxu-v04-covid-flu", name: "VXU^V04 (v2.8.2, COVID-19 + Influenza)", tone: "ok", desc: "Two RXA groups · CVX-coded" },
      { id: "vxu-v04-full-pd1-nk1-obx", name: "VXU^V04 (v2.5.1, Full with PD1/NK1/OBX)", tone: "ok", desc: "Single dose · OBX attestation records" },
      { id: "vxu-v04-broken-snomed", name: "VXU^V04 (Broken - SNOMED in RXA, missing dates)", tone: "warn", desc: "Non-conformant · SNOMED in place of CVX, missing administration dates" },
    ],
  },
];

const DEFAULT_SAMPLE_ID = "oru-r01-unknown-loinc";

// ============================================================================
// Send endpoint — MLLP only, returns as soon as ACK arrives. The client
// polls /simulate-sender/status separately so the "Receive ACK" and
// "Wait for processing" UI steps flip on real, independent events.
// ============================================================================

// How long the client polls /status after ACK before giving up and showing
// "processor catching up". 10s comfortably covers one full worker tick
// (default POLL_INTERVAL_MS=5000ms) plus slack.
export const STATUS_POLL_DEADLINE_MS = 10000;
export const STATUS_POLL_INTERVAL_MS = 500;

export type SendOutcome = "sent" | "held" | "error" | "pending";

export interface SendResult {
  status: "sent" | "error";
  ack: string;
  messageControlId: string;
  error?: string;
}

export interface StatusResult {
  outcome: SendOutcome;
  messageStatus?: string;
}

// HL7v2 2.5.1 caps MSH-10 (ST) at 20 characters. Format: `SIM-` (4) +
// base36 epoch-ms (~8) + `-` (1) + 4 hex random = 17 chars. Keeps outgoing
// messages spec-compliant for any downstream receiver that checks length.
function newMessageControlId(): string {
  const epoch = Date.now().toString(36);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4);
  return `SIM-${epoch}-${suffix}`;
}

// Anything other than the initial `received` means the worker has made a
// verdict — treat as terminal. Avoids duplicating the status vocabulary
// from CLAUDE.md / error-statuses.md; new statuses added to the system
// automatically roll up as terminal here.
function outcomeFromStatus(status: string | undefined): SendOutcome {
  if (!status || status === "received") return "pending";
  if (status === "code_mapping_error") return "held";
  if (status.endsWith("_error")) return "error";
  return "sent";
}

export async function sendSimulateMessage(raw: string): Promise<SendResult> {
  const messageControlId = newMessageControlId();
  const rewritten = rewriteMessageControlId(raw, messageControlId);
  const normalized = rewritten.replace(/\r\n/g, "\r").replace(/\n/g, "\r");

  const host = process.env.MLLP_HOST || "localhost";
  const port = parseInt(process.env.MLLP_PORT || "2575", 10);

  try {
    const ack = await sendMLLPMessage(host, port, normalized);
    return { status: "sent", ack, messageControlId };
  } catch (error) {
    return {
      status: "error",
      ack: "",
      messageControlId,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fetchMessageStatus(
  messageControlId: string,
): Promise<StatusResult> {
  const query = `/fhir/IncomingHL7v2Message?message-control-id=${encodeURIComponent(messageControlId)}&_elements=status&_count=1`;
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(query);
  const status = bundle.entry?.[0]?.resource?.status;
  return { outcome: outcomeFromStatus(status), messageStatus: status };
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

export async function handleSimulateSenderStatus(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const mcid = url.searchParams.get("mcid") || "";
  if (!mcid) {
    // 400 body intentionally carries no `outcome` — the SendOutcome vocabulary
    // (sent/held/error/pending) describes processor verdicts, not request
    // validity. A malformed request shouldn't masquerade as a real terminal.
    return Response.json(
      { error: "Missing mcid parameter" },
      { status: 400 },
    );
  }

  try {
    const result = await fetchMessageStatus(mcid);
    return Response.json(result);
  } catch (error) {
    // Aidbox unreachable — the caller keeps polling and will eventually
    // give up via its own timeout. Not an error state for the UI yet.
    console.error(
      `[simulate-sender] status lookup failed for ${mcid}:`,
      error instanceof Error ? error.message : error,
    );
    return Response.json({ outcome: "pending" });
  }
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
  const ctx = buildTemplateContext();
  const groupsPayload = MESSAGE_GROUPS.map((group) => ({
    type: group.type,
    label: group.label,
    messages: group.messages.map((sample) => ({
      id: sample.id,
      name: sample.name,
      tone: sample.tone,
      desc: sample.desc,
      // Pre-rendered template — Alpine just swaps it into the textarea.
      template: SAMPLE_BUILDERS[sample.id]!(ctx),
    })),
  }));
  const groupsJson = escapeHtml(JSON.stringify(groupsPayload));
  const defaultId = escapeHtml(DEFAULT_SAMPLE_ID);

  return `
  <div x-data="simulateEditor(${groupsJson}, '${defaultId}')" x-init="refreshFromTemplate()">
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
    <div class="sub" style="margin-bottom:22px;">Pick a message type, tweak the text, fire it at the listener. Pairs with Inbound to show the whole loop.</div>
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
  // Options are rendered server-side (rather than via Alpine x-for inside
  // optgroup) because Alpine x-for evaluates *after* x-model sets the
  // select's value, so a dynamic optgroup leaves the select visually stuck
  // on the first DOM option. The option set is static anyway — no value
  // in spending client cycles to re-render it.
  const optgroups = MESSAGE_GROUPS.map((group) => {
    const options = group.messages
      .map((sample) => {
        const selected = sample.id === DEFAULT_SAMPLE_ID ? " selected" : "";
        return `<option value="${escapeHtml(sample.id)}"${selected}>${escapeHtml(sample.name)}</option>`;
      })
      .join("");
    return `<optgroup label="${escapeHtml(group.label)}">${options}</optgroup>`;
  })
    .join("");

  return `
  <div class="card card-pad">
    <div class="eyebrow" style="margin-bottom:12px;">Sample message</div>
    <div>
      <label style="font-size:11px; color:var(--ink-3); letter-spacing:0.04em; text-transform:uppercase;">Message type</label>
      <select class="inp mono" x-model="sampleId" @change="refreshFromTemplate()" style="margin-top:4px;">
        ${optgroups}
      </select>
      <div
        style="margin-top:18px; font-size:12px; line-height:1.45;"
        :style="{ color: selected.tone === 'warn' ? 'var(--warn)' : 'var(--ink-3)' }"
      >
        <span x-show="selected.tone === 'warn'" style="margin-right:5px; font-weight:600;">⚠</span>
        <span x-text="selected.desc"></span>
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
            <div style="display:flex; align-items:center; gap:10px; font-size:12px;" :style="{ color: step.done ? 'var(--ink-2)' : 'var(--ink-3)' }">
              <template x-if="step.done">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M20 6 9 17l-5-5"/></svg>
              </template>
              <template x-if="!step.done">
                <span class="spinner" style="width:10px; height:10px; border-width:1.5px; color:var(--ink-3); flex-shrink:0;"></span>
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
        <div style="padding:12px 14px; border-radius:7px; display:flex; align-items:center; gap:10px; margin-bottom:12px;" :style="{ background: messageStatus ? 'var(--ok-soft)' : 'var(--paper-2)' }">
          <template x-if="messageStatus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M20 6 9 17l-5-5"/></svg>
          </template>
          <template x-if="!messageStatus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 8v4l3 2"/></svg>
          </template>
          <div style="flex:1; min-width:0;">
            <div style="font-size:13px; font-weight:500;" :style="{ color: messageStatus ? 'var(--ok)' : 'var(--ink)' }" x-text="messageStatus ? 'Sent · accepted' : 'Sent · processor catching up'"></div>
            <div class="mono" style="font-size:11px; color:var(--ink-2); margin-top:1px;" x-text="ackSummary"></div>
          </div>
        </div>
        <button @click="send()" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px 12px;">Send</button>
        <div style="margin-top:10px; font-size:11.5px; color:var(--ink-3); text-align:center;">
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
        <button @click="send()" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px 12px;">Send</button>
        <div style="margin-top:10px; font-size:11.5px; color:var(--ink-3); text-align:center;">
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
        <button @click="send()" class="btn btn-primary" style="width:100%; justify-content:center; padding:10px 12px;">Send</button>
      </div>
    </template>
  </div>
  `;
}

function renderSimulateScript(): string {
  // Alpine factory — registered globally so the template above can x-data="simulateEditor(...)".
  // Templates are pre-rendered server-side; Alpine just swaps the selected sample's
  // pre-built string into the textarea when the user picks a new <option>.
  return `
  <script>
  const STATUS_POLL_DEADLINE_MS = ${STATUS_POLL_DEADLINE_MS};
  const STATUS_POLL_INTERVAL_MS = ${STATUS_POLL_INTERVAL_MS};
  const TERMINAL_OUTCOMES = new Set(['sent', 'held', 'error']);

  function simulateEditor(groups, defaultId) {
    // Flatten for fast lookup.
    const allSamples = groups.flatMap(g => g.messages);

    return {
      groups,
      allSamples,
      sampleId: defaultId,
      raw: '',
      state: 'idle',
      elapsedMs: 0,
      elapsedTimer: null,
      ackReceived: false,
      ackSummary: '',
      errorMessage: '',
      messageStatus: '',
      messageControlId: '',

      get selected() {
        return this.allSamples.find(s => s.id === this.sampleId) || this.allSamples[0];
      },

      get segmentCount() {
        if (!this.raw) return 0;
        return this.raw.split(/\\r\\n|\\r|\\n/).filter(Boolean).length;
      },

      get sendSteps() {
        // All three are real signals. Step 1 flips on click. Step 2 flips when
        // the /send response lands (MLLP listener ACK'd). Step 3 only flips
        // when the client-side poll of /status sees a terminal outcome, at
        // which point the view transitions out of the sending card.
        return [
          { label: 'Send', done: true },
          { label: 'Receive ACK', done: this.ackReceived },
          { label: 'Wait for processing', done: false },
        ];
      },

      refreshFromTemplate() {
        // The pre-rendered template uses CR; textarea shows LF for edit
        // sanity. Send path re-normalizes.
        this.raw = this.selected.template.replace(/\\r/g, '\\n');
      },

      startElapsed(startedAt) {
        this.elapsedTimer = setInterval(() => {
          this.elapsedMs = Date.now() - startedAt;
        }, 50);
      },

      stopElapsed() {
        if (this.elapsedTimer) clearInterval(this.elapsedTimer);
        this.elapsedTimer = null;
      },

      buildAckSummary(status) {
        return 'ACK · MSH-10 ' + this.messageControlId + ' · status ' + (status || 'pending');
      },

      async send() {
        this.state = 'sending';
        this.elapsedMs = 0;
        this.ackReceived = false;
        this.ackSummary = '';
        this.errorMessage = '';
        this.messageStatus = '';
        this.messageControlId = '';
        this.startElapsed(Date.now());

        let sendData;
        try {
          const response = await fetch('/simulate-sender/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: this.raw }),
          });
          sendData = await response.json();
        } catch (err) {
          this.stopElapsed();
          this.state = 'error';
          this.errorMessage = err instanceof Error ? err.message : String(err);
          return;
        }

        if (sendData.status === 'error') {
          this.stopElapsed();
          this.state = 'error';
          this.errorMessage = sendData.error || 'Send failed';
          return;
        }

        this.ackReceived = true;
        this.messageControlId = sendData.messageControlId;

        // Poll /status until we see a terminal outcome. Deadline starts *now*
        // (after ACK) so the full processor-wait budget is honored regardless
        // of how long MLLP took.
        const deadline = Date.now() + STATUS_POLL_DEADLINE_MS;
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, STATUS_POLL_INTERVAL_MS));
          let statusData;
          try {
            const statusResponse = await fetch('/simulate-sender/status?mcid=' + encodeURIComponent(this.messageControlId));
            statusData = await statusResponse.json();
          } catch (err) {
            // Transient fetch failure — keep polling; the deadline caps it.
            continue;
          }
          if (TERMINAL_OUTCOMES.has(statusData.outcome)) {
            this.stopElapsed();
            this.messageStatus = statusData.messageStatus || '';
            this.ackSummary = this.buildAckSummary(statusData.messageStatus);
            this.state = statusData.outcome;
            return;
          }
        }

        // Deadline hit without terminal status — fall through to "processor
        // catching up" display. ACK is still real; only the processor verdict
        // is missing.
        this.stopElapsed();
        this.messageStatus = '';
        this.ackSummary = this.buildAckSummary(undefined);
        this.state = 'sent';
      },
    };
  }
  </script>
  `;
}
