/**
 * Terminology Map — canonical ledger of every established code mapping.
 *
 * Organized by FHIR target (Observation.code, Condition.code, ...) — the
 * meaning of a code, not its byte offset in HL7. HL7 field paths (OBX-3,
 * DG1-3) live in the detail panel where they belong.
 *
 * Layout (per `page-terminology.jsx` + DESIGN_OVERVIEW.md):
 *   Hero (+ "Add mapping" primary)
 *   KPI strip: Total mappings · Coverage % · Messages/window · Needs review (0)
 *   Table + Detail (1fr + 380px)
 *     Toolbar: search + active-filter clear + count
 *     Column headers: Local code · System · Standard · FHIR target · Sender
 *     Facet popovers on FHIR target + Sender columns
 *     Detail: FHIR target ▸ Local ▸ Standard ▸ Source ▸ Lineage ▸ Edit/Delete
 *
 * URL params: ?q=<search>&fhir=<csv>&sender=<csv>&selectedMap=&selectedCode=&selectedSys=
 *   - fhir/sender are comma-delimited multi-values
 *   - selectedMap+selectedCode+selectedSys uniquely identify a row for detail pre-render
 *
 * Facet popovers fetch via htmx; the detail partial is URL-encoded and the
 * server decodes via decodeURIComponent (mirrors the Task 10 pattern).
 *
 * No soft-deprecate lifecycle in v1 (plan §Non-goals). No "usage" column
 * (design showed 4820 per row but we don't track it; fetching per-row would
 * be N+1). Needs-review = literal 0.
 */

import type { ConceptMap } from "../../fhir/hl7-fhir-r4-core/ConceptMap";
import type { IncomingHL7v2Message } from "../../fhir/aidbox-hl7v2-custom";
import { aidboxFetch, type Bundle } from "../../aidbox";
import { escapeHtml } from "../../utils/html";
import { renderShell } from "../shell";
import { htmlResponse, getNavData } from "../shared";
import { renderIcon } from "../icons";
import {
  detectMappingTypeFromConceptMap,
  getKnownTargetSystems,
  listConceptMaps,
} from "../../code-mapping/concept-map/service";
import { MAPPING_TYPES, targetLabel, sourceLabel } from "../../code-mapping/mapping-types";
import type { MappingTypeName } from "../../code-mapping/mapping-types";
import { suggestCodes } from "../../api/terminology-suggest";

// ============================================================================
// Types
// ============================================================================

export interface TerminologyRow {
  conceptMapId: string;
  localCode: string;
  localDisplay: string;
  localSystem: string;
  targetCode: string;
  targetDisplay: string;
  targetSystem: string;
  /** ConceptMap.title — "APP | FACILITY" format */
  sender: string;
  /** "Observation.code" etc. — derived from mapping type */
  fhirField: string;
  /** "OBX-3" etc. — derived from mapping type */
  hl7Field: string;
  mappingType: MappingTypeName;
  /** ISO timestamp from meta.createdAt (NOT _history) — per plan lineage decision */
  createdAt?: string;
}

export interface FacetEntry {
  name: string;
  count: number;
}

interface Filters {
  q: string;
  fhir: string[];
  sender: string[];
}

// ============================================================================
// Data loading
// ============================================================================

/**
 * Load all rows from every ConceptMap. Flattens `group[].element[]` across
 * every managed ConceptMap into a single list.
 */
export async function loadAllTerminologyRows(): Promise<TerminologyRow[]> {
  // _count=500 is a hard ceiling. Aidbox rejects _total=accurate on
  // ConceptMap, so truncation can't be detected — if the ledger exceeds 500,
  // a follow-up must paginate (noted in plan's Non-goals / scaling concerns).
  // A "next" link in bundle.link is the only weak signal available today.
  const bundle = await aidboxFetch<Bundle<ConceptMap> & { link?: Array<{ relation?: string }> }>(
    "/fhir/ConceptMap?_count=500",
  );
  const maps = bundle.entry?.map((e) => e.resource) ?? [];
  if (bundle.link?.some((l) => l.relation === "next")) {
    console.warn(
      `[terminology] ConceptMap scan hit the _count=500 ceiling (bundle has a 'next' link). Paginate loadAllTerminologyRows.`,
    );
  }
  const known = getKnownTargetSystems();
  const rows: TerminologyRow[] = [];

  for (const cm of maps) {
    if (!cm.targetUri || !known.has(cm.targetUri)) continue;
    const mappingType = detectMappingTypeFromConceptMap(cm);
    if (!mappingType) continue;

    const type = MAPPING_TYPES[mappingType];
    const fhirField = targetLabel(type);
    const hl7Field = sourceLabel(type);
    const sender = cm.title ?? cm.id ?? "(unknown sender)";
    const defaultTarget = cm.targetUri;
    // Aidbox sets meta.createdAt (non-standard but present on all resources),
    // fallback to lastUpdated. Cast through unknown — the generated FHIR Meta
    // type doesn't declare createdAt.
    const meta = cm.meta as (typeof cm.meta & { createdAt?: string }) | undefined;
    const createdAt = meta?.createdAt ?? meta?.lastUpdated;

    for (const group of cm.group ?? []) {
      const groupTarget = group.target ?? defaultTarget;
      for (const element of group.element ?? []) {
        const target = element.target?.[0];
        rows.push({
          conceptMapId: cm.id ?? "",
          localCode: element.code ?? "",
          localDisplay: element.display ?? "",
          localSystem: group.source ?? "",
          targetCode: target?.code ?? "",
          targetDisplay: target?.display ?? "",
          targetSystem: groupTarget,
          sender,
          fhirField,
          hl7Field,
          mappingType,
          createdAt,
        });
      }
    }
  }

  return rows;
}

// ============================================================================
// Filtering & faceting
// ============================================================================

function matchesQuery(row: TerminologyRow, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    row.localCode.toLowerCase().includes(needle) ||
    row.localDisplay.toLowerCase().includes(needle) ||
    row.targetCode.toLowerCase().includes(needle) ||
    row.targetDisplay.toLowerCase().includes(needle)
  );
}

export function applyFilters(rows: TerminologyRow[], f: Filters): TerminologyRow[] {
  return rows.filter(
    (r) =>
      matchesQuery(r, f.q) &&
      (f.fhir.length === 0 || f.fhir.includes(r.fhirField)) &&
      (f.sender.length === 0 || f.sender.includes(r.sender)),
  );
}

