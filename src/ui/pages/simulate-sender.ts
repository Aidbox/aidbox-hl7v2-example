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
// for a more usable <select> with <optgroup>. Exported so Task 7's scripted
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

export function buildTemplateContext(): TemplateContext {
  const now = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
  const nowDate = now.slice(0, 8);
  const msgId = String(Date.now());
  const vnSuffix = msgId.slice(-6);
  return { now, nowDate, msgId, vnSuffix };
}

// Template builders. Keyed by stable sample id — Task 7's scripted demo
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
// "processor catching up". 10s comfortably covers multiple worker ticks
// (default POLL_INTERVAL_MS=1000ms) plus slack.
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
  if (!status || status === "received") {return "pending";}
  if (status === "code_mapping_error") {return "held";}
  if (status.endsWith("_error")) {return "error";}
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
// ZIP extraction for drag-and-drop upload
// ============================================================================

export interface ExtractedMessage {
  /** Filename relative to the archive root, e.g. "01-lab/sample.hl7". */
  name: string;
  /** Raw HL7v2 text (CR line endings stripped, caller normalizes on send). */
  content: string;
}

/**
 * Natural alphanumeric comparator — so `01-foo` sorts before `02-bar` and
 * `msg-10` sorts after `msg-2`. Handles mixed-depth paths too.
 */
export function compareAlphanumeric(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Heuristic: does this look like an HL7v2 message? */
function looksLikeHl7(text: string): boolean {
  // Accept CR, LF, and CRLF; the first non-empty line must be an MSH segment.
  const first = text.split(/\r\n|\r|\n/).find((l) => l.trim().length > 0);
  return !!first && first.startsWith("MSH|");
}

/**
 * Extract a ZIP archive into a flat list of HL7v2 messages. Reuses the
 * subprocess approach from `scripts/import-batch.ts` so we don't need to
 * add a JS zip library — `unzip` / `tar` / `Expand-Archive` are near-
 * universal on the host OS.
 */
export async function extractZipToMessages(
  zipBytes: ArrayBuffer,
): Promise<ExtractedMessage[]> {
  const { spawnSync } = await import("node:child_process");
  const { mkdtemp, readdir, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join, relative, sep } = await import("node:path");

  const workDir = await mkdtemp(join(tmpdir(), "sim-upload-"));
  const zipPath = join(workDir, "upload.zip");
  const outDir = join(workDir, "out");
  try {
    await writeFile(zipPath, Buffer.from(zipBytes));

    const attempts: Array<{ cmd: string; args: string[] }> = [];
    if (process.platform === "win32") {
      attempts.push({
        cmd: "powershell.exe",
        args: [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
        ],
      });
    } else {
      attempts.push({ cmd: "unzip", args: ["-qq", "-o", zipPath, "-d", outDir] });
      attempts.push({ cmd: "tar", args: ["-xf", zipPath, "-C", outDir] });
    }

    let lastErr = "";
    let ok = false;
    for (const { cmd, args } of attempts) {
      const result = spawnSync(cmd, args, { encoding: "utf-8" });
      if (result.status === 0) {
        ok = true;
        break;
      }
      lastErr = `${cmd}: ${result.stderr || result.stdout || `exit ${result.status}`}`;
    }
    if (!ok) {
      throw new Error(`Failed to extract archive: ${lastErr}`);
    }

    // Walk outDir recursively and collect file contents.
    const messages: ExtractedMessage[] = [];
    async function walk(dir: string): Promise<void> {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (!entry.isFile()) {continue;}
        // Skip .DS_Store and similar macOS metadata.
        if (entry.name.startsWith(".")) {continue;}
        try {
          const content = (await readFile(full, "utf-8")).trim();
          if (!looksLikeHl7(content)) {continue;}
          const rel = relative(outDir, full).split(sep).join("/");
          messages.push({ name: rel, content });
        } catch {
          // Unreadable / binary — skip.
        }
      }
    }
    await walk(outDir);

    messages.sort((a, b) => compareAlphanumeric(a.name, b.name));
    return messages;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * POST /simulate-sender/extract — multipart/form-data with a single `archive`
 * file field. Returns `{ messages: ExtractedMessage[] }` sorted by filename
 * (alphanumeric — `01-foo` before `02-bar`, `msg-2` before `msg-10`).
 */
export async function handleSimulateSenderExtract(
  req: Request,
): Promise<Response> {
  let formData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data with an `archive` file." },
      { status: 400 },
    );
  }

  const file = formData.get("archive");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Missing `archive` file in form data." },
      { status: 400 },
    );
  }

  // Rough size guard — a 50 MB zip of HL7 text would be massive at this scale.
  const MAX_BYTES = 50 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `Archive too large (${file.size} bytes > ${MAX_BYTES}).` },
      { status: 413 },
    );
  }

  try {
    const bytes = await file.arrayBuffer();
    const messages = await extractZipToMessages(bytes);
    return Response.json({ messages });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[simulate-sender] extract failed:", message);
    return Response.json({ error: message }, { status: 500 });
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

  // Drag-and-drop listeners are on window (via Alpine's .window modifier)
  // so the entire viewport — not just the simulate-editor card — is a drop
  // target. Alpine auto-removes the window listeners when this element is
  // torn down, so there's no leak on htmx navigation.
  return `
  <div x-data="simulateEditor(${groupsJson}, '${defaultId}')" x-init="refreshFromTemplate()"
       x-on:dragover.window.prevent.stop="onDragOver($event)"
       x-on:dragleave.window.prevent.stop="onDragLeave($event)"
       x-on:drop.window.prevent.stop="onDrop($event)">
    ${renderHero()}
    <div class="grid grid-cols-[minmax(0,1fr)_360px] gap-[22px] items-start">
      ${renderEditorCard()}
      <div class="flex flex-col gap-4">
        ${renderTweaksCard()}
        ${renderSendCard()}
      </div>
    </div>
    ${renderQueueCard()}
    ${renderDropOverlay()}
  </div>
  ${renderSimulateScript()}
  `;
}

