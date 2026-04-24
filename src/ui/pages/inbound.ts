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
import {
  parseIncomingMessage,
  parseIncomingMessages,
  assertNever,
  isMalformed,
  type ParsedIncomingMessage,
} from "../domain/incoming-message";

// ============================================================================
// Types + constants
// ============================================================================

export interface InboundFilters {
  type?: string;
  status?: string;
  batch?: string;
  selected?: string;
  /** 1-indexed page number. Aidbox pagination uses `page=N` (not
   *  `_getpagesoffset` which is HAPI-specific). */
  page?: number;
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
// Page size — sized so the list fits one common laptop/desktop viewport
// (≈ 900px list area ÷ ~45px row + chrome) without scrolling the body.
const LIST_COUNT = 20;

// ============================================================================
// FHIR queries
// ============================================================================

function buildListQuery(filters: InboundFilters): string {
  const params: string[] = [
    `_sort=-_lastUpdated`,
    `_count=${LIST_COUNT}`,
    // _total=accurate lets the pager show "Showing N–M of T" without a
    // second count query.
    `_total=accurate`,
  ];
  // Aidbox's offset pagination uses `page=N` (1-indexed). HAPI's
  // `_getpagesoffset` is NOT supported and 404s with "Search parameter
  // 'getpagesoffset' is not found".
  if (filters.page && filters.page > 1) {
    params.push(`page=${filters.page}`);
  }
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
): Promise<{ messages: ParsedIncomingMessage[]; total: number }> {
  const bundle = await aidboxFetch<Bundle<IncomingHL7v2Message>>(
    buildListQuery(filters),
  );
  const raw = bundle.entry?.map((e) => e.resource) ?? [];
  return {
    // parseIncomingMessages drops malformed records with a logged warning;
    // downstream readers only see cleanly-classified parsed variants.
    messages: parseIncomingMessages(raw),
    total: bundle.total ?? 0,
  };
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
): Promise<ParsedIncomingMessage | null> {
  try {
    const raw = await aidboxFetch<IncomingHL7v2Message>(
      `/fhir/IncomingHL7v2Message/${encodeURIComponent(id)}`,
    );
    const parsed = parseIncomingMessage(raw);
    if (isMalformed(parsed)) {
      console.warn(
        `[inbound] getMessageById(${id}) returned malformed wire record: ${parsed.reason}`,
      );
      return null;
    }
    return parsed;
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

export function statusToTone(p: ParsedIncomingMessage): MessageTone {
  // Exhaustive — adding a new variant to ParsedIncomingMessage will
  // fail to compile here (default arm narrows `p` to `never`).
  switch (p.kind) {
    case "processed":
    case "warning":
      return "ok";
    case "code_mapping_error":
      return "warn";
    case "parsing_error":
    case "conversion_error":
    case "sending_error":
      return "err";
    case "received":
    case "deferred":
      return "pend";
    default:
      return assertNever(p);
  }
}

/**
 * Permissive string-based tone lookup for contexts where we only have
 * the status wire string — typically Aidbox `_history` entries, where
 * each version carries `resource.status` but we don't parse every
 * version into a full ParsedIncomingMessage. Unknown strings fall
 * through to "pend" rather than crashing the timeline.
 */
export function statusStringToTone(s: string | undefined): MessageTone {
  if (!s) return "pend";
  if (s === "processed" || s === "warning") return "ok";
  if (s === "code_mapping_error") return "warn";
  if (s.endsWith("_error")) return "err";
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
  // sees activity rather than a static "pending" label. Per-row polling
  // (see renderRowStatusCell) swaps this into its settled form when the
  // worker flips the status.
  return `<span class="chip inline-flex items-center gap-1.5"><span class="spinner" style="width:10px;height:10px"></span>processing</span>`;
}

/** True when a status is settled and no further transition is expected. */
function isTerminalStatus(p: ParsedIncomingMessage): boolean {
  switch (p.kind) {
    case "processed":
    case "warning":
    case "deferred":
    case "parsing_error":
    case "conversion_error":
    case "sending_error":
    case "code_mapping_error":
      return true;
    case "received":
      return false;
    default:
      return assertNever(p);
  }
}

/**
 * Status cell for a row. Non-terminal statuses render a self-polling
 * wrapper so the chip flips in place (received → processed/needs mapping/
 * error) without refreshing the whole list. Terminal statuses render as
 * plain static HTML.
 *
 * The poll uses Alpine `setInterval` + `htmx.ajax()` rather than
 * `hx-trigger="every 5s"`. Reason: htmx's interval timer is tied to the
 * element reference, and `hx-swap="outerHTML"` replaces the element with
 * a new one — the new reference doesn't inherit the old interval, so
 * polling fires once and then stops. Alpine's `x-data` is re-initialized
 * by the framework on each swapped replacement, so its `setInterval`
 * self-restarts on every tick cycle. The `$el.isConnected` check cleans
 * up dead intervals when the row gets removed from the list.
 */
export function renderRowStatusCell(p: ParsedIncomingMessage): string {
  const id = p.id;
  const tone = statusToTone(p);
  const chip = toneChip(tone);
  if (isTerminalStatus(p)) {
    return `<span id="status-${escapeHtml(id)}" class="justify-self-end">${chip}</span>`;
  }
  const url = `/incoming-messages/${encodeURIComponent(id)}/partials/status`;
  return `<span id="status-${escapeHtml(id)}"
                class="justify-self-end"
                x-data
                x-init="(() => {
                  var self = $el;
                  var pid = setInterval(function() {
                    if (!self || !self.isConnected) { clearInterval(pid); return; }
                    window.htmx.ajax('GET', '${url}', { target: self, swap: 'outerHTML' });
                  }, 5000);
                })()">${chip}</span>`;
}

function formatTime(iso: string | undefined): string {
  if (!iso) return "--:--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--:--";
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function summarize(p: ParsedIncomingMessage): string {
  // The MESSAGE column's job is to tell the user *why this row stands
  // out* — NOT to restate the status chip rendered at the end of the
  // same row. For `processed` / `warning` rows there's nothing
  // additional to say without a richer summary pass (patient ref,
  // observation values, etc. — out of scope for v1), so return empty
  // and let the chip carry the signal. Only `*_error` / `code_mapping_error`
  // rows get text, because those are the rows a user actually needs
  // to read.
  switch (p.kind) {
    case "received":
    case "processed":
    case "warning":
    case "deferred":
      return "";
    case "code_mapping_error":
      // p.unmappedCodes is non-empty by construction: the parser returns
      // a MalformedWireRecord if a code_mapping_error wire record has
      // no codes, so this arm never runs on that invalid shape.
      return `${p.unmappedCodes[0]!.localCode} — no mapping`;
    case "parsing_error":
      return `parse failed — ${truncate(p.error, 60)}`;
    case "conversion_error":
      return `conversion failed — ${truncate(p.error, 60)}`;
    case "sending_error":
      return "submit to Aidbox failed";
    default:
      return assertNever(p);
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

function renderListHeader(
  filters: InboundFilters,
  chips: TypeChipCount[],
): string {
  // Column-header popovers for TYPE and STATUS — matches the
  // terminology-map filter pattern. The filter icon is warm-accent
  // when a filter is active. Popovers render inline (small data set,
  // no lazy fetch needed).
  return `
    <div class="grid gap-3 px-5 py-2 border-b border-line text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium bg-paper-2 relative"
         style="grid-template-columns: 14px 80px 160px 140px 1fr 110px">
      <span></span>
      <span>time</span>
      ${renderTypeFilterHeader(filters, chips)}
      <span>sender</span>
      <span>message</span>
      ${renderStatusFilterHeader(filters)}
    </div>
  `;
}

function renderTypeFilterHeader(
  filters: InboundFilters,
  chips: TypeChipCount[],
): string {
  const activeType = filters.type;
  const isActive = !!activeType;
  // Build URL that preserves everything except type/page (paging
  // resets on filter change — page 2 of a different filter is
  // meaningless).
  const urlFor = (type: string | undefined): string => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (filters.status) p.set("status", filters.status);
    if (filters.batch) p.set("batch", filters.batch);
    const s = p.toString();
    return `/incoming-messages${s ? `?${s}` : ""}`;
  };
  // Filter chips are everything except the synthetic "All" and
  // "errors" entries — those are status filters, not type filters.
  const typeChips = chips.filter((c) => c.label !== "All" && c.label !== "errors");
  const rows = [
    // "All types" entry — clears the type filter.
    `<a href="${escapeHtml(urlFor(undefined))}"
        class="flex items-center gap-2.5 no-underline ${!activeType ? "bg-paper-2 font-semibold" : ""}"
        style="padding:7px 12px; user-select:none; text-transform:none; letter-spacing:normal; color:var(--ink)">
        <span class="flex-1 min-w-0 truncate text-[12.5px]">All types</span>
        <span class="font-mono text-[10.5px] text-ink-3 shrink-0">${chips.find((c) => c.label === "All")?.count ?? 0}</span>
     </a>`,
    ...typeChips.map(
      (c) => `<a href="${escapeHtml(urlFor(c.value))}"
        class="flex items-center gap-2.5 no-underline ${activeType === c.value ? "bg-paper-2 font-semibold" : ""}"
        style="padding:7px 12px; user-select:none; text-transform:none; letter-spacing:normal; color:var(--ink)">
        <span class="flex-1 min-w-0 truncate font-mono text-[12px]">${escapeHtml(displayMessageType(c.value))}</span>
        <span class="font-mono text-[10.5px] text-ink-3 shrink-0">${c.count}</span>
     </a>`,
    ),
  ].join("");
  return `
    <div class="relative flex items-center gap-1"
         x-data="{ open: false }"
         x-on:click.outside="open = false"
         x-on:keyup.escape.window="open = false">
      <span>type</span>
      <button type="button"
              x-on:click="open = !open"
              class="inline-flex items-center gap-0.5 border-none rounded cursor-pointer ${isActive ? "bg-accent-soft text-accent-ink" : "bg-transparent text-ink-3"}"
              style="padding:2px 5px; font-family:inherit"
              title="Filter by type">
        ${renderIcon("filter", "sm")}
      </button>
      <div x-show="open"
           x-cloak
           x-transition.opacity
           x-on:click.stop
           class="absolute bg-paper border border-line rounded-lg overflow-hidden shadow-xl z-50 left-0"
           style="top: calc(100% + 6px); min-width:220px; max-width:300px">
        <div class="overflow-y-auto" style="max-height:320px; padding:4px 0">${rows}</div>
      </div>
    </div>
  `;
}

function renderStatusFilterHeader(filters: InboundFilters): string {
  const errorsOn = filters.status === "errors";
  const urlFor = (status: string | undefined): string => {
    const p = new URLSearchParams();
    if (filters.type) p.set("type", filters.type);
    if (status) p.set("status", status);
    if (filters.batch) p.set("batch", filters.batch);
    const s = p.toString();
    return `/incoming-messages${s ? `?${s}` : ""}`;
  };
  const isActive = !!filters.status;
  return `
    <div class="relative justify-self-end flex items-center gap-1"
         x-data="{ open: false }"
         x-on:click.outside="open = false"
         x-on:keyup.escape.window="open = false">
      <span>status</span>
      <button type="button"
              x-on:click="open = !open"
              class="inline-flex items-center gap-0.5 border-none rounded cursor-pointer ${isActive ? "bg-accent-soft text-accent-ink" : "bg-transparent text-ink-3"}"
              style="padding:2px 5px; font-family:inherit"
              title="Filter by status">
        ${renderIcon("filter", "sm")}
      </button>
      <div x-show="open"
           x-cloak
           x-transition.opacity
           x-on:click.stop
           class="absolute bg-paper border border-line rounded-lg overflow-hidden shadow-xl z-50 right-0"
           style="top: calc(100% + 6px); min-width:200px; max-width:260px">
        <div class="overflow-y-auto" style="padding:4px 0">
          <a href="${escapeHtml(urlFor(undefined))}"
             class="flex items-center gap-2.5 no-underline ${!filters.status ? "bg-paper-2 font-semibold" : ""}"
             style="padding:7px 12px; user-select:none; text-transform:none; letter-spacing:normal; color:var(--ink)">
            <span class="flex-1 min-w-0 truncate text-[12.5px]">Any status</span>
          </a>
          <a href="${escapeHtml(urlFor("errors"))}"
             class="flex items-center gap-2.5 no-underline ${errorsOn ? "bg-paper-2 font-semibold" : ""}"
             style="padding:7px 12px; user-select:none; text-transform:none; letter-spacing:normal; color:var(--err)">
            <span class="flex-1 min-w-0 truncate text-[12.5px]">Errors only</span>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderListRow(p: ParsedIncomingMessage, index: number, selectedId: string | undefined): string {
  const tone = statusToTone(p);
  const selected = p.id === selectedId;
  const borderTop = index === 0 ? "" : "border-t border-line";
  const bg = selected ? "bg-paper-2" : "";
  const accentBar = selected ? "border-l-2 border-l-accent" : "border-l-2 border-l-transparent";
  const id = p.id;
  // onclick flips the highlight instantly (before the htmx request resolves
  // and before the next list refresh). Without this the clicked row stays
  // unstyled for up to 1s, which reads as a broken click. The server-
  // rendered class strings still win on the next poll — the JS is purely
  // cosmetic pre-alignment.
  const clickHighlight = `document.querySelectorAll('[data-message-id]').forEach(function(r){r.classList.remove('bg-paper-2','border-l-accent');r.classList.add('border-l-transparent');});this.classList.add('bg-paper-2','border-l-accent');this.classList.remove('border-l-transparent');`;
  return `
    <div class="grid gap-3 items-center px-5 py-2.5 cursor-pointer ${borderTop} ${bg} ${accentBar} hover:bg-paper-2/60"
         style="grid-template-columns: 14px 80px 160px 140px 1fr 110px"
         onclick="${clickHighlight}"
         hx-get="/incoming-messages/${encodeURIComponent(id)}/partials/detail"
         hx-target="#detail"
         hx-swap="outerHTML"
         hx-push-url="?selected=${encodeURIComponent(id)}"
         data-message-id="${escapeHtml(id)}">
      <span class="${toneDot(tone)}"></span>
      <span class="font-mono text-ink-3 text-[11.5px] whitespace-nowrap">${escapeHtml(formatTime(p.lastUpdated || p.date))}</span>
      <span class="chip text-[10.5px] justify-self-start max-w-full truncate" title="${escapeHtml(p.type)}">${escapeHtml(displayMessageType(p.type))}</span>
      <span class="text-[12.5px] text-ink-2 whitespace-nowrap overflow-hidden text-ellipsis">${escapeHtml(p.sendingApplication)}</span>
      <span class="text-[13px] text-ink min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">${escapeHtml(summarize(p))}</span>
      ${renderRowStatusCell(p)}
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
  messages: ParsedIncomingMessage[],
  filters: InboundFilters,
  total: number = messages.length,
  chips: TypeChipCount[] = [],
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
  return `
    <div id="inbound-list"
         class="card flex flex-col overflow-hidden self-start"
         data-has-selection="${hasSelection ? "true" : "false"}"
         x-data
         x-on:message-replayed.window="window.htmx.ajax('GET', '/incoming-messages/partials/list' + window.location.search, { target: '#inbound-list', swap: 'outerHTML' })">
      <div class="card-head">
        <span class="card-title">${escapeHtml(titleForFilters(filters, total))}</span>
      </div>
      ${renderListHeader(filters, chips)}
      ${body}
      ${renderPager(filters, messages.length, total)}
    </div>
  `;
}

/**
 * Offset-based pager. Always shows the "N–M of T" counter so the user
 * knows they're looking at a stable snapshot, not a live feed. Prev/
 * Next buttons appear only when there's more than one page.
 *
 * Links use full-page navigation (plain hrefs) rather than hx-boost —
 * paging changes the URL *and* replaces the list snapshot, and
 * hx-boost on anchors inside an hx-target card has edge-case swap
 * behavior we don't need to fight.
 */
function renderPager(
  filters: InboundFilters,
  pageSize: number,
  total: number,
): string {
  if (total === 0) return "";
  const page = filters.page ?? 1;
  const totalPages = Math.max(1, Math.ceil(total / LIST_COUNT));
  const offset = (page - 1) * LIST_COUNT;
  const from = offset + 1;
  const to = Math.min(offset + pageSize, total);
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const needsPager = total > LIST_COUNT;
  const qsForPage = (p: number): string => {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.status) params.set("status", filters.status);
    if (filters.batch) params.set("batch", filters.batch);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return `/incoming-messages${s ? `?${s}` : ""}`;
  };
  const btn = (href: string, label: string, enabled: boolean): string => {
    if (!enabled) {
      return `<span class="text-[12px] text-ink-3 opacity-40 cursor-not-allowed select-none" style="padding:4px 10px">${label}</span>`;
    }
    return `<a href="${escapeHtml(href)}" class="text-[12px] text-ink-2 no-underline rounded hover:bg-paper-2" style="padding:4px 10px">${label}</a>`;
  };
  return `
    <div class="flex items-center justify-between border-t border-line bg-paper-2"
         style="padding:8px 18px">
      <span class="text-[11.5px] text-ink-3 font-mono tabular-nums">${from}–${to} of ${total}</span>
      ${
        needsPager
          ? `<div class="flex items-center gap-2">
               ${btn(qsForPage(page - 1), "‹ Prev", hasPrev)}
               <span class="text-[11.5px] text-ink-3 font-mono tabular-nums">${page} / ${totalPages}</span>
               ${btn(qsForPage(page + 1), "Next ›", hasNext)}
             </div>`
          : ""
      }
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
  messages: ParsedIncomingMessage[],
  total: number,
  chips: TypeChipCount[],
  selectedMessage: ParsedIncomingMessage | null,
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

      <div class="grid gap-4 mt-4" style="grid-template-columns: minmax(560px, 1fr) 1fr; min-height: 620px">
        ${renderListPartial(messages, filters, total, chips)}
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
  const pageRaw = url.searchParams.get("page");
  const page = pageRaw ? Math.max(1, parseInt(pageRaw, 10) || 1) : 1;
  return {
    type: url.searchParams.get("type") || undefined,
    status: url.searchParams.get("status") || undefined,
    batch: url.searchParams.get("batch") || undefined,
    selected: url.searchParams.get("selected") || undefined,
    page: page > 1 ? page : undefined,
  };
}

function startOfTodayIso(): string {
  // Use *local* midnight, not UTC midnight — for a user east of UTC,
  // their "today" starts earlier in UTC time. UTC midnight would drop
  // messages that landed last evening local-time (still "today" to
  // the user) and make the hero say "0 received today" when 20+
  // messages are visible. `toISOString()` converts back to UTC so
  // Aidbox can consume the `_lastUpdated=gt<iso>` filter unchanged.
  const d = new Date();
  d.setHours(0, 0, 0, 0);
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
  const [navData, list, chips, hero, selectedMessage] = await Promise.all([
    getNavData(),
    getInboundList(filters),
    getTypeChipCounts(),
    countsForHero(),
    filters.selected ? getMessageById(filters.selected) : Promise.resolve(null),
  ]);
  const content = await renderInboundBody(
    filters,
    list.messages,
    list.total,
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
  // Chips fetched in parallel so the refreshed list carries up-to-date
  // type counts in its column-header filter popover.
  const [{ messages, total }, chips] = await Promise.all([
    getInboundList(filters),
    getTypeChipCounts(),
  ]);
  return htmlResponse(renderListPartial(messages, filters, total, chips));
}

export async function handleInboundTypeChipsPartial(
  req: Request,
): Promise<Response> {
  const filters = parseFilters(req);
  const chips = await getTypeChipCounts();
  return htmlResponse(renderTypeChipsPartial(chips, filters.type, filters));
}

/**
 * Per-row status refresh — fetches a single message and returns just
 * the status cell. Swapped in place via outerHTML; if the message is
 * still non-terminal, the returned cell carries its own hx-trigger so
 * polling continues. If the message hit a terminal state, the returned
 * cell is static HTML and self-polling stops.
 */
export async function handleInboundRowStatusPartial(
  id: string,
): Promise<Response> {
  if (!id) return new Response("missing id", { status: 400 });
  try {
    const raw = await aidboxFetch<IncomingHL7v2Message>(
      `/fhir/IncomingHL7v2Message/${encodeURIComponent(id)}`,
    );
    const parsed = parseIncomingMessage(raw);
    if (isMalformed(parsed)) {
      console.warn(
        `[inbound] row status for ${id}: malformed wire record — ${parsed.reason}`,
      );
      return htmlResponse(
        `<span id="status-${escapeHtml(id)}" class="justify-self-end text-ink-3 text-[11.5px]">—</span>`,
      );
    }
    return htmlResponse(renderRowStatusCell(parsed));
  } catch (error) {
    // Row no longer resolvable (deleted, Aidbox down) — stop polling by
    // returning a static "—" cell rather than an error page.
    console.error(
      "[inbound] row status fetch failed:",
      error instanceof Error ? error.message : error,
    );
    return htmlResponse(
      `<span id="status-${escapeHtml(id)}" class="justify-self-end text-ink-3 text-[11.5px]">—</span>`,
    );
  }
}