export function buildFacet(
  rows: TerminologyRow[],
  key: "fhirField" | "sender",
): FacetEntry[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    counts.set(r[key], (counts.get(r[key]) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function parseCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseFilters(url: URL): Filters {
  return {
    q: url.searchParams.get("q") ?? "",
    fhir: parseCsv(url.searchParams.get("fhir")),
    sender: parseCsv(url.searchParams.get("sender")),
  };
}

// ============================================================================
// KPI strip
// ============================================================================

export interface TerminologyKpis {
  totalMappings: number;
  coveragePercent: number | null;
  processedCount: number;
  needsReview: number; // literal 0 for v1
}

async function safeCount(path: string): Promise<number> {
  try {
    const bundle = await aidboxFetch<{ total?: number }>(path);
    return bundle.total ?? 0;
  } catch (err) {
    console.error(`[terminology] count fetch failed for ${path}:`, err);
    return 0;
  }
}

export async function computeKpis(
  rows: TerminologyRow[],
): Promise<TerminologyKpis> {
  const [processed, codeErr] = await Promise.all([
    safeCount("/fhir/IncomingHL7v2Message?status=processed&_count=0&_total=accurate"),
    safeCount(
      "/fhir/IncomingHL7v2Message?status=code_mapping_error&_count=0&_total=accurate",
    ),
  ]);

  const denom = processed + codeErr;
  const coveragePercent = denom > 0 ? Math.round((processed / denom) * 100) : null;

  return {
    totalMappings: rows.length,
    coveragePercent,
    processedCount: processed,
    needsReview: 0,
  };
}

// ============================================================================
// Render — shared bits
// ============================================================================

/** "Observation.code" → two-tone typography: resource bold-accent, field regular. */
function renderFhirLabel(field: string, active: boolean): string {
  if (!field || !field.includes(".")) {
    return `<span class="${active ? "text-ink" : "text-ink-2"}">${escapeHtml(field || "—")}</span>`;
  }
  const dot = field.indexOf(".");
  const res = field.slice(0, dot);
  const path = field.slice(dot);
  const resColor = active ? "text-accent-ink" : "text-ink-3";
  const pathWeight = active ? "font-medium" : "";
  return `<span class="${active ? "text-ink" : "text-ink-2"} whitespace-nowrap"><span class="${resColor} font-medium">${escapeHtml(res)}</span><span class="${pathWeight}">${escapeHtml(path)}</span></span>`;
}

function systemChipClasses(system: string): { bg: string; ink: string; bd: string } {
  const s = system || "";
  // Tone classes use inline colors (system palette is orthogonal to warm-paper tokens).
  // Map from the design reference; fall back to the warm-paper neutral.
  const palette: Record<string, { bg: string; ink: string; bd: string }> = {
    "http://loinc.org": { bg: "rgba(52,211,153,0.10)", ink: "#047857", bd: "rgba(52,211,153,0.35)" },
    "http://terminology.hl7.org/CodeSystem/v3-ActCode": {
      bg: "rgba(236,72,153,0.10)", ink: "#9d174d", bd: "rgba(236,72,153,0.35)",
    },
    "http://hl7.org/fhir/diagnostic-report-status": {
      bg: "rgba(148,163,184,0.12)", ink: "#475569", bd: "rgba(148,163,184,0.40)",
    },
    "http://hl7.org/fhir/observation-status": {
      bg: "rgba(148,163,184,0.12)", ink: "#475569", bd: "rgba(148,163,184,0.40)",
    },
    "http://hl7.org/fhir/request-status": {
      bg: "rgba(148,163,184,0.12)", ink: "#475569", bd: "rgba(148,163,184,0.40)",
    },
  };
  return palette[s] ?? { bg: "var(--paper-2)", ink: "var(--ink-2)", bd: "var(--line)" };
}

function renderSystemChip(system: string): string {
  const label = systemShortLabel(system);
  const c = systemChipClasses(system);
  return `<span class="inline-flex items-center font-mono font-semibold whitespace-nowrap rounded"
                style="padding:2px 8px; font-size:11px; letter-spacing:0.02em; background:${c.bg}; color:${c.ink}; border:1px solid ${c.bd}">${escapeHtml(label)}</span>`;
}

function systemShortLabel(system: string): string {
  const short: Record<string, string> = {
    "http://loinc.org": "LOINC",
    "http://terminology.hl7.org/CodeSystem/v3-ActCode": "v3 Act",
    "http://hl7.org/fhir/diagnostic-report-status": "FHIR",
    "http://hl7.org/fhir/observation-status": "FHIR",
    "http://hl7.org/fhir/request-status": "FHIR",
  };
  return short[system] ?? (system || "—");
}

// ============================================================================
// Render — KPI strip
// ============================================================================

function renderKpiStrip(k: TerminologyKpis): string {
  const cells = [
    { label: "Total mappings", value: String(k.totalMappings), sub: `across ${Object.keys(MAPPING_TYPES).length} code systems` },
    {
      label: "Coverage",
      value: k.coveragePercent === null ? "—" : `${k.coveragePercent}%`,
      sub: "of incoming codes resolve",
    },
    {
      label: "Messages processed",
      value: k.processedCount.toLocaleString(),
      sub: "routed through these maps",
    },
    { label: "Needs review", value: String(k.needsReview), sub: "deprecated upstream" },
  ];
  return `
    <div class="card grid overflow-hidden" style="grid-template-columns: repeat(4, 1fr); padding: 0">
      ${cells
        .map(
          (s, i) => `
        <div class="${i === 0 ? "" : "border-l border-line"}" style="padding:20px 24px; min-width:140px">
          <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1.5">${escapeHtml(s.label)}</div>
          <div class="flex items-baseline gap-2">
            <div class="font-mono text-[22px] font-medium text-ink tabular-nums" style="letter-spacing:-0.01em">${escapeHtml(s.value)}</div>
          </div>
          <div class="text-[11.5px] text-ink-3 mt-0.5">${escapeHtml(s.sub)}</div>
        </div>
      `,
        )
        .join("")}
    </div>
  `;
}

// ============================================================================
// Render — table
// ============================================================================

/** Uniquely identifies a row for hx-get / ?selected= */
function rowKey(row: TerminologyRow): string {
  return `${row.conceptMapId}|${row.localCode}|${row.localSystem}`;
}

export function renderTablePartial(
  rows: TerminologyRow[],
  total: number,
  f: Filters,
  selected: TerminologyRow | null,
): string {
  const activeFilterCount = f.fhir.length + f.sender.length;

  // Alpine-driven client-side row highlight. `selectedRowKey` lives on the
  // outer page's x-data scope (added in renderPageBody). When the user
  // clicks a row, htmx swaps the detail pane AND Alpine flips the active
  // row's styles — no need for a server-side re-render of the table to
  // update the highlight. The initial server-rendered `selected` seeds the
  // state on page load.
  const rowsHtml = rows.length
    ? rows
        .map((r) => {
          const key = rowKey(r);
          const keyExpr = escapeHtml(JSON.stringify(key));
          const detailUrl = `/terminology/partials/detail/${encodeURIComponent(r.conceptMapId)}/${encodeURIComponent(r.localCode)}?localSystem=${encodeURIComponent(r.localSystem)}`;
          const pushUrl = `/terminology?${new URLSearchParams({
            ...(f.q ? { q: f.q } : {}),
            ...(f.fhir.length ? { fhir: f.fhir.join(",") } : {}),
            ...(f.sender.length ? { sender: f.sender.join(",") } : {}),
            selectedMap: r.conceptMapId,
            selectedCode: r.localCode,
            selectedSys: r.localSystem,
          }).toString()}`;
          return `
            <div class='grid items-center cursor-pointer border-b border-line border-l-2'
                 style='grid-template-columns: 150px 82px 1fr 180px 140px; padding: 12px 18px; gap: 8px'
                 hx-get='${escapeHtml(detailUrl)}'
                 hx-target='#terminology-detail'
                 hx-swap='outerHTML'
                 hx-push-url='${escapeHtml(pushUrl)}'
                 x-on:click='selectedRowKey = ${keyExpr}'
                 :class='selectedRowKey === ${keyExpr} ? "bg-paper-2 border-l-accent" : "border-l-transparent"'
                 data-row-key='${escapeHtml(key)}'>
              <div class='min-w-0'>
                <div class='font-mono text-[12.5px] font-semibold truncate'
                     :class='selectedRowKey === ${keyExpr} ? "text-accent-ink" : "text-ink"'>${escapeHtml(r.localCode)}</div>
                <div class='text-[11px] text-ink-3 mt-0.5 truncate'>${escapeHtml(r.localDisplay)}</div>
              </div>
              <div>${renderSystemChip(r.targetSystem)}</div>
              <div class='min-w-0'>
                <div class='font-mono text-[12.5px] text-ink truncate'>${escapeHtml(r.targetCode)}</div>
                <div class='text-[11px] text-ink-3 mt-0.5 truncate'>${escapeHtml(r.targetDisplay)}</div>
              </div>
              <div class='min-w-0'>${renderFhirLabel(r.fhirField, false)}</div>
              <div class='text-[11.5px] text-ink-2 truncate'>${escapeHtml(r.sender)}</div>
            </div>
          `;
        })
        .join("")
    : `<div class="text-center text-ink-3 text-[13px]" style="padding: 40px">No mappings match your filters.</div>`;
  // The server-rendered `selected` arg is still consumed upstream to decide
  // which row to pre-render in the detail pane — the variable is no longer
  // needed here since all row styling is Alpine-driven.
  void selected;

  const clearQs = new URLSearchParams({ ...(f.q ? { q: f.q } : {}) }).toString();
  return `
    <div id="terminology-table" class="card overflow-visible">
      <!-- Toolbar -->
      <div class="flex items-center gap-2.5 bg-paper-2 border-b border-line flex-wrap"
           style="padding: 12px 16px">
        <!-- Search pill: white surface so the input stands out from the
             paper-2 toolbar bg (previously invisible since both shared
             the same tone). Icon + input share one focus-within ring. -->
        <div class="flex-1 min-w-[240px] flex items-center gap-2 px-3 py-[7px] bg-surface border border-line rounded-[6px] transition-colors focus-within:border-info focus-within:shadow-[0_0_0_3px_var(--info-soft)]">
          <span class="text-ink-3 shrink-0">${renderIcon("search", "sm")}</span>
          <!-- hx-preserve keeps this exact DOM node across swaps of the
               parent #terminology-table wrapper, so the user's focus, caret
               position, and selection survive the 300ms-debounced fetch.
               Without it every keystroke settle would replace the input
               element, dropping focus and making Ctrl+A select the page. -->
          <input type="text"
                 id="terminology-search-q"
                 hx-preserve="true"
                 autocomplete="off"
                 autocorrect="off"
                 autocapitalize="off"
                 spellcheck="false"
                 role="searchbox"
                 class="flex-1 min-w-0 bg-transparent border-none outline-none text-ink text-[13px]"
                 name="q"
                 value="${escapeHtml(f.q)}"
                 placeholder="Search local code, standard code, or display…"
                 hx-get="/terminology/partials/table"
                 hx-include="[name='fhir'],[name='sender']"
                 hx-trigger="keyup changed delay:300ms, search"
                 hx-target="#terminology-table"
                 hx-swap="outerHTML"
                 hx-push-url="true"/>
        </div>
        <input type="hidden" name="fhir" value="${escapeHtml(f.fhir.join(","))}"/>
        <input type="hidden" name="sender" value="${escapeHtml(f.sender.join(","))}"/>
        ${
          activeFilterCount > 0
            ? `<a href="/terminology?${clearQs}" hx-boost="true"
                 class="inline-flex items-center gap-1.5 no-underline bg-accent-soft text-accent-ink rounded"
                 style="font-size:11.5px; padding:3px 9px; border:1px solid rgba(198,83,42,0.2)">
                 ${renderIcon("x", "sm")}
                 Clear ${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"}
               </a>`
            : ""
        }
        <span class="font-mono text-[11.5px] text-ink-3 shrink-0">${rows.length} of ${total}</span>
      </div>

      <!-- Column headers with facet popovers -->
      <div class="grid bg-paper-2 border-b border-line text-[10.5px] font-semibold uppercase text-ink-3 relative"
           style="grid-template-columns: 150px 82px 1fr 180px 140px; padding: 10px 18px; letter-spacing:0.08em; gap:8px">
        <div>Local code</div>
        <div>System</div>
        <div>Standard</div>
        ${renderFacetHeader("FHIR target", "fhir", f.fhir.length, "right")}
        ${renderFacetHeader("Sender", "sender", f.sender.length, "left")}
      </div>

      <!-- Rows -->
      <div>${rowsHtml}</div>
    </div>
  `;
}

/** Column header with a facet-popover button. */
function renderFacetHeader(
  label: string,
  key: "fhir" | "sender",
  activeCount: number,
  align: "left" | "right",
): string {
  const isActive = activeCount > 0;
  // Two-popover coordination: clicking our own button must NOT stop propagation,
  // so the sibling popover's click.outside fires and auto-closes it. Our own
  // click.outside ignores inside-the-container clicks, so our popover stays
  // open. The popover body keeps click.stop so clicks inside it (search input,
  // checkbox labels) don't close our own popover.
  return `
    <div class="relative flex items-center gap-1.5 ${align === "right" ? "justify-between" : "justify-start"}"
         x-data="{ open: false }"
         x-on:click.outside="open = false"
         x-on:keyup.escape.window="open = false">
      <span>${escapeHtml(label)}</span>
      <button type="button"
              x-on:click="open = !open"
              class="inline-flex items-center gap-1 border-none rounded cursor-pointer ${isActive ? "bg-accent-soft text-accent-ink" : "bg-transparent text-ink-3"}"
              style="padding:3px 6px; font-family:inherit"
              title="Filter ${escapeHtml(label.toLowerCase())}">
        ${renderIcon("filter", "sm")}
        ${isActive ? `<span class="font-mono font-semibold" style="font-size:9.5px">${activeCount}</span>` : ""}
      </button>
      <div x-show="open"
           x-transition.opacity
           x-on:click.stop
           class="absolute bg-paper border border-line rounded-lg overflow-hidden shadow-xl z-50 ${align === "right" ? "right-0" : "left-0"}"
           style="top: calc(100% + 6px); min-width:280px; max-width:340px; text-transform:none; letter-spacing:normal; font-weight:400; color:var(--ink)"
           hx-get="/terminology/partials/facets/${key}"
           hx-trigger="intersect once"
           hx-swap="innerHTML">
        <div class="p-4 text-ink-3 text-[13px]">Loading…</div>
      </div>
    </div>
  `;
}

// ============================================================================
// Render — facet popover body
// ============================================================================

export function renderFacetPartial(
  key: "fhir" | "sender",
  entries: FacetEntry[],
  selected: string[],
  currentFilters: Filters,
): string {
  const render = (e: FacetEntry) => {
    const isOn = selected.includes(e.name);
    // Build the toggle URL by flipping this entry in+out of the `selected` array.
    const nextSelected = isOn
      ? selected.filter((x) => x !== e.name)
      : [...selected, e.name];
    const next = { ...currentFilters, [key === "fhir" ? "fhir" : "sender"]: nextSelected };
    const qs = buildTerminologyQs(next);
    const label =
      key === "fhir" ? renderFhirLabel(e.name, false) : `<span class="text-[12.5px] text-ink">${escapeHtml(e.name)}</span>`;
    return `
      <a href="/terminology?${qs}"
         hx-boost="true"
         class="flex items-center gap-2.5 cursor-pointer no-underline ${isOn ? "bg-paper-2" : ""}"
         style="padding: 7px 12px; user-select: none">
        <input type="checkbox" ${isOn ? "checked" : ""} style="accent-color: var(--accent); margin:0"/>
        <span class="flex-1 min-w-0 truncate">${label}</span>
        <span class="font-mono text-[10.5px] text-ink-3 shrink-0">${e.count}</span>
      </a>
    `;
  };

  const clearQs = buildTerminologyQs({
    ...currentFilters,
    [key === "fhir" ? "fhir" : "sender"]: [],
  });

  return `
    <div>
      <div class="border-b border-line flex items-center gap-2" style="padding: 10px 12px 8px">
        ${renderIcon("search", "sm")}
        <input type="search"
               x-data=""
               autocomplete="off"
               autocorrect="off"
               autocapitalize="off"
               spellcheck="false"
               x-on:input="$root.querySelectorAll('[data-facet-row]').forEach(el => { el.style.display = el.dataset.name.toLowerCase().includes($event.target.value.toLowerCase()) ? '' : 'none' })"
               placeholder="Search…"
               class="flex-1 min-w-0 bg-transparent border-none outline-none text-ink text-[12.5px]"/>
      </div>
      <div class="overflow-y-auto" style="max-height:280px; padding:4px 0">
        ${entries
          .map(
            (e) =>
              `<div data-facet-row data-name="${escapeHtml(e.name)}">${render(e)}</div>`,
          )
          .join("")}
        ${entries.length === 0 ? `<div class="text-center text-[12px] text-ink-3" style="padding:16px 12px">No matches.</div>` : ""}
      </div>
      ${
        selected.length > 0
          ? `<div class="border-t border-line bg-paper-2 flex items-center justify-between"
                  style="padding: 8px 12px">
               <span class="text-[11.5px] text-ink-3">${selected.length} selected</span>
               <a href="/terminology?${clearQs}" hx-boost="true"
                  class="text-[11.5px] text-accent-ink no-underline">Clear</a>
             </div>`
          : ""
      }
    </div>
  `;
}

function buildTerminologyQs(f: Filters): string {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.fhir.length) p.set("fhir", f.fhir.join(","));
  if (f.sender.length) p.set("sender", f.sender.join(","));
  return p.toString();
}

// ============================================================================
// Render — detail
// ============================================================================

function formatRelativeDate(iso: string | undefined): string {
  if (!iso) return "unknown";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return iso;
  const now = Date.now();
  const diff = now - t;
  const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MIN))} min ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} hr ago`;
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)} d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}

export function renderDetailPartial(row: TerminologyRow): string {
  const editUrl = `/terminology/partials/modal?mode=edit&conceptMapId=${encodeURIComponent(row.conceptMapId)}&code=${encodeURIComponent(row.localCode)}&localSystem=${encodeURIComponent(row.localSystem)}`;
  const deleteAction = `/api/concept-maps/${encodeURIComponent(row.conceptMapId)}/entries/${encodeURIComponent(row.localCode)}/delete`;

  return `
    <div id="terminology-detail" class="card" style="position:sticky; top:16px">
      <!-- FHIR target -->
      <div class="border-b border-line" style="padding: 18px 22px 14px; background: linear-gradient(180deg, var(--paper-2), transparent)">
        <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1.5">FHIR target</div>
        <div style="font-size:17px; letter-spacing:-0.01em">${renderFhirLabel(row.fhirField, true)}</div>
        <div class="flex items-center gap-2.5 mt-2.5">
          ${renderSystemChip(row.targetSystem)}
          <span class="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
            <span style="width:6px; height:6px; border-radius:50%; background:var(--accent)"></span>
            Active
          </span>
        </div>
      </div>

      <!-- The mapping itself -->
      <div style="padding: 22px 22px 18px">
        <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1">Local</div>
        <div class="font-mono font-semibold text-ink" style="font-size:22px; letter-spacing:-0.01em">${escapeHtml(row.localCode)}</div>
        <div class="text-[12.5px] text-ink-2 mt-0.5">${escapeHtml(row.localDisplay || row.localCode)}</div>

        <div class="flex items-center gap-2 text-ink-3" style="margin: 14px 0">
          <div class="flex-1 bg-line" style="height:1px"></div>
          <span class="text-[10px] tracking-[0.15em] uppercase">maps to</span>
          <div class="flex-1 bg-line" style="height:1px"></div>
        </div>

        <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1">Standard · ${escapeHtml(systemShortLabel(row.targetSystem))}</div>
        <div class="font-mono font-semibold text-accent-ink break-all" style="font-size:22px; letter-spacing:-0.01em">${escapeHtml(row.targetCode)}</div>
        <div class="text-[13px] text-ink-2 mt-1" style="line-height:1.4">${escapeHtml(row.targetDisplay)}</div>
      </div>

      <!-- Source (HL7 path = implementation detail). Show "Created" column
           only when the ConceptMap actually carries a timestamp —
           otherwise Source spans the row; avoids surfacing "unknown". -->
      <div class="border-t border-line bg-paper-2 grid gap-3.5"
           style="padding: 14px 22px; grid-template-columns: ${row.createdAt ? "1fr 1fr" : "1fr"}">
        <div>
          <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1">Source</div>
          <div class="text-[13px] text-ink">${escapeHtml(row.sender)}</div>
          <div class="font-mono text-[11px] text-ink-3 mt-0.5">HL7 ${escapeHtml(row.hl7Field)}</div>
        </div>
        ${
          row.createdAt
            ? `<div>
          <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1">Created</div>
          <div class="text-[13px] text-ink">${escapeHtml(formatRelativeDate(row.createdAt))}</div>
          <div class="text-[11px] text-ink-3 mt-0.5">from ConceptMap metadata</div>
        </div>`
            : ""
        }
      </div>

      <!-- Lineage — "Mapping created" row is shown only when createdAt is
           known, since an undated event is just noise. -->
      <div class="border-t border-line" style="padding: 16px 22px">
        <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-2.5">Lineage</div>
        <div class="flex flex-col gap-2.5 text-[12px]">
          ${
            row.createdAt
              ? `<div class="flex gap-2.5">
            <div class="rounded-full shrink-0" style="width:6px; height:6px; background:var(--accent); margin-top:6px"></div>
            <div class="flex-1">
              <div class="text-ink">Mapping created</div>
              <div class="text-ink-3 text-[11px] mt-px">${escapeHtml(new Date(row.createdAt).toISOString().slice(0, 10))}</div>
            </div>
          </div>`
              : ""
          }
          <div class="flex gap-2.5">
            <div class="rounded-full shrink-0" style="width:6px; height:6px; background:var(--${row.createdAt ? "ink-3" : "accent"}); margin-top:6px"></div>
            <div class="flex-1">
              <div class="text-ink-2">Applied to ${escapeHtml(row.sender)}</div>
              <div class="text-ink-3 text-[11px] mt-px">every ${escapeHtml(row.hl7Field)}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer: Edit + Delete (no Deprecate per plan). Delete opens an
           in-page modal instead of window.confirm — a browser prompt feels
           out of place in a designed tool and can't carry context. -->
      <div class="border-t border-line flex gap-2" style="padding: 14px 22px"
           x-data="{ confirmDelete: false }">
        <button type="button"
                class="btn btn-ghost flex-1 justify-center"
                x-on:click="confirmDelete = true">Delete</button>
        <button type="button"
                class="btn flex-1 justify-center"
                hx-get="${escapeHtml(editUrl)}"
                hx-target="#terminology-modal-container"
                hx-swap="innerHTML">Edit</button>

        <!-- Confirm modal: covers viewport with a dimmed backdrop + centered
             card. Cancel / Delete buttons inside. Only the Delete button
             fires the htmx POST — Cancel just flips confirmDelete=false. -->
        <div x-show="confirmDelete"
             x-transition.opacity
             x-cloak
             class="fixed inset-0 z-[500] grid place-items-center"
             style="background: rgba(15, 18, 25, 0.45)"
             x-on:mousedown.self="confirmDelete = false"
             x-on:keyup.escape.window="confirmDelete = false">
          <div class="bg-surface rounded-[8px] shadow-xl border border-line max-w-[420px] w-[90%]"
               style="padding: 20px 22px">
            <div class="text-[15px] font-semibold text-ink mb-1.5">Delete mapping?</div>
            <div class="text-[13px] text-ink-2 leading-[1.5] mb-4">
              <span class="font-mono text-accent-ink">${escapeHtml(row.localCode)}</span> → <span class="font-mono">${escapeHtml(row.targetCode)}</span>.
              This removes the mapping from the ConceptMap. Future messages using
              <span class="font-mono">${escapeHtml(row.localCode)}</span> will route to triage.
            </div>
            <div class="flex gap-2 justify-end">
              <button type="button"
                      class="btn btn-ghost px-3 py-1.5 text-[12.5px]"
                      x-on:click="confirmDelete = false">Cancel</button>
              <button type="button"
                      class="btn btn-primary px-3 py-1.5 text-[12.5px]"
                      style="background: var(--err); border-color: var(--err)"
                      hx-post="${escapeHtml(deleteAction)}"
                      hx-target="#terminology-table"
                      hx-swap="outerHTML"
                      hx-include="[name='q'],[name='fhir'],[name='sender']"
                      hx-vals="${escapeHtml(JSON.stringify({ localSystem: row.localSystem }))}"
                      x-on:htmx:after-request="confirmDelete = false">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderEmptyDetail(): string {
  return `
    <div id="terminology-detail" class="card" style="position:sticky; top:16px; min-height:360px">
      <div class="grid place-items-center text-ink-3 text-[13px] text-center" style="padding: 80px 32px">
        Pick a mapping from the table to see its FHIR target, source, and lineage.
      </div>
    </div>
  `;
}