/**
 * Full-page overlay that appears while the user is dragging a file onto
 * the page — tells them "yes, drop it here" and dims the UI behind so
 * the drop-target affordance is unmistakable.
 */
function renderDropOverlay(): string {
  return `
  <div x-show="dragDepth > 0"
       x-transition.opacity
       x-cloak
       class="fixed inset-0 z-[400] grid place-items-center pointer-events-none"
       style="background: rgba(234, 74, 53, 0.12); backdrop-filter: blur(2px)">
    <div class="card card-pad text-center max-w-[420px] pointer-events-auto"
         style="border: 2px dashed var(--accent)">
      <div class="text-[11px] tracking-[0.12em] uppercase text-accent-ink font-medium mb-1.5">Drop to upload</div>
      <div class="h2 mb-2">Release to queue messages</div>
      <div class="text-[13px] text-ink-2 leading-[1.5]">
        HL7v2 files, folders, or a <span class="font-mono">.zip</span> archive.
        Order is preserved alphanumerically.
      </div>
    </div>
  </div>
  `;
}

/**
 * Below-the-fold queue panel. Hidden (x-show false) until at least one
 * message is queued. Each row is clickable to load into the editor, has
 * a status chip, and a × to remove. "Send all" serially fires the queue.
 */
function renderQueueCard(): string {
  return `
  <div x-show="queue.length > 0" x-cloak class="mt-5">
    <div class="card flex flex-col overflow-hidden">
      <div class="flex items-center gap-3 py-3 px-[18px] border-b border-line bg-paper-2">
        <span class="font-mono text-[11.5px] text-ink-2 font-medium">queue.batch</span>
        <span class="chip text-[10.5px]" x-text="queue.length + ' messages'"></span>
        <span class="text-[11.5px] text-ink-3" x-show="queueBusy" x-cloak>
          <span x-text="queueProgress"></span>
        </span>
        <div class="ml-auto flex items-center gap-2">
          <button class="btn btn-ghost py-1.5 px-3 text-[12px]"
                  :disabled="queueBusy"
                  @click="clearQueue()">Clear</button>
          <button class="btn btn-primary py-1.5 px-3 text-[12px] flex items-center gap-1.5"
                  :disabled="queueBusy || queue.length === 0"
                  @click="sendQueue()">
            <template x-if="queueBusy">
              <span class="spinner w-3 h-3"></span>
            </template>
            <span x-text="queueBusy ? 'Sending…' : 'Send all'"></span>
          </button>
        </div>
      </div>
      <div class="divide-y divide-line">
        <template x-for="(item, idx) in queue" :key="item.id">
          <div class="flex items-center gap-3 px-[18px] py-2.5 cursor-pointer transition-colors relative"
               :class="activeQueueIdx === idx ? 'bg-accent-soft/70' : 'hover:bg-paper-2/60'"
               @click="loadQueueItem(idx)">
            <!-- Left accent bar: signals the queue row currently loaded into the editor. -->
            <span class="absolute left-0 top-0 bottom-0 w-[3px] bg-accent"
                  x-show="activeQueueIdx === idx" x-cloak></span>
            <span class="font-mono text-[11px] w-6 tabular-nums text-right"
                  :class="activeQueueIdx === idx ? 'text-accent-ink' : 'text-ink-3'"
                  x-text="String(idx + 1).padStart(2, '0')"></span>
            <div class="flex-1 min-w-0">
              <div class="font-mono text-[12.5px] truncate"
                   :class="activeQueueIdx === idx ? 'text-accent-ink font-medium' : 'text-ink'"
                   x-text="item.name"></div>
              <div class="font-mono text-[11px] text-ink-3 truncate" x-text="item.preview"></div>
            </div>
            <!-- Live-progression chip: distinct tones per lifecycle state so the
                 user can watch each message traverse sending → waiting → verdict. -->
            <span class="chip text-[10.5px] shrink-0 flex items-center gap-1"
                  :class="{
                    'chip-accent': item.status === 'sending' || item.status === 'waiting',
                    'chip-ok': item.status === 'sent',
                    'chip-warn': item.status === 'held' || item.status === 'pending-verdict',
                    'chip-err': item.status === 'error',
                  }">
              <template x-if="item.status === 'sending' || item.status === 'waiting'">
                <span class="spinner w-2.5 h-2.5 border-[1.5px]"></span>
              </template>
              <span x-text="queueChipLabel(item)"></span>
            </span>
            <button class="btn btn-ghost text-[11px] px-2 py-1 shrink-0"
                    :disabled="queueBusy"
                    @click.stop="removeQueueItem(idx)"
                    title="Remove">×</button>
          </div>
        </template>
      </div>
      <div class="py-2.5 px-[18px] border-t border-line bg-paper-2 text-[11px] text-ink-3 font-mono flex items-center gap-3">
        <span>drag-drop files, folders, or a .zip anywhere on the page</span>
      </div>

    </div>
  </div>
  `;
}

