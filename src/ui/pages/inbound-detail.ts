/**
 * Inbound Messages — detail pane + 4 tabs.
 *
 * Sibling to `inbound.ts`. Exports the full-detail renderer used by
 * the page handler (when `?selected=<id>` is set) AND the tab partial
 * handlers wired to:
 *   GET /incoming-messages/:id/partials/detail          -> full card (shell + default `structured` tab)
 *   GET /incoming-messages/:id/partials/detail/:tab     -> just the tab body
 *
 * Tab inventory (user-facing labels locked to these strings; the
 * URL-level `tab` param uses the same short lowercase names):
 *   structured  | Structured
 *   raw         | Raw HL7
 *   fhir        | FHIR resources
 *   timeline    | Timeline           <-- not "ACK history"; shows status-transition
 *                                         history from Aidbox `_history`, NOT MSA ACKs
 *
 * The Timeline tab is the only one that fires an extra FHIR call (to
 * `_history`) — that's intentional per `DESIGN_OVERVIEW.md § Inbound`:
 * the other three tabs render entirely from fields on the resource
 * we already fetched.
 */

import { aidboxFetch, putResource, type Bundle } from "../../aidbox";
import type {
  IncomingHL7v2Message,
} from "../../fhir/aidbox-hl7v2-custom";
import { escapeHtml } from "../../utils/html";
import { highlightHL7WithDataTooltip } from "../hl7-display";
import {
  displayMessageType,
  statusToTone,
  statusStringToTone,
  type MessageTone,
} from "./inbound";
import {
  parseIncomingMessage,
  assertNever,
  isMalformed,
  type ParsedIncomingMessage,
} from "../domain/incoming-message";

// ============================================================================
// Types + constants
// ============================================================================

type DetailTab = "structured" | "raw" | "fhir" | "timeline";

const TABS: { key: DetailTab; label: string }[] = [
  { key: "structured", label: "Structured" },
  { key: "raw", label: "Raw HL7" },
  { key: "fhir", label: "FHIR resources" },
  { key: "timeline", label: "Timeline" },
];

const HISTORY_COUNT = 50;

export function isDetailTab(s: unknown): s is DetailTab {
  return s === "structured" || s === "raw" || s === "fhir" || s === "timeline";
}

// ============================================================================
// Shared rendering helpers (status chip, formatting)
// ============================================================================

function toneChip(tone: MessageTone): string {
  if (tone === "ok") {return `<span class="chip chip-ok">processed</span>`;}
  if (tone === "warn") {return `<span class="chip chip-warn">needs mapping</span>`;}
  if (tone === "err") {return `<span class="chip chip-err">error</span>`;}
  return `<span class="chip">pending</span>`;
}