// ============================================================================
// Page body
// ============================================================================

function renderPageBody(
  rows: TerminologyRow[],
  total: number,
  f: Filters,
  selected: TerminologyRow | null,
  kpis: TerminologyKpis,
): string {
  // Seed the Alpine selectedRowKey with the server-rendered selection (if
  // any) so the initial paint's highlight matches the pre-rendered detail
  // pane. Always HTML-escape the JSON so `"` inside (including the empty-
  // string case `""`) doesn't terminate the surrounding double-quoted
  // attribute and leave Alpine with a broken expression. Browsers decode
  // `&quot;` back to `"` before Alpine reads the attribute value.
  const initialKey = escapeHtml(
    JSON.stringify(selected ? rowKey(selected) : ""),
  );
  return `
    <div class="flex flex-col gap-5" x-data="{ selectedRowKey: ${initialKey} }">
      <!-- Hero -->
      <div class="flex items-end gap-4">
        <div class="flex-1">
          <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1.5">Terminology · canonical ledger</div>
          <h1 class="h1">Terminology map</h1>
          <div class="text-[13px] text-ink-2 mt-1">Every local code, bound to a FHIR field. Written once, replayed forever.</div>
        </div>
        <div class="flex gap-2">
          <button type="button"
                  class="btn btn-primary inline-flex items-center gap-1.5"
                  hx-get="/terminology/partials/modal?mode=add"
                  hx-target="#terminology-modal-container"
                  hx-swap="innerHTML">
            ${renderIcon("plus", "sm")} Add mapping
          </button>
        </div>
      </div>

      ${renderKpiStrip(kpis)}

      <!-- Table + Detail -->
      <div class="grid gap-4 items-start" style="grid-template-columns: 1fr 380px">
        ${renderTablePartial(rows, total, f, selected)}
        ${selected ? renderDetailPartial(selected) : renderEmptyDetail()}
      </div>

      <!-- Modal container: Edit/Add partials swap their HTML in here. -->
      <div id="terminology-modal-container"></div>
    </div>
  `;
}

