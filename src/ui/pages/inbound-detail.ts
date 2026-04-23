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
  UnmappedCode,
} from "../../fhir/aidbox-hl7v2-custom";
import { escapeHtml } from "../../utils/html";
import { highlightHL7WithDataTooltip } from "../hl7-display";
import { displayMessageType, statusToTone, type MessageTone } from "./inbound";

// ============================================================================
// Types + constants
// ============================================================================

export type DetailTab = "structured" | "raw" | "fhir" | "timeline";

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
  if (tone === "ok") return `<span class="chip chip-ok">processed</span>`;
  if (tone === "warn") return `<span class="chip chip-warn">needs mapping</span>`;
  if (tone === "err") return `<span class="chip chip-err">error</span>`;
  return `<span class="chip">pending</span>`;
}

function formatClock(iso: string | undefined): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ============================================================================
// Detail header (status chip, type chip, MCID, Replay, Map code)
// ============================================================================

function detailSubtitle(m: IncomingHL7v2Message): string {
  if (m.status === "code_mapping_error") {
    const code = m.unmappedCodes?.[0]?.localCode;
    if (code) {
      return `Code <span class="font-mono text-accent-ink font-semibold bg-accent-soft px-1.5 py-0.5 rounded">${escapeHtml(code)}</span> has no mapping — routed to triage.`;
    }
    return "Contains an unmapped code — routed to triage.";
  }
  if (m.status === "warning" && m.error) {
    return `<span class="text-warn">${escapeHtml(truncate(m.error, 200))}</span>`;
  }
  if (m.status?.endsWith("_error") && m.error) {
    return `<span class="text-err">${escapeHtml(truncate(m.error, 200))}</span>`;
  }
  if (m.status === "processed") {
    return `${escapeHtml(m.sendingApplication ?? "—")} → ${escapeHtml(
      m.sendingFacility ?? "—",
    )}`;
  }
  return "";
}

function renderDetailHeader(m: IncomingHL7v2Message): string {
  const tone = statusToTone(m.status);
  const mcid = m.messageControlId ?? m.id ?? "—";
  const time = formatClock(m.meta?.lastUpdated ?? m.date);
  const unmapped: UnmappedCode | undefined = m.unmappedCodes?.[0];
  const canMapCode = tone === "warn" && unmapped?.localCode;
  // `sender` must match the Unmapped queue's grouping key, which is
  // `task.input["Sending application"]` — i.e. the HL7v2 sending app
  // (MSH-3), NOT the local code system. Earlier this passed localSystem
  // ("LOCAL") and the queue pre-selection silently failed to match.
  const mapCodeHref = canMapCode
    ? `/unmapped-codes?code=${encodeURIComponent(unmapped.localCode)}${
        m.sendingApplication
          ? `&sender=${encodeURIComponent(m.sendingApplication)}`
          : ""
      }`
    : "";
  const senderToReceiver = [m.sendingApplication, m.sendingFacility]
    .filter(Boolean)
    .join(" → ");
  return `
    <div class="px-5 py-4 border-b border-line">
      <div class="flex items-center gap-2 mb-2.5 flex-wrap">
        ${toneChip(tone)}
        <span class="chip">${escapeHtml(m.type ? displayMessageType(m.type) : "—")}</span>
        <span class="font-mono text-[11.5px] text-ink-3">${escapeHtml(mcid)} · ${escapeHtml(time)}</span>
        <div class="ml-auto flex gap-1.5">
          <!-- Replay button: while the htmx POST is in flight the Alpine
               "loading" flag swaps the label to "Replaying…" + a spinner
               and disables the button so the user doesn't click it again
               and has visible feedback that something IS happening. -->
          <button type="button"
                  class="btn btn-ghost py-1 px-2.5 text-[11.5px] inline-flex items-center gap-1.5"
                  x-data="{ loading: false }"
                  x-on:htmx:before-request="loading = true"
                  x-on:htmx:after-request="loading = false"
                  x-bind:disabled="loading"
                  x-bind:class="loading ? 'opacity-60 cursor-wait' : ''"
                  hx-post="/mark-for-retry/${encodeURIComponent(m.id ?? "")}"
                  hx-target="#detail"
                  hx-swap="outerHTML">
            <span class="spinner" x-show="loading"></span>
            <span x-text="loading ? 'Replaying…' : 'Replay'"></span>
          </button>
          ${
            canMapCode
              ? `<a class="btn btn-primary py-1 px-3 text-[11.5px]" href="${escapeHtml(mapCodeHref)}">Map code</a>`
              : ""
          }
        </div>
      </div>
      ${senderToReceiver ? `<div class="h2">${escapeHtml(senderToReceiver)}</div>` : ""}
      <div class="text-[13px] text-ink-2 mt-1 leading-[1.5]">${detailSubtitle(m)}</div>
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

export function renderStructuredTab(m: IncomingHL7v2Message): string {
  const raw = m.message ?? "";
  if (!raw.trim()) {
    return `<div class="p-8 text-center text-ink-3 text-[13px]">No HL7v2 message stored.</div>`;
  }
  const segments = raw.split(/[\r\n]+/).filter((s) => s.trim());
  const problemCode = m.unmappedCodes?.[0]?.localCode;

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
              ${hasProblem ? `<span class="chip chip-warn ml-auto text-[10.5px]">contains ${escapeHtml(problemCode!)}</span>` : ""}
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

export function renderRawTab(m: IncomingHL7v2Message): string {
  const raw = m.message ?? "";
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
  // follows. If a colon is present → key (accent-ink); otherwise → string
  // value (green ink — use `text-ok`, NOT `text-ok-soft` which is a pale
  // green *background* color that disappears on the warm-paper pane).
  // One pass avoids double-wrapping a key when we later look for values.
  html = html.replace(
    /(&quot;(?:\\.|[^\\&]|&(?!quot;))*?&quot;)(\s*)(:?)/g,
    (_, quoted, whitespace, colon) => {
      const cls = colon ? "text-accent-ink" : "text-ok";
      return `<span class="${cls}">${quoted}</span>${whitespace}${colon}`;
    },
  );
  // Numbers — only at the start of a JSON value slot (after `: `, `, `,
  // `[ `, or a line start). Avoids matching digits that happen to appear
  // inside already-wrapped string spans.
  html = html.replace(
    /(:\s*|,\s*|\[\s*|^\s*)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(?=[,\s\]}])/gm,
    '$1<span class="text-warn">$2</span>',
  );
  // Literals: true / false / null. `\b` keeps us from matching inside
  // attribute values like `class="text-ink-2"`.
  html = html.replace(
    /\b(true|false|null)\b(?!-)/g,
    '<span class="text-ink-2 font-medium">$1</span>',
  );
  return html;
}

function annotateUnmappedCodings(
  highlighted: string,
  unmappedCodes: UnmappedCode[] | undefined,
): string {
  if (!unmappedCodes?.length) return highlighted;
  // Applied AFTER syntax highlighting so the unmapped-code red text
  // visually dominates the line. Look for the code value inside its
  // already-wrapped `<span class="text-ok-soft">&quot;CODE&quot;</span>`.
  let out = highlighted;
  for (const u of unmappedCodes) {
    if (!u.localCode) continue;
    const needle = escapeHtml(u.localCode).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(<span class="text-accent-ink">&quot;code&quot;</span>:\\s*<span class="text-ok">&quot;${needle}&quot;</span>)`,
      "g",
    );
    out = out.replace(
      re,
      `$1 <span class="text-warn">// ⚠ no LOINC mapping</span>`,
    );
  }
  return out;
}

