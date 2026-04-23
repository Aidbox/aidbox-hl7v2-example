/**
 * Inbound Messages — list pane + type chips.
 *
 * Matches `InboundA` in `ai/tickets/ui-refactoring/hl7v2-v2/project/design/page-inbound.jsx`:
 * hero + type-chip row + two-pane (list card + detail card). The detail
 * pane's 4 tabs (Structured / Raw / FHIR / Timeline) land in Task 9;
 * this task ships a minimal detail scaffold that shows message header
 * metadata and a placeholder tab area.
 *
 * URL params drive server-side state:
 *   ?type=ORU^R01&status=processed&batch=tag&selected=<id>
 * Full page loads with `selected` pre-render the detail pane inline so
 * deep-links work without an htmx round-trip. Row clicks fire an htmx
 * GET to `/incoming-messages/:id/partials/detail` (registered in Task 9).
 */

import { aidboxFetch, type Bundle } from "../../aidbox";
import type {
  IncomingHL7v2Message,
} from "../../fhir/aidbox-hl7v2-custom";
import { renderShell } from "../shell";
import { htmlResponse, getNavData } from "../shared";
import { renderIcon } from "../icons";
import { escapeHtml } from "../../utils/html";
import { renderDetailCard } from "./inbound-detail";

// ============================================================================
// Types + constants
// ============================================================================

export interface InboundFilters {
  type?: string;
  status?: string;
  batch?: string;
  selected?: string;
}

export interface TypeChipCount {
  /** Display label — "ORU^R01", "ADT^A01", etc., or "All" / "errors". */
  label: string;
  /** Value for the `?type=` URL param. Empty string for All. */
  value: string;
  count: number;
  tone?: "accent" | "err";
}

export type MessageTone = "ok" | "warn" | "err" | "pend";

// The 4 hard-error statuses the design's "errors" pseudo-chip aggregates.
// Matches CLAUDE.md's IncomingHL7v2Message status vocabulary.
const ERROR_STATUSES = [
  "parsing_error",
  "conversion_error",
  "code_mapping_error",
  "sending_error",
] as const;

const TYPE_CHIP_SCAN_COUNT = 500;
const LIST_COUNT = 100;

// ============================================================================
// FHIR queries
// ============================================================================

function buildListQuery(filters: InboundFilters): string {
  const params: string[] = [
    `_sort=-_lastUpdated`,
    `_count=${LIST_COUNT}`,
  ];
  if (filters.type) {
    // `type` values like "ORU^R01" contain `^` which must be URL-encoded.
    params.push(`type=${encodeURIComponent(filters.type)}`);
  }
  if (filters.status === "errors") {
    params.push(`status=${ERROR_STATUSES.join(",")}`);
  } else if (filters.status) {
    params.push(`status=${encodeURIComponent(filters.status)}`);
  }
  if (filters.batch) {
    params.push(`batch-tag=${encodeURIComponent(filters.batch)}`);
  }
  return `/fhir/IncomingHL7v2Message?${params.join("&")}`;
}

export async function getInboundList(
  filters: InboundFilters,
): Promise<IncomingHL7v2Message[]> {
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    buildListQuery(filters),
  );
  return bundle.entry?.map((e) => e.resource) ?? [];
}

export async function getTypeChipCounts(): Promise<TypeChipCount[]> {
  // Scan recent N messages and group in-memory. Design allows this up to
  // demo scale (~1k msg/day); if totals grow, swap for per-type SearchParam
  // queries (tracked in the v1 non-goals).
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    `/fhir/IncomingHL7v2Message?_count=${TYPE_CHIP_SCAN_COUNT}&_elements=type,status&_sort=-_lastUpdated`,
  );
  const entries = bundle.entry ?? [];
  const total = entries.length;

  const typeBuckets = new Map<string, number>();
  let errorCount = 0;
  for (const e of entries) {
    const r = e.resource;
    if (!r) continue;
    const t = r.type ?? "—";
    typeBuckets.set(t, (typeBuckets.get(t) ?? 0) + 1);
    if (r.status && (ERROR_STATUSES as readonly string[]).includes(r.status)) {
      errorCount += 1;
    }
  }

  const chips: TypeChipCount[] = [
    { label: "All", value: "", count: total, tone: "accent" },
  ];
  for (const [type, count] of [...typeBuckets.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    // Label is the canonical HL7v2 form (`ADT^A01`); value stays the
    // Aidbox-stored form (`ADT_A01`) so the chip's `?type=...` URL
    // matches what Aidbox actually indexes on.
    chips.push({ label: displayMessageType(type), value: type, count });
  }
  // `errors` is a status-based pseudo-chip. It sets `?status=errors`
  // (not a real status value — the list handler expands it to the 4
  // hard-error statuses in buildListQuery).
  chips.push({ label: "errors", value: "", count: errorCount, tone: "err" });
  return chips;
}