// ============================================================================
// Handlers
// ============================================================================

export async function handleTerminologyPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filters = parseFilters(url);
  const selectedMap = url.searchParams.get("selectedMap");
  const selectedCode = url.searchParams.get("selectedCode");
  const selectedSys = url.searchParams.get("selectedSys");

  const [navData, rows] = await Promise.all([getNavData(), loadAllTerminologyRows()]);
  const filtered = applyFilters(rows, filters);

  // Resolve selection against the FULL row set (not filtered) so narrowing the
  // filters doesn't silently blank out the detail pane. If a user selected
  // GLUC and then clicks "Condition.code" facet, the detail stays populated.
  const selected =
    selectedMap && selectedCode
      ? rows.find(
          (r) =>
            r.conceptMapId === selectedMap &&
            r.localCode === selectedCode &&
            (!selectedSys || r.localSystem === selectedSys),
        ) ?? null
      : null;

  const kpis = await computeKpis(rows);

  return htmlResponse(
    renderShell({
      active: "terminology",
      title: "Terminology Map",
      navData,
      content: renderPageBody(filtered, rows.length, filters, selected, kpis),
    }),
  );
}

export async function handleTerminologyTablePartial(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const filters = parseFilters(url);
  const rows = await loadAllTerminologyRows();
  const filtered = applyFilters(rows, filters);
  return htmlResponse(renderTablePartial(filtered, rows.length, filters, null));
}