function formatClock(iso: string | undefined): string {
  if (!iso) {return "--:--:--";}
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {return "--:--:--";}
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ============================================================================
// Detail header (status chip, type chip, MCID, Replay, Map code)
// ============================================================================

function detailSubtitle(p: ParsedIncomingMessage): string {
  switch (p.kind) {
    case "code_mapping_error": {
      // p.unmappedCodes is non-empty by the parser's invariant.
      const first = p.unmappedCodes[0];
      if (!first) {return "";}
      const chipCls = "font-mono text-accent-ink font-semibold bg-accent-soft px-1.5 py-0.5 rounded";
      return `Code <span class="${chipCls}">${escapeHtml(first.localCode)}</span> has no mapping — routed to triage.`;
    }
    case "warning":
      return `<span class="text-warn">${escapeHtml(truncate(p.error, 200))}</span>`;
    case "parsing_error":
    case "conversion_error":
    case "sending_error":
      return `<span class="text-err">${escapeHtml(truncate(p.error, 200))}</span>`;
    case "deferred":
      return p.note
        ? `<span class="text-ink-3">${escapeHtml(truncate(p.note, 200))}</span>`
        : "";
    case "received":
    case "processed":
      // No subtitle on the processed happy-path or received in-flight —
      // the sender→receiver h2 above carries the only info we'd put here.
      return "";
    default:
      return assertNever(p);
  }
}

/**
 * True when no further status transition is expected — settled rows
 * don't need the self-polling wrapper on the header.
 */
function isHeaderTerminal(p: ParsedIncomingMessage): boolean {
  switch (p.kind) {
    case "received":
      return false;
    case "processed":
    case "warning":
    case "deferred":
    case "parsing_error":
    case "conversion_error":
    case "sending_error":
    case "code_mapping_error":
      return true;
    default:
      return assertNever(p);
  }
}

function renderDetailHeader(p: ParsedIncomingMessage): string {
  const tone = statusToTone(p);
  const mcid = p.messageControlId ?? p.id;
  const time = formatClock(p.lastUpdated || p.date);
  // The "Map code" button is now structurally gated: it only exists when
  // the variant is `code_mapping_error`, so `unmappedCode` is guaranteed
  // non-null with a `.localCode` string. No more tone-triangulation.
  const firstUnmapped = p.kind === "code_mapping_error" ? p.unmappedCodes[0] : undefined;
  const mapCodeHref = firstUnmapped
    ? `/unmapped-codes?code=${encodeURIComponent(firstUnmapped.localCode)}` +
      `&sender=${encodeURIComponent(p.sendingApplication)}`
    : "";
  const senderToReceiver = [p.sendingApplication, p.sendingFacility]
    .filter(Boolean)
    .join(" → ");
  // Non-terminal detail headers self-poll: after the user clicks
  // "Replay" the status flips to `received` and sits there until the
  // worker re-processes (~5s). Without this poll the header shows
  // "processing" forever and the user has to reload.
  //
  // Uses Alpine setInterval + htmx.ajax() rather than hx-trigger="every 5s"
  // because htmx's interval is tied to the element reference, and
  // `hx-swap="outerHTML"` replaces the element each tick — the new
  // reference doesn't inherit the old interval and polling stops after
  // one fire. Alpine's `x-data` is re-initialized on each swap, so the
  // interval self-restarts. `$el.isConnected` cleans up dead intervals.
  const headerUrl = `/incoming-messages/${encodeURIComponent(p.id)}/partials/header`;
  const pollAttrs = isHeaderTerminal(p)
    ? ""
    : ` x-data
        x-init="(() => {
          var self = $el;
          var pid = setInterval(function() {
            if (!self || !self.isConnected) { clearInterval(pid); return; }
            window.htmx.ajax('GET', '${headerUrl}', { target: self, swap: 'outerHTML' });
          }, 5000);
        })()"`;
  return `
    <div id="detail-header-${escapeHtml(p.id)}" class="px-5 py-4 border-b border-line"${pollAttrs}>
      <div class="flex items-center gap-2 mb-2.5 flex-wrap">
        ${toneChip(tone)}
        <span class="chip">${escapeHtml(displayMessageType(p.type))}</span>
        <span class="font-mono text-[11.5px] text-ink-3">${escapeHtml(mcid)} · ${escapeHtml(time)}</span>
        <div class="ml-auto flex gap-1.5">
          <!-- Replay button: while the htmx POST is in flight the Alpine
               "loading" flag swaps the label to "Replaying…" + a spinner
               and disables the button so the user doesn't click it again
               and has visible feedback that something IS happening. -->
          <button type="button"
                  class="btn py-1 px-2.5 text-[11.5px] inline-flex items-center gap-1.5"
                  x-data="{ loading: false }"
                  x-on:htmx:before-request="loading = true"
                  x-on:htmx:after-request="loading = false"
                  x-bind:disabled="loading"
                  x-bind:class="loading ? 'opacity-60 cursor-wait' : ''"
                  hx-post="/mark-for-retry/${encodeURIComponent(p.id)}"
                  hx-target="#detail"
                  hx-swap="outerHTML">
            <span class="spinner" x-show="loading"></span>
            <span x-text="loading ? 'Replaying…' : 'Replay'"></span>
          </button>
          ${
            p.kind === "code_mapping_error"
              ? `<a class="btn btn-primary py-1 px-3 text-[11.5px]" href="${escapeHtml(mapCodeHref)}">Map code</a>`
              : ""
          }
        </div>
      </div>
      ${senderToReceiver ? `<div class="h2">${escapeHtml(senderToReceiver)}</div>` : ""}
      ${(() => {
        const sub = detailSubtitle(p);
        return sub ? `<div class="text-[13px] text-ink-2 mt-1 leading-[1.5]">${sub}</div>` : "";
      })()}
    </div>
  `;
}

// ============================================================================
// Tab bar
// ============================================================================

function renderDetailTabBar(currentTab: DetailTab, messageId: string): string {
  const id = encodeURIComponent(messageId);
  return `
    <div class="flex border-b border-line px-5">
      ${TABS.map((t) => {
        // Alpine-driven active-state styling. `activeTab` lives on the
        // parent `#detail` scope (seeded from the server-rendered tab).
        // Clicking a tab updates `activeTab` *and* fires the htmx GET that
        // swaps the tab body — so the underline moves immediately, not only
        // after the response comes back.
        const keyExpr = escapeHtml(JSON.stringify(t.key));
        return `
          <button type='button'
                  class='py-2.5 px-3.5 text-[12.5px] bg-transparent cursor-pointer -mb-px border-b-2'
                  :class='activeTab === ${keyExpr} ? "border-accent text-ink font-medium" : "border-transparent text-ink-3 hover:text-ink-2"'
                  x-on:click='activeTab = ${keyExpr}'
                  hx-get='/incoming-messages/${id}/partials/detail/${t.key}'
                  hx-target='#detail-body'
                  hx-swap='innerHTML'>${escapeHtml(t.label)}</button>
        `;
      }).join("")}
    </div>
  `;
  // currentTab remains the source of truth for the INITIAL paint; Alpine
  // state drives subsequent switches.
  void currentTab;
}

// ============================================================================
// Tab: Structured — split stored `message` into segments
// ============================================================================

export function renderStructuredTab(p: ParsedIncomingMessage): string {
  const raw = p.rawMessage;
  if (!raw.trim()) {
    return `<div class="p-8 text-center text-ink-3 text-[13px]">No HL7v2 message stored.</div>`;
  }
  const segments = raw.split(/[\r\n]+/).filter((s) => s.trim());
  // Only `code_mapping_error` variants carry an unmapped code to warn-
  // highlight against; every other variant has `problemCode = undefined`
  // by construction, so no runtime ?. chains required.
  const problemCode =
    p.kind === "code_mapping_error" ? p.unmappedCodes[0]?.localCode : undefined;

  return `
    <div class="p-5 flex flex-col gap-2">
      ${segments
        .map((seg) => {
          const [name, ...rest] = seg.split("|");
          const fields = rest.slice(0, 8);
          const hasProblem = problemCode ? seg.includes(problemCode) : false;
          const border = hasProblem
            ? "border-warn bg-warn-soft"
            : "border-line";
          const fieldsText = fields
            .map((f, i) => {
              const n = i + 1;
              const display = f.length > 40 ? f.slice(0, 39) + "…" : f;
              return `<span class="font-mono text-[11.5px] text-ink-2" title="${escapeHtml(name ?? "")}-${n}: ${escapeHtml(f)}">${escapeHtml(display || "—")}</span>`;
            })
            .join('<span class="text-ink-3">·</span>');
          return `
            <div class="border ${border} rounded px-3 py-2 flex items-center gap-3 flex-wrap">
              <span class="chip font-semibold">${escapeHtml(name ?? "—")}</span>
              <div class="flex items-center gap-2 flex-wrap min-w-0">${fieldsText}</div>
              ${hasProblem && problemCode ? `<span class="chip chip-warn ml-auto text-[10.5px]">contains ${escapeHtml(problemCode)}</span>` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

// ============================================================================
// Tab: Raw HL7 — reuse existing highlighter
// ============================================================================

export function renderRawTab(p: ParsedIncomingMessage): string {
  const raw = p.rawMessage;
  if (!raw.trim()) {
    return `<div class="p-8 text-center text-ink-3 text-[13px]">No HL7v2 message stored.</div>`;
  }
  return `
    <div class="p-5">
      <div class="hl7-message-container p-3 bg-paper-2 border border-line rounded font-mono text-[12px] overflow-x-auto whitespace-pre">${highlightHL7WithDataTooltip(raw)}</div>
    </div>
  `;
}

// ============================================================================
// Tab: FHIR resources — pretty-print entries array
// ============================================================================

/**
 * Small server-side JSON syntax highlighter for the FHIR resources tab.
 * Operates on already-escaped HTML text (so `"` is `&quot;`) and wraps
 * tokens in classed spans the design system's warm-paper palette styles.
 * A real JSON AST walker would be overkill at demo scale — regex on the
 * escaped text gets us key/string/number/boolean coloring reliably.
 */
function highlightJson(pretty: string): string {
  let html = escapeHtml(pretty);
  // Single-pass match of every quoted token + the optional `:` that
  // follows. If a colon is present → key; otherwise → string value.
  // Palette borrowed from the Aidbox console: dark-red keys, teal-green
  // string values, blue-underlined URL strings, blue numbers. One pass
  // avoids double-wrapping a key when we later look for values.
  html = html.replace(
    /(&quot;((?:\\.|[^\\&]|&(?!quot;))*?)&quot;)(\s*)(:?)/g,
    (_, quoted, inner, whitespace, colon) => {
      if (colon) {
        return `<span class="text-accent-ink">${quoted}</span>${whitespace}${colon}`;
      }
      // Value-slot string: URLs get a blue-underline Aidbox treatment,
      // everything else stays in the teal/green "string" family.
      if (/^https?:\/\//i.test(inner)) {
        return `<span class="text-info underline decoration-info/40 underline-offset-2">${quoted}</span>`;
      }
      return `<span class="text-ok">${quoted}</span>`;
    },
  );
  // Numbers — blue in Aidbox. Only match at the start of a JSON value
  // slot (after `: `, `, `, `[ `, or a line start). Avoids matching digits
  // that happen to appear inside already-wrapped string spans.
  html = html.replace(
    /(:\s*|,\s*|\[\s*|^\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=[,\s\]}])/gm,
    '$1<span class="text-info">$2</span>',
  );
  // Literals: true / false / null — Aidbox renders these in a purple-ish
  // dark tone. Using info-ink (deep blue) gets us close without adding a
  // fifth palette slot. `\b` keeps us from matching inside attribute
  // values like `class="text-ink-2"`.
  html = html.replace(
    /\b(true|false|null)\b(?!-)/g,
    '<span class="text-info-ink font-medium">$1</span>',
  );
  return html;
}

export function renderFhirTab(p: ParsedIncomingMessage): string {
  // Structural invariant: only `processed` / `warning` variants carry
  // `entries`. Every other variant gets an empty-state card with a
  // variant-appropriate reason — no more "status?.endsWith" fallbacks.
  if (p.kind !== "processed" && p.kind !== "warning") {
    const reason = emptyEntriesReason(p);
    return `
      <div class="p-8 text-center text-ink-3 text-[13px]">
        No FHIR resources attached. ${reason}
      </div>
    `;
  }
  if (p.entries.length === 0) {
    return `
      <div class="p-8 text-center text-ink-3 text-[13px]">
        No FHIR resources attached. Processor produced no output.
      </div>
    `;
  }
  const pretty = JSON.stringify(p.entries, null, 2);
  // Only code_mapping_error has unmappedCodes; processed/warning don't,
  // so no annotation happens for those variants. Guarded explicitly so
  // the helper's interface stays narrow and honest.
  const body = highlightJson(pretty);
  const lineCount = pretty.split("\n").length;
  return `
    <div class="p-5">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">
          ${p.entries.length} resource${p.entries.length !== 1 ? "s" : ""} · ${lineCount} line${lineCount !== 1 ? "s" : ""}
        </span>
      </div>
      <!-- Height-constrained viewer: the JSON can run to thousands of
           lines for big bundles, so scroll internally instead of blowing
           out the page. max-h chosen to fit the typical bundle without
           dwarfing the tab-bar and status chips above. -->
      <pre class="p-3 bg-paper-2 border border-line rounded font-mono text-[12px] leading-[1.55] overflow-auto max-h-[520px] whitespace-pre">${body}</pre>
    </div>
  `;
}

/** Variant-specific empty-state reason for the FHIR tab. */
function emptyEntriesReason(
  p: Exclude<ParsedIncomingMessage, { kind: "processed" | "warning" }>,
): string {
  switch (p.kind) {
    case "parsing_error":
    case "conversion_error":
    case "sending_error":
      return "The message failed before conversion.";
    case "code_mapping_error":
      return "Processing held in triage until the unmapped code resolves.";
    case "received":
      return "Processor hasn't run yet.";
    case "deferred":
      return "Message was manually deferred.";
    default:
      return assertNever(p);
  }
}

// ============================================================================
// Tab: Timeline — Aidbox `_history` rendering
// ============================================================================

interface HistoryVersion {
  versionId?: string;
  lastUpdated?: string;
  status?: string;
  error?: string;
}

type HistoryEntryShape = {
  resource?: IncomingHL7v2Message & {
    meta?: { versionId?: string; lastUpdated?: string };
  };
};

function extractVersions(entries: HistoryEntryShape[]): HistoryVersion[] {
  return entries
    .map((e) => ({
      versionId: e.resource?.meta?.versionId,
      lastUpdated: e.resource?.meta?.lastUpdated,
      status: e.resource?.status,
      error: e.resource?.error,
    }))
    .filter((v) => v.lastUpdated);
}

/**
 * Drop consecutive versions where BOTH status and error are unchanged.
 * Aidbox records a new version on every PUT; the processor PUTs even
 * when only `entries` changes (appending parsed resources), which
 * would otherwise clutter the timeline with near-duplicate rows that
 * tell the user nothing about processing progression.
 */
export function collapseHistoryVersions(
  versions: HistoryVersion[],
): HistoryVersion[] {
  // Aidbox returns history newest-first; iterate chronologically so
  // "unchanged since previous" reads correctly.
  const chrono = [...versions].sort((a, b) =>
    (a.lastUpdated ?? "").localeCompare(b.lastUpdated ?? ""),
  );
  const kept: HistoryVersion[] = [];
  let prevStatus: string | undefined;
  let prevError: string | undefined;
  for (const v of chrono) {
    if (kept.length > 0 && v.status === prevStatus && v.error === prevError) {
      continue;
    }
    kept.push(v);
    prevStatus = v.status;
    prevError = v.error;
  }
  // Return newest-first for rendering — design reads top-down newest-to-oldest.
  return kept.reverse();
}

function stepLabel(
  status: string | undefined,
  prevStatus: string | undefined,
): string {
  if (!status) {return "—";}
  if (!prevStatus && status === "received") {return "Received by MLLP";}
  if (status === "processed") {return "Converted + submitted to Aidbox";}
  if (status === "warning") {return "Processed with warning";}
  if (status === "code_mapping_error") {return "Routed to unmapped-codes triage";}
  if (status === "parsing_error") {return "Parse failed";}
  if (status === "conversion_error") {return "Conversion failed";}
  if (status === "sending_error") {return "Submit to Aidbox failed";}
  if (status === "deferred") {return "Manually deferred";}
  if (status === "received") {return "Reset to received (retry)";}
  return status;
}

export function renderTimelineTab(versions: HistoryVersion[]): string {
  if (versions.length === 0) {
    return `<div class="p-8 text-center text-ink-3 text-[13px]">No history entries.</div>`;
  }
  // Versions come newest-first; render in that order. Each row has a
  // dot, a clock, a step label, a status chip, and optional error.
  const chronoForPrev = [...versions].reverse();
  const prevStatusByIdx = new Map<number, string | undefined>();
  for (let i = 0; i < chronoForPrev.length; i++) {
    prevStatusByIdx.set(i, i > 0 ? chronoForPrev[i - 1]?.status : undefined);
  }
  return `
    <div class="p-5 flex flex-col gap-0">
      ${versions
        .map((v, i) => {
          const chronoIdx = versions.length - 1 - i;
          const prev = prevStatusByIdx.get(chronoIdx);
          const tone = statusStringToTone(v.status);
          const isLatest = i === 0;
          const border = isLatest ? "" : "border-t border-line";
          return `
            <div class="${border} py-2.5 grid gap-3 items-center grid-cols-[10px_130px_1fr_150px]">
              <span class="dot ${tone === "ok" ? "ok" : tone === "warn" ? "warn" : tone === "err" ? "err" : ""}"></span>
              <span class="font-mono text-ink-3 text-[11.5px]">v${escapeHtml(v.versionId ?? "?")} · ${escapeHtml(formatClock(v.lastUpdated))}</span>
              <span class="text-[13px] text-ink-2">
                ${escapeHtml(stepLabel(v.status, prev))}
                ${v.error ? `<span class="block mt-1 text-err text-[12px] font-mono">${escapeHtml(truncate(v.error, 140))}</span>` : ""}
              </span>
              <span class="justify-self-end">${toneChip(tone)}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

export async function getHistoryVersions(
  id: string,
): Promise<HistoryVersion[]> {
  try {
    const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message/${encodeURIComponent(id)}/_history?_count=${HISTORY_COUNT}`,
    );
    const raw = (bundle.entry ?? []) as HistoryEntryShape[];
    return collapseHistoryVersions(extractVersions(raw));
  } catch (error) {
    console.error(
      `[inbound-detail] _history fetch failed for ${id}:`,
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

// ============================================================================
// Detail card composition
// ============================================================================

async function renderTabBody(
  tab: DetailTab,
  p: ParsedIncomingMessage,
): Promise<string> {
  switch (tab) {
    case "structured":
      return renderStructuredTab(p);
    case "raw":
      return renderRawTab(p);
    case "fhir":
      return renderFhirTab(p);
    case "timeline": {
      const versions = await getHistoryVersions(p.id);
      return renderTimelineTab(versions);
    }
  }
}

export async function renderDetailCard(
  p: ParsedIncomingMessage,
  tab: DetailTab = "structured",
): Promise<string> {
  const tabBody = await renderTabBody(tab, p);
  // Alpine scope for the detail card — `activeTab` drives the tab-bar
  // underline client-side so switching tabs doesn't wait for the htmx body
  // swap to visibly change the active tab. Escaped so `"` inside the JSON
  // doesn't terminate the outer double-quoted attribute early.
  const initialTab = escapeHtml(JSON.stringify(tab));
  return `
    <div id="detail" data-selected="${escapeHtml(p.id)}" class="card flex flex-col self-start overflow-hidden"
         x-data="{ activeTab: ${initialTab} }">
      ${renderDetailHeader(p)}
      ${renderDetailTabBar(tab, p.id)}
      <div id="detail-body">${tabBody}</div>
    </div>
  `;
}

// ============================================================================
// HTTP handlers
// ============================================================================

async function loadMessage(id: string): Promise<ParsedIncomingMessage | null> {
  try {
    const raw = await aidboxFetch<IncomingHL7v2Message>(
      `/fhir/IncomingHL7v2Message/${encodeURIComponent(id)}`,
    );
    const parsed = parseIncomingMessage(raw);
    if (isMalformed(parsed)) {
      console.warn(
        `[inbound-detail] loadMessage(${id}) malformed: ${parsed.reason}`,
      );
      return null;
    }
    return parsed;
  } catch (error) {
    console.error(
      `[inbound-detail] GET ${id} failed:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function notFoundDetail(): Response {
  const html = `
    <div id="detail" class="card flex flex-col self-start overflow-hidden min-h-[360px]">
      <div class="card-head">
        <span class="card-title">Message not found</span>
      </div>
      <div class="flex-1 grid place-items-center text-ink-3 text-[13px] py-16 px-8 text-center">
        The message may have been deleted, or the link is stale.
      </div>
    </div>
  `;
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html" },
  });
}

export async function handleInboundDetailPartial(
  req: Request,
): Promise<Response> {
  const id = (req as Request & { params?: Record<string, string> }).params?.id;
  if (!id) {return notFoundDetail();}
  const m = await loadMessage(decodeURIComponent(id));
  if (!m) {return notFoundDetail();}
  const html = await renderDetailCard(m, "structured");
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * Per-detail-pane header refresh — swaps just the header block in
 * place every 5s while the message is in a non-terminal state. Once
 * the message settles, the returned header has no hx-trigger and the
 * poll stops. Keeps the tab body untouched so the user's chosen tab
 * (Raw, FHIR, Timeline) doesn't reset.
 */
export async function handleInboundDetailHeaderPartial(
  req: Request,
): Promise<Response> {
  const id = (req as Request & { params?: Record<string, string> }).params?.id;
  if (!id) {
    return new Response("missing id", { status: 400 });
  }
  const m = await loadMessage(decodeURIComponent(id));
  if (!m) {
    // Stop polling and surface a small notice rather than break the layout.
    return new Response(
      `<div id="detail-header-${escapeHtml(decodeURIComponent(id))}" class="px-5 py-4 border-b border-line text-[12px] text-ink-3">Message no longer available.</div>`,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }
  return new Response(renderDetailHeader(m), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

export async function handleInboundDetailTabPartial(
  req: Request,
): Promise<Response> {
  const params = (req as Request & { params?: Record<string, string> }).params;
  const id = params?.id;
  const tab = params?.tab;
  if (!id || !isDetailTab(tab)) {
    return new Response("Invalid tab", { status: 400 });
  }
  const m = await loadMessage(decodeURIComponent(id));
  if (!m) {
    return new Response(
      `<div class="p-8 text-center text-ink-3 text-[13px]">Message not found.</div>`,
      { status: 404, headers: { "Content-Type": "text/html" } },
    );
  }
  const body = await renderTabBody(tab, m);
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

/**
 * POST /mark-for-retry/:id
 *
 * Resets the message to `received` and re-queues it for processing.
 * htmx-aware: when the request carries `HX-Request: true`, responds
 * with the refreshed detail-pane HTML and emits `HX-Trigger: message-replayed`
 * so the list pane can refresh itself immediately. Non-htmx callers
 * (legacy form posts, cURL) keep the 302 redirect to /incoming-messages.
 */
export async function handleMarkForRetry(req: Request): Promise<Response> {
  const id = (req as Request & { params?: Record<string, string> }).params?.id;
  if (!id) {
    return new Response(null, { status: 400 });
  }

  const message = await aidboxFetch<IncomingHL7v2Message>(
    `/fhir/IncomingHL7v2Message/${id}`,
  );
  const updatedWire: IncomingHL7v2Message = {
    ...message,
    status: "received",
    error: undefined,
    entries: undefined,
  };
  await putResource("IncomingHL7v2Message", id, updatedWire);

  if (req.headers.get("HX-Request") === "true") {
    // Re-parse the post-reset wire record so the rerendered detail pane
    // consumes the same narrow type as all other render paths.
    const parsed = parseIncomingMessage(updatedWire);
    if (isMalformed(parsed)) {
      // Extremely unlikely — we just constructed a known-good shape —
      // but fail loud if the parser ever rejects a shape we build
      // internally.
      return new Response(
        `<div class="p-8 text-center text-err text-[13px]">Replay succeeded but the refreshed record is malformed: ${escapeHtml(parsed.reason)}</div>`,
        { status: 500, headers: { "Content-Type": "text/html" } },
      );
    }
    const detailHtml = await renderDetailCard(parsed, "structured");
    return new Response(detailHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "HX-Trigger": "message-replayed",
      },
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: "/incoming-messages" },
  });
}