function renderHero(): string {
  return `
  <div>
    <div class="text-[11px] tracking-[0.1em] uppercase text-ink-3 font-medium">Compose &amp; send · MLLP</div>
    <div class="flex items-end gap-4 mt-1.5">
      <div class="flex-1">
        <h1 class="h1">Simulate Sender</h1>
        <div class="mt-1.5 text-[13.5px] text-ink-2">Pick a message type, tweak the text, fire it at the listener. Pairs with Inbound to show the whole loop.</div>
      </div>
      <!-- Drop-zone affordance. Purely discovery — the actual drop works
           anywhere on the page (outer x-data listens for dragover/drop),
           but a visible "you can drop things" chip keeps the feature from
           being invisible. Click opens the native file picker for keyboard
           / accessibility paths. The tone flips to accent while dragging. -->
      <label class="shrink-0 mb-[6px] cursor-pointer select-none rounded-[7px] border border-dashed px-3.5 py-2.5 flex items-center gap-2.5 transition-colors"
             :class="dragDepth > 0 ? 'border-accent bg-accent-soft' : 'border-line hover:border-ink-3 bg-paper-2'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
             class="shrink-0"
             :class="dragDepth > 0 ? 'text-accent-ink' : 'text-ink-3'">
          <path d="M12 3v12"/>
          <path d="m7 8 5-5 5 5"/>
          <path d="M5 21h14"/>
        </svg>
        <div class="leading-[1.35]">
          <div class="text-[12.5px] font-medium" :class="dragDepth > 0 ? 'text-accent-ink' : 'text-ink'">
            <span x-show="dragDepth === 0">Drop files, folders, or .zip</span>
            <span x-show="dragDepth > 0" x-cloak>Release to queue</span>
          </div>
          <div class="text-[10.5px]" :class="dragDepth > 0 ? 'text-accent-ink' : 'text-ink-3'">
            <span x-show="dragDepth === 0">send many at once</span>
            <span x-show="dragDepth > 0" x-cloak>…queuing</span>
          </div>
        </div>
        <input type="file" multiple accept=".hl7,.txt,.zip,application/zip"
               class="sr-only"
               x-on:change="onFilePicker($event)"/>
      </label>
    </div>
    <div class="mb-[22px]"></div>
  </div>
  `;
}