export async function handleTerminologyFhirFacet(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const filters = parseFilters(url);
  const rows = await loadAllTerminologyRows();
  const entries = buildFacet(rows, "fhirField");
  return htmlResponse(renderFacetPartial("fhir", entries, filters.fhir, filters));
}

export async function handleTerminologySenderFacet(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const filters = parseFilters(url);
  const rows = await loadAllTerminologyRows();
  const entries = buildFacet(rows, "sender");
  return htmlResponse(renderFacetPartial("sender", entries, filters.sender, filters));
}

export async function handleTerminologyDetailPartial(
  req: Request,
): Promise<Response> {
  const params = (req as Request & { params?: Record<string, string> }).params;
  const rawMap = params?.conceptMapId;
  const rawCode = params?.code;
  if (!rawMap || !rawCode) return new Response("Missing params", { status: 400 });
  let conceptMapId: string;
  let localCode: string;
  try {
    // decodeURIComponent throws on malformed percent-sequences
    // (e.g. "/detail/cm/%E0%A4%A"); surface as 400 instead of 500.
    conceptMapId = decodeURIComponent(rawMap);
    localCode = decodeURIComponent(rawCode);
  } catch {
    return new Response("Malformed URL", { status: 400 });
  }

  const url = new URL(req.url);
  const localSystem = url.searchParams.get("localSystem") ?? "";

  const rows = await loadAllTerminologyRows();
  const row = rows.find(
    (r) =>
      r.conceptMapId === conceptMapId &&
      r.localCode === localCode &&
      (!localSystem || r.localSystem === localSystem),
  );
  if (!row) return htmlResponse(renderEmptyDetail());
  return htmlResponse(renderDetailPartial(row));
}