export function renderFhirTab(m: IncomingHL7v2Message): string {
  if (!m.entries || !Array.isArray(m.entries) || m.entries.length === 0) {
    return `
      <div class="p-8 text-center text-ink-3 text-[13px]">
        No FHIR resources attached. ${m.status?.endsWith("_error") ? "The message failed before conversion." : "Processor hasn't run yet."}
      </div>
    `;
  }
  const pretty = JSON.stringify(m.entries, null, 2);
  const body = annotateUnmappedCodings(highlightJson(pretty), m.unmappedCodes);
  const lineCount = pretty.split("\n").length;
  return `
    <div class="p-5">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">
          ${m.entries.length} resource${m.entries.length !== 1 ? "s" : ""} · ${lineCount} line${lineCount !== 1 ? "s" : ""}
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

// ============================================================================
// Tab: Timeline — Aidbox `_history` rendering
// ============================================================================

export interface HistoryVersion {
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
  if (!status) return "—";
  if (!prevStatus && status === "received") return "Received by MLLP";
  if (status === "processed") return "Converted + submitted to Aidbox";
  if (status === "warning") return "Processed with warning";
  if (status === "code_mapping_error") return "Routed to unmapped-codes triage";
  if (status === "parsing_error") return "Parse failed";
  if (status === "conversion_error") return "Conversion failed";
  if (status === "sending_error") return "Submit to Aidbox failed";
  if (status === "deferred") return "Manually deferred";
  if (status === "received") return "Reset to received (retry)";
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
          const tone = statusToTone(
            v.status as IncomingHL7v2Message["status"],
          );
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

export async function renderTabBody(
  tab: DetailTab,
  m: IncomingHL7v2Message,
): Promise<string> {
  switch (tab) {
    case "structured":
      return renderStructuredTab(m);
    case "raw":
      return renderRawTab(m);
    case "fhir":
      return renderFhirTab(m);
    case "timeline": {
      const versions = await getHistoryVersions(m.id ?? "");
      return renderTimelineTab(versions);
    }
  }
}

export async function renderDetailCard(
  m: IncomingHL7v2Message,
  tab: DetailTab = "structured",
): Promise<string> {
  const tabBody = await renderTabBody(tab, m);
  // Alpine scope for the detail card — `activeTab` drives the tab-bar
  // underline client-side so switching tabs doesn't wait for the htmx body
  // swap to visibly change the active tab. Escaped so `"` inside the JSON
  // doesn't terminate the outer double-quoted attribute early.
  const initialTab = escapeHtml(JSON.stringify(tab));
  return `
    <div id="detail" data-selected="${escapeHtml(m.id ?? "")}" class="card flex flex-col self-start overflow-hidden"
         x-data="{ activeTab: ${initialTab} }">
      ${renderDetailHeader(m)}
      ${renderDetailTabBar(tab, m.id ?? "")}
      <div id="detail-body">${tabBody}</div>
    </div>
  `;
}

// ============================================================================
// HTTP handlers
// ============================================================================

async function loadMessage(id: string): Promise<IncomingHL7v2Message | null> {
  try {
    return await aidboxFetch<IncomingHL7v2Message>(
      `/fhir/IncomingHL7v2Message/${encodeURIComponent(id)}`,
    );
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
  if (!id) return notFoundDetail();
  const m = await loadMessage(decodeURIComponent(id));
  if (!m) return notFoundDetail();
  const html = await renderDetailCard(m, "structured");
  return new Response(html, {
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
  const updated: IncomingHL7v2Message = {
    ...message,
    status: "received",
    error: undefined,
    entries: undefined,
  };
  await putResource("IncomingHL7v2Message", id, updated);

  if (req.headers.get("HX-Request") === "true") {
    const detailHtml = await renderDetailCard(updated, "structured");
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