export async function getMessageById(
  id: string,
): Promise<IncomingHL7v2Message | null> {
  try {
    return await aidboxFetch<IncomingHL7v2Message>(
      `/fhir/IncomingHL7v2Message/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    // Can't distinguish 404 from 500 without reading the response
    // status; aidboxFetch throws a plain Error either way. Log-and-
    // return-null so the detail pane falls back to empty-state rather
    // than blanking the whole page on an Aidbox blip.
    console.error(
      `[inbound] getMessageById(${id}) failed:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

// ============================================================================
// Rendering
// ============================================================================

/**
 * The MLLP listener stores MSH-9 with the first caret replaced by an
 * underscore (see `src/mllp/mllp-server.ts:43` — so `ADT^A01^ADT_A01`
 * lands in Aidbox as `ADT_A01^ADT_A01`). That's a storage quirk, not
 * the HL7v2 canonical form. Reverse at DISPLAY time only: the URL
 * params + Aidbox queries keep using the stored form so search hits.
 * Only the leading `<letters>_` prefix is rewritten — the rest of the
 * string (e.g. a 3rd-component message-structure id like `ADT_A01`)
 * legitimately contains underscores and must stay intact.
 */
export function displayMessageType(stored: string): string {
  return stored.replace(/^([A-Z][A-Z0-9]*)_/, "$1^");
}

export function statusToTone(
  status: IncomingHL7v2Message["status"],
): MessageTone {
  if (!status) return "pend";
  if (status === "processed" || status === "warning") return "ok";
  if (status === "code_mapping_error") return "warn";
  if (status.endsWith("_error")) return "err";
  return "pend";
}

function toneDot(tone: MessageTone): string {
  if (tone === "ok") return "dot ok";
  if (tone === "warn") return "dot warn";
  if (tone === "err") return "dot err";
  // `pend` (received / queued-for-worker): animated pulse so the user
  // sees the message is actively being worked on, not stuck. The
  // in-process worker polls every ~5s so the flip to "processed" is
  // visible within one list-refresh tick.
  return "dot pulse-accent";
}

function toneChip(tone: MessageTone): string {
  if (tone === "ok") return `<span class="chip chip-ok">processed</span>`;
  if (tone === "warn") return `<span class="chip chip-warn">needs mapping</span>`;
  if (tone === "err") return `<span class="chip chip-err">error</span>`;
  // Active-state chip: inline spinner + "processing" text so the user
  // sees activity rather than a static "pending" label. Worker poll
  // (~5s) will flip this to `processed` on the next list refresh tick.
  return `<span class="chip inline-flex items-center gap-1.5"><span class="spinner" style="width:10px;height:10px"></span>processing</span>`;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function summarize(m: IncomingHL7v2Message): string {
  // The MESSAGE column's job is to tell the user *why this row stands
  // out* — NOT to restate the status chip rendered at the end of the
  // same row. For `processed` / `warning` rows there's nothing
  // additional to say without a richer summary pass (patient ref,
  // observation values, etc. — out of scope for v1), so return empty
  // and let the chip carry the signal. Only `*_error` / `code_mapping_error`
  // rows get text, because those are the rows a user actually needs
  // to read.
  switch (m.status) {
    case "processed":
    case "warning":
    case "received":
    case "deferred":
      return "";
    case "code_mapping_error": {
      const first = m.unmappedCodes?.[0];
      if (first?.localCode) {
        return `${first.localCode} — no mapping`;
      }
      return "unmapped code — routed to triage";
    }
    case "parsing_error":
      return `parse failed${m.error ? ` — ${truncate(m.error, 60)}` : ""}`;
    case "conversion_error":
      return `conversion failed${m.error ? ` — ${truncate(m.error, 60)}` : ""}`;
    case "sending_error":
      return "submit to Aidbox failed";
    default:
      return m.error ? truncate(m.error, 80) : "";
  }
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

// ----------------------------------------------------------------------------
// Type chip row
// ----------------------------------------------------------------------------

export function renderTypeChipsPartial(
  chips: TypeChipCount[],
  selectedType: string | undefined,
  otherFilters: InboundFilters,
): string {
  const qs = (override: Partial<InboundFilters>): string => {
    const merged = { ...otherFilters, ...override };
    const params = new URLSearchParams();
    if (merged.type) params.set("type", merged.type);
    if (merged.status) params.set("status", merged.status);
    if (merged.batch) params.set("batch", merged.batch);
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  const chipsHtml = chips
    .map((c) => {
      // The "errors" pseudo-chip sets `status=errors` (not a real status —
      // buildListQuery expands it to the 4 hard-error statuses). Everything
      // else uses `type=` and preserves the current status filter.
      const isErrors = c.label === "errors";
      const isAll = c.label === "All" && c.value === "";
      const href = isErrors
        ? qs({ type: undefined, status: "errors" })
        : isAll
        ? qs({ type: undefined, status: undefined })
        : qs({ type: c.value, status: otherFilters.status === "errors" ? undefined : otherFilters.status });
      const selected =
        (isAll && !selectedType && otherFilters.status !== "errors") ||
        (isErrors && otherFilters.status === "errors") ||
        (!isAll && !isErrors && c.value === selectedType);
      const toneCls = c.tone === "err" ? "chip-err" : selected ? "chip-accent" : "";
      return `
        <a href="${escapeHtml(href || "/incoming-messages")}"
           hx-boost="true"
           class="chip ${toneCls} text-[11.5px] px-2.5 py-1 cursor-pointer no-underline">${escapeHtml(c.label)} <span class="opacity-60 ml-1">${c.count}</span></a>
      `;
    })
    .join("");

  return `
    <div id="inbound-type-chips" class="flex gap-1.5 flex-wrap"
         hx-get="/incoming-messages/partials/type-chips${qs({})}"
         hx-trigger="every 10s"
         hx-swap="outerHTML">${chipsHtml}</div>
  `;
}

// ----------------------------------------------------------------------------
// List pane
// ----------------------------------------------------------------------------

function renderListHeader(): string {
  return `
    <div class="grid gap-3 px-5 py-2 border-b border-line text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium bg-paper-2"
         style="grid-template-columns: 14px 80px 160px 140px 1fr 110px">
      <span></span>
      <span>time</span>
      <span>type</span>
      <span>sender</span>
      <span>message</span>
      <span class="justify-self-end">status</span>
    </div>
  `;
}

function renderListRow(m: IncomingHL7v2Message, index: number, selectedId: string | undefined): string {
  const tone = statusToTone(m.status);
  const selected = m.id === selectedId;
  const borderTop = index === 0 ? "" : "border-t border-line";
  const bg = selected ? "bg-paper-2" : "";
  const accentBar = selected ? "border-l-2 border-l-accent" : "border-l-2 border-l-transparent";
  const id = m.id ?? "";
  return `
    <div class="grid gap-3 items-center px-5 py-2.5 cursor-pointer ${borderTop} ${bg} ${accentBar} hover:bg-paper-2/60"
         style="grid-template-columns: 14px 80px 160px 140px 1fr 110px"
         hx-get="/incoming-messages/${encodeURIComponent(id)}/partials/detail"
         hx-target="#detail"
         hx-swap="outerHTML"
         hx-push-url="?selected=${encodeURIComponent(id)}"
         data-message-id="${escapeHtml(id)}">
      <span class="${toneDot(tone)}"></span>
      <span class="font-mono text-ink-3 text-[11.5px] whitespace-nowrap">${escapeHtml(formatTime(m.meta?.lastUpdated ?? m.date))}</span>
      <span class="chip text-[10.5px] justify-self-start max-w-full truncate" title="${escapeHtml(m.type ?? "")}">${escapeHtml(m.type ? displayMessageType(m.type) : "—")}</span>
      <span class="text-[12.5px] text-ink-2 whitespace-nowrap overflow-hidden text-ellipsis">${escapeHtml(m.sendingApplication ?? "—")}</span>
      <span class="text-[13px] text-ink min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">${escapeHtml(summarize(m))}</span>
      <span class="justify-self-end">${toneChip(tone)}</span>
    </div>
  `;
}

function buildListUrl(filters: InboundFilters): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.batch) params.set("batch", filters.batch);
  if (filters.selected) params.set("selected", filters.selected);
  const s = params.toString();
  return `/incoming-messages/partials/list${s ? `?${s}` : ""}`;
}

export function renderListPartial(
  messages: IncomingHL7v2Message[],
  filters: InboundFilters,
): string {
  const selectedId = filters.selected;
  const hasSelection = !!selectedId;
  const rows = messages
    .map((m, i) => renderListRow(m, i, selectedId))
    .join("");
  const body =
    messages.length === 0
      ? `<div class="px-5 py-10 text-center text-ink-3 text-[13px]">No messages match these filters.</div>`
      : rows;
  const latestClock = messages[0]?.meta?.lastUpdated ?? messages[0]?.date;
  const subLabel = latestClock ? `streaming · ${formatTime(latestClock)}` : "streaming";
  // Auto-refresh: polls every 5s via a filtered `hx-trigger` that
  // skips the tick when `#detail` contains a selection marker. Using
  // `hx-trigger`'s `[condition]` clause so no Alpine/JS state needs
  // to stay in sync with the DOM — the condition reads the DOM at
  // tick time. `hx-vals` re-reads `window.location.search` on each
  // fire so `?selected=...` pushed by row clicks and `?type=...`
  // pushed by chip clicks are threaded through without re-rendering
  // the list at click time.
  // Polling lives in Alpine rather than htmx attributes. `hx-trigger`'s
  // `[condition]` filter and `hx-vals`' `js:` expression both tokenize
  // JS-ish in a way that breaks on property access (`.`), optional
  // chaining (`?.`), and nested `[...]`. Every attempt to thread the
  // current URL through `hx-vals` or gate the trigger via a DOM query
  // bailed out htmx's entire subtree — which silently disabled the
  // row click's hx-get too. Alpine's `setInterval` + `htmx.ajax()` is
  // ordinary JS with no tokenizer footguns.
  return `
    <div id="inbound-list"
         class="card flex flex-col overflow-hidden self-start"
         data-has-selection="${hasSelection ? "true" : "false"}"
         x-data="{
           _poll: null,
           start() {
             this.stop();
             this._poll = setInterval(() => {
               var detail = document.getElementById('detail');
               if (detail && detail.getAttribute('data-selected')) return;
               window.htmx.ajax('GET', '/incoming-messages/partials/list' + window.location.search, { target: '#inbound-list', swap: 'outerHTML' });
             }, 5000);
           },
           stop() { if (this._poll) { clearInterval(this._poll); this._poll = null; } }
         }"
         x-init="start()"
         x-on:htmx:before-swap.window="stop()"
         x-on:message-replayed.window="window.htmx.ajax('GET', '/incoming-messages/partials/list' + window.location.search, { target: '#inbound-list', swap: 'outerHTML' })">
      <div class="card-head">
        <span class="card-title">${escapeHtml(titleForFilters(filters, messages.length))}</span>
        <span class="card-sub">${escapeHtml(subLabel)}</span>
      </div>
      ${renderListHeader()}
      ${body}
    </div>
  `;
}

function titleForFilters(filters: InboundFilters, count: number): string {
  const parts: string[] = [];
  if (filters.type) parts.push(displayMessageType(filters.type));
  if (filters.status === "errors") parts.push("errors");
  else if (filters.status) parts.push(filters.status);
  if (filters.batch) parts.push(`batch ${filters.batch}`);
  const base = parts.length ? parts.join(" · ") : "All messages";
  return `${base} (${count})`;
}

// ----------------------------------------------------------------------------
// Detail pane (Task 8 scaffold — Task 9 replaces the tab area with real tabs)
// ----------------------------------------------------------------------------

export function renderEmptyDetail(): string {
  // NOTE: no `data-selected` attr — that's the signal the list's
  // `hx-trigger="every 5s[!...]"` filter uses to decide whether to
  // poll. Empty detail → polls. Populated detail → skips.
  return `
    <div id="detail" class="card flex flex-col self-start overflow-hidden min-h-[360px]">
      <div class="card-head">
        <span class="card-title">Select a message</span>
      </div>
      <div class="flex-1 grid place-items-center text-ink-3 text-[13px] py-16 px-8 text-center">
        Pick a row from the list to see its details — raw HL7, parsed segments,
        FHIR resources, and the processing timeline.
      </div>
    </div>
  `;
}

// ----------------------------------------------------------------------------
// Page body
// ----------------------------------------------------------------------------

async function renderInboundBody(
  filters: InboundFilters,
  messages: IncomingHL7v2Message[],
  chips: TypeChipCount[],
  selectedMessage: IncomingHL7v2Message | null,
  totalToday: number,
  triageCount: number,
  errorCount: number,
): Promise<string> {
  const subBits: string[] = [`${totalToday} received today`];
  if (triageCount > 0) subBits.push(`<span class="text-warn">${triageCount} in triage</span>`);
  if (errorCount > 0) subBits.push(`<span class="text-err">${errorCount} errors</span>`);

  const detail = selectedMessage
    ? await renderDetailCard(selectedMessage, "structured")
    : renderEmptyDetail();

  return `
    <div>
      <div class="flex items-end gap-4 mb-4">
        <div class="flex-1">
          <h1 class="h1">Inbound messages</h1>
          <div class="text-ink-2 text-[13.5px] mt-1">${subBits.join(" · ")}</div>
        </div>
      </div>

      ${renderTypeChipsPartial(chips, filters.type, filters)}

      <div class="grid gap-4 mt-4" style="grid-template-columns: minmax(560px, 1fr) 1fr; min-height: 620px">
        ${renderListPartial(messages, filters)}
        ${detail}
      </div>
    </div>
  `;
}

// ============================================================================
// Handlers
// ============================================================================

function parseFilters(req: Request): InboundFilters {
  const url = new URL(req.url);
  return {
    type: url.searchParams.get("type") || undefined,
    status: url.searchParams.get("status") || undefined,
    batch: url.searchParams.get("batch") || undefined,
    selected: url.searchParams.get("selected") || undefined,
  };
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countsForHero(): Promise<{ totalToday: number; triage: number; errors: number }> {
  const todayIso = startOfTodayIso();
  const errorOr = ERROR_STATUSES.join(",");
  try {
    const [today, triage, errs] = await Promise.all([
      aidboxFetch<Bundle<IncomingHL7v2Message>>(
        `/fhir/IncomingHL7v2Message?_lastUpdated=gt${todayIso}&_count=0&_total=accurate`,
      ),
      aidboxFetch<Bundle<IncomingHL7v2Message>>(
        `/fhir/IncomingHL7v2Message?status=code_mapping_error&_count=0&_total=accurate`,
      ),
      aidboxFetch<Bundle<IncomingHL7v2Message>>(
        `/fhir/IncomingHL7v2Message?status=${errorOr}&_count=0&_total=accurate`,
      ),
    ]);
    return {
      totalToday: today.total ?? 0,
      triage: triage.total ?? 0,
      errors: errs.total ?? 0,
    };
  } catch (error) {
    console.error(
      "[inbound] counts failed:",
      error instanceof Error ? error.message : error,
    );
    return { totalToday: 0, triage: 0, errors: 0 };
  }
}

export async function handleInboundMessagesPage(req: Request): Promise<Response> {
  const filters = parseFilters(req);
  const [navData, messages, chips, hero, selectedMessage] = await Promise.all([
    getNavData(),
    getInboundList(filters),
    getTypeChipCounts(),
    countsForHero(),
    filters.selected ? getMessageById(filters.selected) : Promise.resolve(null),
  ]);
  const content = await renderInboundBody(
    filters,
    messages,
    chips,
    selectedMessage,
    hero.totalToday,
    hero.triage,
    hero.errors,
  );
  return htmlResponse(
    renderShell({
      active: "inbound",
      title: "Inbound Messages",
      navData,
      content,
    }),
  );
}

export async function handleInboundListPartial(req: Request): Promise<Response> {
  const filters = parseFilters(req);
  const messages = await getInboundList(filters);
  return htmlResponse(renderListPartial(messages, filters));
}

export async function handleInboundTypeChipsPartial(
  req: Request,
): Promise<Response> {
  const filters = parseFilters(req);
  const chips = await getTypeChipCounts();
  return htmlResponse(renderTypeChipsPartial(chips, filters.type, filters));
}