// ============================================================================
// Add/Edit modal (Task 12)
// ============================================================================

/** What the Add dropdown needs to show for each ConceptMap. */
interface ModalTargetOption {
  conceptMapId: string;
  label: string;       // "ACME_LAB | HOSP → Observation.code"
  fhirField: string;   // "Observation.code"
}

async function loadModalTargetOptions(): Promise<ModalTargetOption[]> {
  const summaries = await listConceptMaps("all");
  return summaries.map((s) => {
    const type = MAPPING_TYPES[s.mappingType];
    const fhirField = targetLabel(type);
    return {
      conceptMapId: s.id,
      label: `${s.displayName} → ${fhirField}`,
      fhirField,
    };
  });
}

type ModalMode = "add" | "edit";

interface ModalProps {
  mode: ModalMode;
  /** For edit mode: the row being edited. */
  row?: TerminologyRow;
  /** For add mode: dropdown source. */
  options?: ModalTargetOption[];
}

/**
 * Render the Add/Edit modal.
 *
 * Contract:
 *  - Add mode: ConceptMap target picker at top, blank entry fields.
 *    hx-post holds a placeholder URL; an `htmx:configRequest` listener
 *    rewrites `event.detail.path` with the Alpine-chosen `picked.cmId`
 *    at submit time. (A reactive `:hx-post` won't do — htmx 2.x caches
 *    the path in its internal element data at form-processing time and
 *    ignores later attribute mutations.)
 *  - Edit mode: target picker hidden; hx-post URL is known at render time.
 *  - Alpine state (`picked`) carries the chosen target + all form fields.
 *  - Submit is disabled until the required-field gate passes.
 *  - Modal closes via the `concept-map-entry-saved` window event, dispatched
 *    by the API handler when `HX-Request: true` and the op succeeded.
 *  - Clicking the backdrop or pressing Escape closes the modal.
 */
