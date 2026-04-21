/**
 * Check whether an HL7v2 message is supported by the pipeline.
 *
 * Runs: parse -> preprocess -> convert, then summarizes.
 *
 * Usage:
 *   bun scripts/check-message-support.ts <file.hl7>           # brief summary
 *   bun scripts/check-message-support.ts <file.hl7> --json    # full result JSON
 *
 * Requires Aidbox running (the converter calls resourceExists and reads config).
 */

import { parseMessage } from "@atomic-ehr/hl7v2";
import { convertToFHIR } from "../src/v2-to-fhir/converter";
import { preprocessMessage } from "../src/v2-to-fhir/preprocessor";
import { hl7v2ToFhirConfig } from "../src/v2-to-fhir/config";
import { fromMSH } from "../src/hl7v2/generated/fields";

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const path = args.find((a) => !a.startsWith("--"));

if (!path) {
  console.error("usage: bun scripts/check-message-support.ts <file.hl7> [--json]");
  process.exit(2);
}

const rawFile = await Bun.file(path).text();
// Strip MLLP framing bytes if present and normalize line endings.
const raw = rawFile
  .replace(/\x0b|\x1c|\x0d\x0a|\r|\n/g, (m) => (m === "\x0b" || m === "\x1c" ? "" : "\r"));

let parsed;
try {
  parsed = parseMessage(raw);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  if (jsonMode) {
    console.log(JSON.stringify({ stage: "parse", error: msg }, null, 2));
  } else {
    console.log(`Parse:      FAIL`);
    console.log(`Error:      ${msg}`);
    console.log(`Verdict:    not supported — message is malformed (sender must fix)`);
  }
  process.exit(1);
}

const mshSegment = parsed.find((s) => s.segment === "MSH");
if (!mshSegment) {
  const msg = "MSH segment missing";
  if (jsonMode) {
    console.log(JSON.stringify({ stage: "parse", error: msg }, null, 2));
  } else {
    console.log(`Parse:      FAIL`);
    console.log(`Error:      ${msg}`);
    console.log(`Verdict:    not supported — no MSH`);
  }
  process.exit(1);
}

const msh = fromMSH(mshSegment);
const msgCode = msh.$9_messageType?.$1_code ?? "";
const msgEvent = msh.$9_messageType?.$2_event ?? "";
const msgType = msgCode && msgEvent ? `${msgCode}^${msgEvent}` : "unknown";
const version = msh.$12_version?.$1_version ?? "unknown";
const sendingApp = msh.$3_sendingApplication?.$1_namespace ?? "";
const sendingFac = msh.$4_sendingFacility?.$1_namespace ?? "";

const config = hl7v2ToFhirConfig();
const preprocessed = preprocessMessage(parsed, config);

let result;
try {
  result = await convertToFHIR(preprocessed);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  const isUnsupportedType = /unsupported message type/i.test(msg);
  if (jsonMode) {
    console.log(
      JSON.stringify(
        { stage: "convert", messageType: msgType, version, error: msg },
        null,
        2,
      ),
    );
  } else {
    console.log(`Message:    ${msgType} (v${version})`);
    console.log(`Sender:     ${sendingApp} / ${sendingFac}`);
    console.log(`Routing:    FAIL`);
    console.log(`Error:      ${msg}`);
    console.log(
      `Verdict:    ${isUnsupportedType ? "NOT supported — no converter registered for this message type" : "routing failed"}`,
    );
  }
  process.exit(1);
}

if (jsonMode) {
  console.log(JSON.stringify({ messageType: msgType, version, ...result }, null, 2));
  process.exit(0);
}

const status = result.messageUpdate.status ?? "(no status)";
const error = result.messageUpdate.error;
const bundle = result.bundle;

console.log(`Message:    ${msgType} (v${version})`);
console.log(`Sender:     ${sendingApp} / ${sendingFac}`);
console.log(`Routing:    OK`);
console.log(`Status:     ${status}`);

if (bundle?.entry?.length) {
  const byType = new Map<string, string[]>();
  for (const entry of bundle.entry) {
    const rt = entry.resource?.resourceType ?? "?";
    const id = entry.resource?.id ?? "?";
    if (!byType.has(rt)) byType.set(rt, []);
    byType.get(rt)!.push(id);
  }
  const summary = [...byType.entries()]
    .map(([rt, ids]) => `${rt} x${ids.length}`)
    .join(", ");
  console.log(`Resources:  ${summary}`);
}

if (error) {
  console.log(`Error:      ${error}`);
}

const verdict = (() => {
  switch (status) {
    case "processed":
      return "supported — message converts cleanly";
    case "warning":
      return "supported with caveats — conversion succeeded but something was skipped (see Error line)";
    case "conversion_error":
      return "routed but data fails conversion — sender data issue or preprocessor/config gap (see Error line)";
    case "code_mapping_error":
      return "routed but contains unmapped codes — resolve via /mapping/tasks";
    case "parsing_error":
      return "malformed — sender must fix";
    default:
      return `unknown status: ${status}`;
  }
})();
console.log(`Verdict:    ${verdict}`);

if (status !== "processed" && status !== "warning") {
  process.exit(1);
}