function renderEditorCard(): string {
  return `
  <div class="card flex flex-col overflow-hidden">
    <div class="flex items-center gap-2.5 py-3 px-[18px] border-b border-line bg-paper-2">
      <span class="font-mono text-[11.5px] text-ink-2 font-medium truncate" x-text="activeFileName" :title="activeFileName"></span>
      <span class="chip text-[10.5px] shrink-0" x-show="hl7Version" x-cloak>HL7v2 · <span x-text="hl7Version"></span></span>
      <span class="chip text-[10.5px] shrink-0" x-text="segmentCount + ' segments'"></span>
    </div>
    <textarea
      class="font-mono clean-scroll px-[22px] py-5 text-[13px] leading-[1.7] border-none outline-none bg-surface text-ink min-h-[360px] resize-y w-full"
      x-ref="editor"
      x-model="raw"
      spellcheck="false"
    ></textarea>
    <div class="flex items-center gap-3.5 py-2.5 px-[18px] border-t border-line bg-paper-2 text-[11.5px] text-ink-3 font-mono">
      <span>pipe-delimited · CR or LF endings ok</span>
      <span class="ml-auto"><span x-text="raw.length"></span> chars · <span x-text="segmentCount"></span> segments</span>
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
    <div class="text-[11px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-3">Sample message</div>
    <div>
      <label class="text-[11px] text-ink-3 tracking-[0.04em] uppercase">Message type</label>
      <select class="inp font-mono mt-1" x-model="sampleId" @change="refreshFromTemplate()">
        ${optgroups}
      </select>
      <div
        class="mt-[18px] text-xs leading-[1.45]"
        :class="selected.tone === 'warn' ? 'text-warn' : 'text-ink-3'"
      >
        <span x-show="selected.tone === 'warn'" class="mr-[5px] font-semibold">⚠</span>
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
        <button @click="send()" class="btn btn-primary w-full justify-center py-2.5 px-3">Send</button>
        <div class="mt-2.5 text-[11.5px] text-ink-3 text-center">
          then jump to <a href="/incoming-messages" class="text-accent-ink no-underline border-b border-accent">Inbound</a> to see it land
        </div>
      </div>
    </template>

    <template x-if="state === 'sending'">
      <div>
        <button disabled class="btn btn-primary w-full justify-center py-2.5 px-3 opacity-90 gap-2.5 cursor-default">
          <span class="spinner"></span> Sending…
        </button>
        <div class="mt-3.5 flex flex-col gap-1.5">
          <template x-for="step in sendSteps" :key="step.label">
            <div class="flex items-center gap-2.5 text-xs" :class="step.done ? 'text-ink-2' : 'text-ink-3'">
              <template x-if="step.done">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><path d="M20 6 9 17l-5-5"/></svg>
              </template>
              <template x-if="!step.done">
                <span class="spinner w-2.5 h-2.5 text-ink-3 shrink-0 border-[1.5px]"></span>
              </template>
              <span x-text="step.label"></span>
            </div>
          </template>
        </div>
        <div class="mt-3 text-center text-[10.5px] text-ink-3 font-mono">
          <span x-text="(elapsedMs / 1000).toFixed(1)"></span>s · MLLP
        </div>
      </div>
    </template>

    <template x-if="state === 'sent'">
      <div>
        <div class="py-3 px-3.5 rounded-[7px] flex items-center gap-2.5 mb-3" :class="messageStatus ? 'bg-ok-soft' : 'bg-paper-2'">
          <template x-if="messageStatus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M20 6 9 17l-5-5"/></svg>
          </template>
          <template x-if="!messageStatus">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 8v4l3 2"/></svg>
          </template>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium" :class="messageStatus ? 'text-ok' : 'text-ink'" x-text="messageStatus ? 'Sent · accepted' : 'Sent · processor catching up'"></div>
            <div class="font-mono text-[11px] text-ink-2 mt-px" x-text="ackSummary"></div>
          </div>
        </div>
        <button @click="send()" class="btn btn-primary w-full justify-center py-2.5 px-3">Send</button>
        <div class="mt-2.5 text-[11.5px] text-ink-3 text-center">
          or jump to <a href="/incoming-messages" class="text-accent-ink no-underline border-b border-accent">Inbound</a> to see it land
        </div>
      </div>
    </template>

    <template x-if="state === 'held'">
      <div>
        <div class="py-3 px-3.5 bg-warn-soft rounded-[7px] flex items-start gap-2.5 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-px"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 8v5M12 16h.01"/></svg>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-warn">Held for mapping</div>
            <div class="font-mono text-[11px] text-ink-2 mt-px" x-text="ackSummary"></div>
            <div class="text-[11.5px] text-ink-2 mt-1.5 leading-normal">Message parked in triage queue. Map the code to release it — or replay automatically once mapped.</div>
          </div>
        </div>
        <button @click="send()" class="btn btn-primary w-full justify-center py-2.5 px-3">Send</button>
        <div class="mt-2.5 text-[11.5px] text-ink-3 text-center">
          see it in <a href="/unmapped-codes" class="text-accent-ink no-underline border-b border-accent">Unmapped codes</a>
        </div>
      </div>
    </template>

    <template x-if="state === 'error'">
      <div>
        <div class="py-3 px-3.5 bg-err-soft rounded-[7px] flex items-start gap-2.5 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--err)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-px"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-medium text-err">Send failed</div>
            <div class="font-mono text-[11px] text-ink-2 mt-px whitespace-pre-wrap" x-text="errorMessage"></div>
          </div>
        </div>
        <button @click="send()" class="btn btn-primary w-full justify-center py-2.5 px-3">Send</button>
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

  /**
   * Recursively walk a DataTransferItem entry tree (from webkitGetAsEntry).
   * Pushes every file into \`collected\` as { name, content }. The name is
   * the path relative to the dropped root, joined with '/', so alphanumeric
   * sort treats \`01-lab/foo.hl7\` before \`02-admit/bar.hl7\`.
   */
  async function collectFromEntry(entry, pathPrefix, collected) {
    if (!entry) return;
    const fullName = pathPrefix ? pathPrefix + '/' + entry.name : entry.name;
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      const content = await file.text();
      if (content.trim().length > 0) {
        collected.push({ name: fullName, content });
      }
      return;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      // readEntries only returns a slice — loop until empty.
      while (true) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const child of batch) {
          await collectFromEntry(child, fullName, collected);
        }
      }
    }
  }

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
      // --- Drag & drop / batch queue state ---
      // dragDepth tracks nested dragenter/leave (the drop overlay uses it
      // via x-show). Incrementing on the outer container and decrementing
      // on dragleave avoids the "flicker" from child elements firing
      // spurious dragleave events as the pointer moves inside.
      dragDepth: 0,
      queue: [],          // [{ id, name, content, preview, status }]
      queueBusy: false,
      queueIndex: 0,
      // Tracks the queue entry currently loaded in the editor. Cleared
      // to -1 when the user picks a fresh sample from the dropdown or
      // clears the queue — so a subsequent single-Send doesn't mis-attribute
      // its outcome to a stale queue row.
      activeQueueIdx: -1,

      get selected() {
        return this.allSamples.find(s => s.id === this.sampleId) || this.allSamples[0];
      },

      get segmentCount() {
        if (!this.raw) return 0;
        return this.raw.split(/\\r\\n|\\r|\\n/).filter(Boolean).length;
      },

      // Title strip above the editor. Defaults to "message.hl7" (sample mode),
      // swaps to the actual queue-row name when the user picks from the batch.
      get activeFileName() {
        if (this.activeQueueIdx >= 0) {
          const item = this.queue[this.activeQueueIdx];
          if (item && item.name) return item.name;
        }
        return 'message.hl7';
      },

      // MSH-12 (version id). Reads from the raw editor content rather than
      // the sample metadata, so manual edits are honored. Empty → chip hidden.
      get hl7Version() {
        if (!this.raw) return '';
        const firstLine = this.raw.split(/\\r\\n|\\r|\\n/).find(l => l.trim().length > 0) || '';
        if (!firstLine.startsWith('MSH|')) return '';
        const parts = firstLine.split('|');
        return (parts[11] || '').trim();
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
        // Picking a sample from the dropdown replaces whatever was in the
        // editor — so we're no longer "sending a queue row." Reset the
        // link so the next Send doesn't back-write a stale row.
        this.activeQueueIdx = -1;
      },

      // ------ Drag & drop handlers ------
      onDragOver(ev) {
        // On the first dragover we haven't seen a dragenter — bump the
        // depth here if needed. Safari fires dragover without a preceding
        // dragenter in some cases; this keeps the overlay visible.
        if (this.dragDepth === 0) this.dragDepth = 1;
        if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave() {
        // We only decrement to zero on a true exit. Browsers fire
        // dragleave→dragenter pairs on child-boundary crossings; depth
        // accounting absorbs those. When the user truly leaves the
        // window, we stop seeing events — set to 0 on drop too.
        this.dragDepth = Math.max(0, this.dragDepth - 1);
      },
      async onDrop(ev) {
        this.dragDepth = 0;
        if (!ev.dataTransfer) return;
        try {
          await this.ingestDataTransfer(ev.dataTransfer);
        } catch (err) {
          console.error('[simulate-sender] drop failed:', err);
          // Surface at least SOMETHING — the Send card's error path is
          // scoped to single-send, so we fall back to a console + chip
          // on the first queued item.
          alert('Drop failed: ' + (err instanceof Error ? err.message : String(err)));
        }
      },

      /**
       * Keyboard / accessibility path for the drop affordance. Fires from
       * the hidden <input type="file" multiple> on the drop-zone chip, so
       * users who can't drag (keyboard nav, mobile, screen readers) can
       * still batch-upload. Delegates to the same ingest pipeline as drop.
       */
      async onFilePicker(ev) {
        const files = ev?.target?.files;
        if (!files || files.length === 0) return;
        try {
          // Fake a DataTransfer-shaped object — ingestDataTransfer only
          // reads .items and .files, and the plain-file branch only
          // needs .files.
          await this.ingestDataTransfer({
            items: [],
            files: Array.from(files),
          });
        } catch (err) {
          console.error('[simulate-sender] picker failed:', err);
          alert('Upload failed: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
          // Reset so picking the same file(s) twice still triggers change.
          if (ev?.target) ev.target.value = '';
        }
      },

      /**
       * Root dispatcher. Distinguishes:
       *   - A single .zip archive → POST /simulate-sender/extract
       *   - Folders (via webkitGetAsEntry) → recursive traversal
       *   - Plain files → read as text
       * Everything funnels into enqueueMessages() which sorts alphanumerically.
       */
      async ingestDataTransfer(dt) {
        const collected = [];

        // Prefer the items[] API — it's the only way to detect folders.
        const items = dt.items ? Array.from(dt.items) : [];
        const entries = items
          .filter(it => it.kind === 'file')
          .map(it => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null));

        if (entries.length && entries.some(e => e && e.isDirectory)) {
          // Folder-mode: traverse directory entries recursively.
          for (const entry of entries) {
            if (!entry) continue;
            await collectFromEntry(entry, '', collected);
          }
        } else {
          // Files + single-zip-archive case.
          const files = Array.from(dt.files || []);
          for (const f of files) {
            if (f.name.toLowerCase().endsWith('.zip')) {
              await this.ingestZip(f, collected);
            } else {
              const content = await f.text();
              if (content.trim().length > 0) {
                collected.push({ name: f.name, content });
              }
            }
          }
        }

        // Filter out non-HL7 files (images, PDFs, readmes) by sniffing
        // the first non-blank line. Keeps user drops of a mixed folder
        // from flooding the queue with junk.
        const hl7Only = collected.filter(c => {
          const first = c.content.split(/\\r\\n|\\r|\\n/).find(l => l.trim().length > 0);
          return first && first.startsWith('MSH|');
        });
        hl7Only.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        this.enqueueMessages(hl7Only);
      },

      async ingestZip(file, collected) {
        const fd = new FormData();
        fd.append('archive', file);
        const res = await fetch('/simulate-sender/extract', { method: 'POST', body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'HTTP ' + res.status }));
          throw new Error(err.error || 'HTTP ' + res.status);
        }
        const data = await res.json();
        for (const m of data.messages || []) {
          collected.push({ name: m.name, content: m.content });
        }
      },

      enqueueMessages(batch) {
        const next = this.queue.slice();
        let nextId = next.length > 0 ? Math.max(...next.map(q => q.id)) + 1 : 1;
        for (const m of batch) {
          const firstLine = m.content.split(/\\r\\n|\\r|\\n/).find(l => l.trim().length > 0) || '';
          next.push({
            id: nextId++,
            name: m.name,
            content: m.content,
            preview: firstLine.slice(0, 80),
            status: 'pending',
          });
        }
        this.queue = next;
        // Auto-load the first item into the editor if nothing's been typed.
        if (batch.length > 0 && !this.raw.trim()) {
          this.raw = batch[0].content.replace(/\\r/g, '\\n');
        }
      },

      loadQueueItem(idx) {
        const item = this.queue[idx];
        if (!item) return;
        this.raw = item.content.replace(/\\r/g, '\\n');
        this.activeQueueIdx = idx;
      },

      removeQueueItem(idx) {
        this.queue = this.queue.filter((_, i) => i !== idx);
        // If we removed the row before the active one, slide the index
        // down. If we removed the active one, clear it.
        if (this.activeQueueIdx === idx) this.activeQueueIdx = -1;
        else if (this.activeQueueIdx > idx) this.activeQueueIdx -= 1;
      },

      clearQueue() {
        if (this.queueBusy) return;
        this.queue = [];
        this.queueIndex = 0;
        this.activeQueueIdx = -1;
      },

      /**
       * After a single-send terminal outcome, reflect it on the queue row
       * that was loaded into the editor (if any). Same vocabulary as the
       * queue-row chips, so "Send all" will skip it via its sent/held
       * guard on a subsequent run.
       */
      syncOutcomeToActiveQueueRow(outcome) {
        if (this.activeQueueIdx < 0) return;
        const item = this.queue[this.activeQueueIdx];
        if (!item) return;
        item.status = outcome;
        // Force Alpine reactivity (in-place mutation on an array item
        // isn't always picked up without reassignment).
        this.queue = this.queue.slice();
      },

      queueChipLabel(item) {
        // Queue rows surface the full live send lifecycle so the user
        // can watch each message progress through MLLP → processor verdict.
        // Matches the Send card's steps but condensed into a chip label.
        if (item.status === 'sending') return 'sending…';
        if (item.status === 'waiting') return 'waiting for processor…';
        if (item.status === 'pending-verdict') return 'MLLP sent · no verdict';
        if (item.status === 'sent') return 'sent';
        if (item.status === 'held') return 'held for mapping';
        if (item.status === 'error') return 'error';
        return 'pending';
      },

      get queueProgress() {
        if (!this.queueBusy) return '';
        const total = this.queue.length;
        const done = this.queue.filter(q => q.status === 'sent' || q.status === 'held' || q.status === 'error').length;
        return done + ' / ' + total;
      },

      /**
       * Serially send every not-yet-terminal queue item, streaming each row
       * through the same lifecycle as the Send card:
       *   pending → sending (MLLP in flight)
       *          → waiting (MLLP ACK'd, polling processor verdict)
       *          → sent | held | error | pending-verdict (deadline hit)
       *
       * Each state flip forces a \`this.queue = this.queue.slice()\` so Alpine
       * re-renders the row mid-await. We DON'T overwrite the editor while
       * sending — the user might still be reading the content they queued.
       */
      async sendQueue() {
        if (this.queueBusy || this.queue.length === 0) return;
        this.queueBusy = true;
        try {
          for (let i = 0; i < this.queue.length; i++) {
            const item = this.queue[i];
            if (item.status === 'sent' || item.status === 'held') continue;

            item.status = 'sending';
            this.queue = this.queue.slice();

            let sendData;
            try {
              const res = await fetch('/simulate-sender/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ raw: item.content }),
              });
              sendData = await res.json();
            } catch (err) {
              item.status = 'error';
              this.queue = this.queue.slice();
              continue;
            }

            if (sendData && sendData.status === 'error') {
              item.status = 'error';
              this.queue = this.queue.slice();
              continue;
            }

            // MLLP accepted the message — now we're just waiting on the
            // processor to emit a terminal status. Show "waiting" state so
            // the user knows it's no longer on the wire.
            item.status = 'waiting';
            item.messageControlId = sendData.messageControlId;
            this.queue = this.queue.slice();

            const deadline = Date.now() + STATUS_POLL_DEADLINE_MS;
            let reached = false;
            while (Date.now() < deadline) {
              await new Promise(r => setTimeout(r, STATUS_POLL_INTERVAL_MS));
              let statusData;
              try {
                const response = await fetch('/simulate-sender/status?mcid=' + encodeURIComponent(item.messageControlId));
                statusData = await response.json();
              } catch (err) {
                continue;
              }
              if (statusData && TERMINAL_OUTCOMES.has(statusData.outcome)) {
                item.status = statusData.outcome;
                reached = true;
                this.queue = this.queue.slice();
                break;
              }
            }

            if (!reached) {
              // Deadline hit without a terminal verdict. MLLP was ACK'd, so
              // the message landed — only the processor is slow. Distinct
              // label so the user can spot it vs true "sent".
              item.status = 'pending-verdict';
              this.queue = this.queue.slice();
            }
          }
        } finally {
          this.queueBusy = false;
        }
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
          this.syncOutcomeToActiveQueueRow('error');
          return;
        }

        if (sendData.status === 'error') {
          this.stopElapsed();
          this.state = 'error';
          this.errorMessage = sendData.error || 'Send failed';
          this.syncOutcomeToActiveQueueRow('error');
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
            this.syncOutcomeToActiveQueueRow(statusData.outcome);
            return;
          }
        }

        // Deadline hit without terminal status — fall through to "processor
        // catching up" display. ACK is still real; only the processor verdict
        // is missing. Mark as sent on the queue since it DID leave MLLP
        // (the queue chip isn't a processor verdict, it's a send outcome).
        this.stopElapsed();
        this.messageStatus = '';
        this.ackSummary = this.buildAckSummary(undefined);
        this.state = 'sent';
        this.syncOutcomeToActiveQueueRow('sent');
      },
    };
  }
  </script>
  `;
}