export function renderModalPartial(props: ModalProps): string {
  const { mode, row, options = [] } = props;

  const initial = {
    cmId: row?.conceptMapId ?? "",
    localSystem: row?.localSystem ?? "",
    localCode: row?.localCode ?? "",
    localDisplay: row?.localDisplay ?? "",
    targetCode: row?.targetCode ?? "",
    targetDisplay: row?.targetDisplay ?? "",
  };

  const heading = mode === "edit" ? "Edit mapping" : "Add new mapping";
  const subtitle =
    mode === "edit"
      ? `Bound to <span class="font-mono text-accent-ink">${escapeHtml(row?.fhirField ?? "")}</span> — target is locked`
      : "One local code → one FHIR element, then every future message routes through it.";
  const submitLabel = mode === "edit" ? "Save changes" : "Create mapping";
  const gateAdd =
    "picked.cmId && picked.localSystem.trim() && picked.localCode.trim() && picked.targetCode.trim()";
  const gateEdit = "picked.targetCode.trim()";
  const gate = mode === "add" ? gateAdd : gateEdit;

  // Form hx-post. Edit is static (URL-safe cmId + code known at render time);
  // Add uses a placeholder URL that's rewritten at submit time by an
  // htmx:configRequest listener (see form below).
  const staticEditAction =
    mode === "edit" && row
      ? `/api/concept-maps/${encodeURIComponent(row.conceptMapId)}/entries/${encodeURIComponent(row.localCode)}`
      : "";

  const targetPicker =
    mode === "add"
      ? `
          <label class="flex flex-col gap-1.5">
            <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">FHIR target (ConceptMap)</span>
            <div class="relative">
              <select x-model="picked.cmId" class="inp w-full appearance-none pr-8 cursor-pointer">
                <option value="">Select a target ConceptMap…</option>
                ${options
                  .map(
                    (o) =>
                      `<option value="${escapeHtml(o.conceptMapId)}">${escapeHtml(o.label)}</option>`,
                  )
                  .join("")}
              </select>
              ${renderIcon("chev-down", "sm")}
            </div>
            ${
              options.length === 0
                ? `<span class="text-[11.5px] text-warn mt-1">No ConceptMaps exist yet. Seed one via the init bundle first.</span>`
                : ""
            }
          </label>
        `
      : "";

  // Attribute-safe JSON: escapeHtml now also escapes `'`, so single-quoted
  // `x-data='…'` wrapping user-controlled JSON is XSS-safe. Browsers decode
  // HTML entities before Alpine reads the attribute, so the JSON parses cleanly.
  const initialJson = escapeHtml(JSON.stringify(initial));

  return `
    <div id="terminology-modal"
         class="fixed inset-0 z-[200] grid place-items-center"
         style="background: rgba(20,16,12,0.45); backdrop-filter: blur(3px); padding: 20px"
         x-data='{ picked: ${initialJson}, errorMessage: "" }'
         x-on:keyup.escape.window="$root.remove()"
         x-on:mousedown.self="$root.remove()"
         x-on:concept-map-entry-saved.window="$root.remove()"
         x-on:concept-map-entry-error.window="errorMessage = $event.detail?.message || 'Save failed'">
      <div class="card flex flex-col overflow-hidden"
           style="width:min(620px, 100%); max-height:90vh; box-shadow:0 30px 80px rgba(20,20,22,0.25), 0 4px 12px rgba(20,20,22,0.10)">
        <!-- Header -->
        <div class="border-b border-line flex items-center gap-3 shrink-0"
             style="padding: 18px 22px">
          <div class="flex-1">
            <div class="font-semibold text-ink" style="font-size:16px; letter-spacing:-0.005em">${escapeHtml(heading)}</div>
            <div class="text-[12.5px] text-ink-3 mt-1">${subtitle}</div>
          </div>
          <button type="button"
                  aria-label="Close"
                  x-on:click="$root.remove()"
                  class="shrink-0 border-none bg-transparent cursor-pointer text-ink-3 rounded inline-flex"
                  style="padding: 6px">
            ${renderIcon("x", "sm")}
          </button>
        </div>

        <!-- Form — do NOT add a nested x-data here. An empty nested scope
             would re-root \$root for Cancel/Close buttons inside to the
             form element; hitting Cancel would remove() just the form and
             leave the modal header + card shell visible. -->
        <form ${
          mode === "edit"
            ? `hx-post="${escapeHtml(staticEditAction)}"`
            : `hx-post="/api/concept-maps/__pending__/entries"
               x-init="$el.addEventListener('htmx:configRequest', (e) => { if (e.target !== $el) return; e.detail.path = '/api/concept-maps/' + encodeURIComponent(picked.cmId) + '/entries' })"`
        }
              hx-target="#terminology-table"
              hx-swap="outerHTML"
              hx-include="this"
              class="flex flex-col overflow-hidden flex-1">
          ${mode === "edit" ? `<input type="hidden" name="localCode" x-bind:value="picked.localCode"/>` : ""}
          <!-- Filter-preservation inputs so the table re-renders with the user's current filters. -->
          <input type="hidden" name="q" x-init="$el.value = new URLSearchParams(window.location.search).get('q') || ''"/>
          <input type="hidden" name="fhir" x-init="$el.value = new URLSearchParams(window.location.search).get('fhir') || ''"/>
          <input type="hidden" name="sender" x-init="$el.value = new URLSearchParams(window.location.search).get('sender') || ''"/>

          <div class="overflow-y-auto flex flex-col gap-4"
               style="padding: 20px 22px; overflow-x: hidden">
            ${targetPicker}

            <div class="grid gap-3.5" style="grid-template-columns: 1fr 1fr">
              <label class="flex flex-col gap-1.5">
                <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">Local system</span>
                <input name="localSystem"
                       x-model="picked.localSystem"
                       ${mode === "edit" ? "readonly" : ""}
                       placeholder="e.g. LOCAL"
                       class="inp font-mono ${mode === "edit" ? "opacity-60 cursor-not-allowed" : ""}"/>
              </label>
              <label class="flex flex-col gap-1.5">
                <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">Local code</span>
                <input name="localCode"
                       x-model="picked.localCode"
                       ${mode === "edit" ? "readonly" : ""}
                       placeholder="e.g. GLUC"
                       class="inp font-mono ${mode === "edit" ? "opacity-60 cursor-not-allowed" : ""}"/>
              </label>
            </div>

            <label class="flex flex-col gap-1.5">
              <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">Local display (optional)</span>
              <input name="localDisplay"
                     x-model="picked.localDisplay"
                     placeholder="e.g. Glucose [Mass/volume]"
                     class="inp"/>
              <span class="text-[11.5px] text-ink-3 leading-snug">
                Human-readable name the sender uses for this code (FHIR ConceptMap <span class="font-mono">element.display</span>).
                Stored for documentation — incoming messages still route by <span class="font-mono">local system + code</span>.
              </span>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">Target code</span>
              <!-- Target-code field with live LOINC typeahead. Popover uses
                   position: fixed with Alpine-computed coordinates so it
                   escapes the modal's overflow-y-auto form body (otherwise
                   only the top 1–2 rows are visible before being clipped). -->
              <div class="relative"
                   x-data="{ popover: false, pos: null, reposition() { this.pos = $refs.tcInput?.getBoundingClientRect(); } }"
                   x-on:click.outside="popover = false"
                   x-on:keyup.escape.window="popover = false">
                <span class="absolute text-ink-3 pointer-events-none"
                      style="left: 10px; top: 50%; transform: translateY(-50%)">
                  ${renderIcon("search", "sm")}
                </span>
                <input x-ref="tcInput"
                       name="targetCode"
                       x-model="picked.targetCode"
                       placeholder="Search LOINC codes…"
                       autocomplete="off"
                       class="inp w-full"
                       style="padding-left: 32px"
                       x-on:input="reposition(); popover = $event.target.value.trim().length >= 1"
                       x-on:focus="reposition(); popover = $event.target.value.trim().length >= 1"
                       hx-get="/terminology/partials/loinc-suggest"
                       hx-trigger="input changed delay:200ms, focus"
                       hx-target="next .typeahead-pane"
                       hx-swap="innerHTML"/>
                <div class="typeahead-pane fixed z-[300] bg-paper border border-line rounded-[7px] shadow-lg max-h-[300px] overflow-y-auto"
                     x-show="popover"
                     x-transition.opacity
                     :style="pos ? 'top: ' + (pos.bottom + 4) + 'px; left: ' + pos.left + 'px; width: ' + pos.width + 'px' : 'display: none'"></div>
              </div>
            </label>

            <label class="flex flex-col gap-1.5">
              <span class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium">Target display (optional)</span>
              <input name="targetDisplay"
                     x-model="picked.targetDisplay"
                     placeholder="e.g. Glucose [Mass/volume] in Serum or Plasma"
                     class="inp"/>
            </label>
          </div>

          <!-- Error banner — surfaces htmx-branch concept-map-entry-error events.
               Hidden until an error fires; modal stays open on error so the
               user can correct the input. -->
          <div x-show="errorMessage"
               x-cloak
               class="border-t border-line bg-warn-soft flex items-center gap-2 text-[12.5px] text-warn-ink"
               style="padding: 10px 22px">
            ${renderIcon("alert", "sm")}
            <span x-text="errorMessage"></span>
          </div>

          <!-- Footer with gated submit -->
          <div class="border-t border-line bg-paper-2 flex items-center gap-3 shrink-0"
               style="padding: 14px 22px">
            <div class="flex-1 text-[12px] text-ink-3">
              ${mode === "edit" ? "Changes apply to new messages immediately; backlog replays on request." : "Applies to every future message & replays the backlog automatically."}
            </div>
            <button type="button"
                    x-on:click="$root.remove()"
                    class="btn btn-ghost py-1.5 px-3 text-[12px]">Cancel</button>
            <button type="submit"
                    x-on:click="errorMessage = ''"
                    class="btn btn-primary py-1.5 px-3 text-[12px] flex items-center gap-1.5"
                    x-bind:disabled="!(${gate})"
                    x-bind:class="(${gate}) ? '' : 'opacity-50 cursor-not-allowed'">
              ${renderIcon("check", "sm")} ${escapeHtml(submitLabel)}
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export async function handleTerminologyModalPartial(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "add") as ModalMode;
  if (mode !== "add" && mode !== "edit") {
    return new Response("Invalid mode", { status: 400 });
  }

  if (mode === "add") {
    const options = await loadModalTargetOptions();
    return htmlResponse(renderModalPartial({ mode, options }));
  }

  // Edit: find the row
  const rawCmId = url.searchParams.get("conceptMapId");
  const rawCode = url.searchParams.get("code");
  if (!rawCmId || !rawCode) {
    return new Response("Missing conceptMapId or code", { status: 400 });
  }
  let cmId: string;
  let code: string;
  try {
    cmId = decodeURIComponent(rawCmId);
    code = decodeURIComponent(rawCode);
  } catch {
    return new Response("Malformed URL", { status: 400 });
  }
  const localSystem = url.searchParams.get("localSystem") ?? "";
  const rows = await loadAllTerminologyRows();
  const row = rows.find(
    (r) =>
      r.conceptMapId === cmId &&
      r.localCode === code &&
      (!localSystem || r.localSystem === localSystem),
  );
  if (!row) return new Response("Mapping not found", { status: 404 });
  return htmlResponse(renderModalPartial({ mode: "edit", row }));
}

// ============================================================================
// htmx-aware CRUD re-render helpers (Task 12)
// ============================================================================

/**
 * After an htmx-submitted CRUD operation, re-render the terminology table
 * with the caller's current filters preserved. Filters come from the form
 * body (hidden inputs `q`/`fhir`/`sender`) if present, else from the Referer
 * URL, else empty (full table).
 */
export async function renderTableAfterCrud(
  filtersFromFormOrReferer: Filters,
): Promise<string> {
  const rows = await loadAllTerminologyRows();
  const filtered = applyFilters(rows, filtersFromFormOrReferer);
  return renderTablePartial(filtered, rows.length, filtersFromFormOrReferer, null);
}

// Use a structural type to dodge the `FormData` conflict between
// undici-types and the global lib. We only need `.get()`.
interface FormDataLike {
  get(name: string): unknown;
}

export function parseFiltersFromFormData(data: FormDataLike): Filters {
  const toStr = (v: unknown) =>
    typeof v === "string" ? v : v == null ? "" : String(v);
  return {
    q: toStr(data.get("q")).trim(),
    fhir: parseCsv(toStr(data.get("fhir"))),
    sender: parseCsv(toStr(data.get("sender"))),
  };
}

export function parseFiltersFromReferer(referer: string | null): Filters {
  if (!referer) return { q: "", fhir: [], sender: [] };
  try {
    return parseFilters(new URL(referer));
  } catch {
    return { q: "", fhir: [], sender: [] };
  }
}

// ============================================================================
// LOINC typeahead for the Add/Edit modal — HTML-returning variant that
// populates the modal's `picked.targetCode` + `picked.targetDisplay` state.
// Separate from the Unmapped Codes typeahead because the click handler must
// write to different Alpine state and different input name.
// ============================================================================

export async function handleTerminologyLoincTypeahead(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const query = (
    url.searchParams.get("targetCode") ??
    url.searchParams.get("display") ??
    ""
  ).trim();
  if (query.length < 1) {
    return new Response("", { headers: { "Content-Type": "text/html" } });
  }

  // Typeahead shows up to 6 rows.
  const results = await suggestCodes(query, undefined, 6);
  if (results.length === 0) {
    return new Response(
      `<div class="px-3.5 py-3 text-[12px] text-ink-3">No LOINC matches for "${escapeHtml(query)}".</div>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const rows = results
    .map((r) => {
      const codeExpr = escapeHtml(JSON.stringify(r.code));
      const displayExpr = escapeHtml(JSON.stringify(r.display));
      return `
        <button type='button'
                class='w-full text-left border-0 bg-transparent cursor-pointer hover:bg-paper-2 flex items-start gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0'
                x-on:click='picked.targetCode = ${codeExpr}; picked.targetDisplay = ${displayExpr}; popover = false'>
          <span class='font-mono text-[12.5px] font-semibold text-accent-ink shrink-0'>${escapeHtml(r.code)}</span>
          <span class='text-[12.5px] text-ink flex-1'>${escapeHtml(r.display)}</span>
          <span class='font-mono text-[11px] text-ink-3 shrink-0'>${r.score}%</span>
        </button>
      `;
    })
    .join("");
  return new Response(rows, { headers: { "Content-Type": "text/html" } });
}
