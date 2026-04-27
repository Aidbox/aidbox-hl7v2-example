/**
 * Dashboard — demo conductor.
 *
 * Sections: hero → demo conductor card (4-step stepper + "Run demo now")
 * → stats strip (4 counts + worker health dots) → live ticker. No pause
 * toggle (plan explicitly drops it — single-user demo doesn't earn the
 * affordance); "Send single" / "Reset" are out of v1 too.
 *
 * Partials auto-refresh via htmx: stats every 10s, ticker every 5s.
 */

import { aidboxFetch, type Bundle } from "../../aidbox";
import type { IncomingHL7v2Message } from "../../fhir/aidbox-hl7v2-custom";
import { renderShell } from "../shell";
import { htmlResponse, getNavData } from "../shared";
import { renderIcon } from "../icons";
import { escapeHtml } from "../../utils/html";

// ============================================================================
// Types + constants
// ============================================================================

interface DashboardStats {
  receivedToday: number;
  needMapping: number;
  errors: number;
  avgLatencyMs: number | null;
}

interface TickerRow {
  id?: string;
  time: string;
  type: string;
  note: string;
  status: "ok" | "warn" | "err" | "pend";
}

const HARD_ERROR_STATUSES = [
  "parsing_error",
  "conversion_error",
  "sending_error",
] as const;

const DEFAULT_TICKER_LIMIT = 15;

// ============================================================================
// FHIR queries — small, per-request, no caching
// ============================================================================

function startOfTodayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

type ProcessedEntry = {
  resource?: IncomingHL7v2Message & { meta?: { lastUpdated?: string } };
};

// Samples over 60s are almost certainly "held in triage → mapping added →
// replayed" (MSH-7 date = original send; meta.lastUpdated = replay write).
// Those minute-scale spans are operator-response time, not live processing,
// and they completely dominated a naive mean. 60s is well beyond the async
// worker poll cadence (5s) so any healthy message is comfortably under it.
const LIVE_PATH_LATENCY_CAP_MS = 60_000;

/**
 * Average end-to-end time on the live path (sent → processed), in ms.
 * Samples above LIVE_PATH_LATENCY_CAP_MS are excluded — those messages
 * spent most of their "latency" waiting for an operator to map a code,
 * which is a separate signal already surfaced by the Need-mapping cell.
 * With the outlier filter in place a plain mean is fine (and easier to
 * read than a percentile).
 */
function computeAvgLatencyMs(entries: ProcessedEntry[]): number | null {
  const samples: number[] = [];
  for (const e of entries) {
    const r = e.resource;
    if (!r?.date || !r?.meta?.lastUpdated) {continue;}
    const sent = Date.parse(r.date);
    const done = Date.parse(r.meta.lastUpdated);
    if (!Number.isFinite(sent) || !Number.isFinite(done) || done < sent) {continue;}
    const dt = done - sent;
    if (dt > LIVE_PATH_LATENCY_CAP_MS) {continue;}
    samples.push(dt);
  }
  if (!samples.length) {return null;}
  return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const todayIso = startOfTodayIso();
  const errorOr = HARD_ERROR_STATUSES.join(",");

  const [received, need, errors, latest] = await Promise.all([
    aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?_lastUpdated=gt${todayIso}&_count=0&_total=accurate`,
    ),
    aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?status=code_mapping_error&_count=0&_total=accurate`,
    ),
    aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?status=${errorOr}&_count=0&_total=accurate`,
    ),
    aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?status=processed&_sort=-_lastUpdated&_count=100`,
    ),
  ]);

  return {
    receivedToday: received.total ?? 0,
    needMapping: need.total ?? 0,
    errors: errors.total ?? 0,
    avgLatencyMs: computeAvgLatencyMs(latest.entry ?? []),
  };
}

function toTickerStatus(
  status: IncomingHL7v2Message["status"],
): TickerRow["status"] {
  if (!status) {return "pend";}
  if (status === "processed" || status === "warning") {return "ok";}
  if (status === "code_mapping_error") {return "warn";}
  if (status.endsWith("_error")) {return "err";}
  return "pend";
}

function formatClock(iso: string | undefined): string {
  if (!iso) {return "--:--:--";}
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {return "--:--:--";}
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function buildNote(m: IncomingHL7v2Message): string {
  // The ticker chip on the row's right edge already encodes the outcome
  // (processed/needs mapping/error/pending). Echoing it in the middle
  // column is redundant — show the sender and let the chip carry state.
  return m.sendingApplication || "unknown sender";
}

export async function getTickerRows(limit: number): Promise<TickerRow[]> {
  const bundle = await aidboxFetch<
    Bundle<IncomingHL7v2Message & { meta?: { lastUpdated?: string } }>
  >(
    // Include `meta` in the projection explicitly so `meta.lastUpdated`
    // is guaranteed present — otherwise a stricter Aidbox profile could
    // suppress it and the ticker would fall back to message-send `date`,
    // which subtly misrepresents "when did we finish processing this".
    `/fhir/IncomingHL7v2Message?_sort=-_lastUpdated&_count=${Math.max(1, Math.min(100, limit))}&_elements=type,status,sendingApplication,date,meta`,
  );
  return (bundle.entry ?? []).map((e) => {
    const r = e.resource;
    return {
      id: r?.id,
      time: formatClock(r?.meta?.lastUpdated ?? r?.date),
      type: r?.type ?? "—",
      note: r ? buildNote(r) : "—",
      status: toTickerStatus(r?.status),
    };
  });
}

// ============================================================================
// Rendering
// ============================================================================

interface DemoStep {
  n: number;
  label: string;
  sub: string;
  accent?: boolean;
}

const DEMO_STEPS: readonly DemoStep[] = [
  // Idle-state accent marks step 1 so the user sees "this is where the
  // demo starts" on fresh page load (and after navigating away + back,
  // which re-renders the page and resets Alpine state to idle).
  { n: 1, label: "ADT^A01", sub: "admit patient", accent: true },
  { n: 2, label: "ORU^R01", sub: "known LOINC" },
  { n: 3, label: "VXU^V04", sub: "immunization" },
  { n: 4, label: "ORU (unknown)", sub: "triggers triage" },
];

function arrowSvg(): string {
  return `
    <svg width="22" height="12" class="shrink-0 text-ink-3 opacity-60" aria-hidden="true">
      <path d="M1 6 L20 6 M15 2 L20 6 L15 10" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function renderDemoStep(step: DemoStep, index: number): string {
  // Visual state is driven by Alpine's `currentIndex` at run time:
  //  - active (running && currentIndex === i): accent + pulse halo
  //  - idle & step.accent === true (currently step 1): accent — marks the
  //    start of the demo. Navigating away + back resets Alpine state to
  //    idle (`currentIndex: -1`, `done: false`), so step 1 is accented
  //    again on return.
  //  - otherwise: neutral (empty circle)
  const idleAccent = step.accent === true;
  const cls = `'bg-accent text-white border-accent pulse-accent': running && currentIndex === ${index},
               'bg-accent text-white border-accent': !running && ${idleAccent},
               'bg-surface text-ink border-line-2': !(running && currentIndex === ${index}) && !(!running && ${idleAccent})`;
  return `
    <div class="flex flex-col items-center gap-1.5 min-w-[100px]">
      <div class="w-[32px] h-[32px] rounded-full grid place-items-center font-mono text-[13px] font-semibold tabular-nums border transition-colors"
           :class="{ ${cls} }">${step.n}</div>
      <div class="font-mono text-[11.5px] text-ink">${escapeHtml(step.label)}</div>
      <div class="text-[10.5px] text-ink-3 text-center">${escapeHtml(step.sub)}</div>
    </div>
  `;
}

function renderHero(): string {
  return `
    <div>
      <div class="text-ink-3 text-[12.5px] font-medium uppercase tracking-[0.05em] mb-1.5">Pipeline · live</div>
      <h1 class="h1">Overview</h1>
    </div>
  `;
}

function renderDemoConductor(demoEnabled: boolean): string {
  if (!demoEnabled) {return "";}

  const steps = DEMO_STEPS.map((s, i) => {
    const arrow = i < DEMO_STEPS.length - 1 ? `<div class="flex-[0_1_24px]">${arrowSvg()}</div>` : "";
    return renderDemoStep(s, i) + arrow;
  }).join("");

  const button = `
    <button
      type="button"
      class="btn btn-primary text-[15px] py-3 px-5 justify-center"
      :disabled="running"
      x-on:click="run()"
    >
      <template x-if="!running">
        <span class="inline-flex items-center gap-1.5">${renderIcon("play", "sm")}<span x-text="done ? 'Demo sent ✓' : 'Run demo now'"></span></span>
      </template>
      <template x-if="running">
        <span class="inline-flex items-center gap-1.5"><span class="spinner"></span><span>Firing step <span x-text="Math.min(currentIndex + 1, ${DEMO_STEPS.length})"></span>/${DEMO_STEPS.length}…</span></span>
      </template>
    </button>
  `;

  // Alpine state: `currentIndex` drives both the stepper's active-state
  // highlight and the button's "Firing step N/4" label. Server fires
  // serially waiting for each previous message to exit `received`, so
  // total run time varies (typically 4–12s depending on processor poll
  // alignment). Client advances `currentIndex` every 2000ms — close
  // enough for a visual cue without wiring up SSE.
  const xData = `{
    running: false,
    done: false,
    currentIndex: -1,
    async run() {
      if (this.running) return;
      this.running = true;
      this.done = false;
      this.currentIndex = 0;
      try {
        const res = await fetch('/demo/run-scenario', { method: 'POST' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        for (let i = 1; i < ${DEMO_STEPS.length}; i++) {
          await new Promise(r => setTimeout(r, 2000));
          this.currentIndex = i;
        }
        this.done = true;
      } catch (err) {
        console.error('[demo]', err);
      } finally {
        this.running = false;
        this.currentIndex = -1;
        setTimeout(() => { this.done = false; }, 4000);
      }
    }
  }`;

  return `
    <div class="card" style="padding:26px 28px; background:linear-gradient(180deg, var(--surface) 0%, var(--paper-2) 100%)" x-data="${escapeHtml(xData)}">
      <div class="flex items-center gap-7">
        <div class="flex-1">
          <div class="text-[17px] font-semibold tracking-tight mb-1">Run scripted demo <span class="text-accent">· 4 steps</span></div>
          <div class="text-ink-3 text-[12.5px] mb-5">2s spacing between sends</div>
          <div class="flex items-center gap-0 flex-wrap">
            ${steps}
          </div>
        </div>
        <div class="flex flex-col gap-2 items-stretch min-w-[200px]">
          ${button}
          <div class="text-ink-3 text-[11px] text-center leading-snug">Sends 4 MLLP messages<br/>ending with an unmapped code.</div>
        </div>
      </div>
    </div>
  `;
}

function renderStatValue(
  label: string,
  value: string,
  sub: string,
  tone: "default" | "warn" | "err" = "default",
  last = false,
  href?: string,
  labelHint?: string,
): string {
  const border = last ? "" : "border-r border-line";
  const valueTone =
    tone === "warn"
      ? "text-warn"
      : tone === "err"
      ? "text-err"
      : "text-ink";
  const subEl = sub
    ? href
      ? `<a href="${href}" class="text-[11.5px] text-info hover:text-info-ink hover:underline font-mono">${escapeHtml(sub)}</a>`
      : `<div class="text-[11.5px] text-ink-3 font-mono">${escapeHtml(sub)}</div>`
    : "";
  const labelInner = labelHint
    ? `<span title="${escapeHtml(labelHint)}" class="cursor-help underline decoration-dotted decoration-ink-3 underline-offset-[3px]">${escapeHtml(label)}</span><span class="ml-1 text-ink-3" title="${escapeHtml(labelHint)}">ⓘ</span>`
    : escapeHtml(label);
  return `
    <div class="px-5 py-4 flex flex-col gap-1.5 min-w-[150px] whitespace-nowrap ${border}">
      <div class="text-ink-3 text-[11.5px] font-medium uppercase tracking-[0.05em]">${labelInner}</div>
      <div class="flex items-baseline gap-2">
        <div class="font-mono text-[22px] font-medium tracking-tight tabular-nums ${valueTone}">${escapeHtml(value)}</div>
        ${subEl}
      </div>
    </div>
  `;
}

function formatLatency(ms: number | null): { value: string; sub: string } {
  // Keep the sub short. "avg" names the exact metric — the full definition
  // (sent → processed, triage outliers stripped) lives on a hover tooltip
  // added next to the label in renderStatsPartial.
  const sub = "avg";
  if (ms === null) {return { value: "—", sub };}
  if (ms < 1000) {return { value: `${ms}ms`, sub };}
  return { value: `${(ms / 1000).toFixed(1)}s`, sub };
}

export function renderStatsPartial(stats: DashboardStats): string {
  const latency = formatLatency(stats.avgLatencyMs);
  const needTone = stats.needMapping > 0 ? "warn" : "default";
  const errTone = stats.errors > 0 ? "err" : "default";
  return `
    <div id="dashboard-stats" class="card clean-scroll flex items-stretch overflow-x-auto"
         hx-get="/dashboard/partials/stats"
         hx-trigger="every 10s"
         hx-swap="outerHTML">
      ${renderStatValue("Received · today", String(stats.receivedToday), "", "default")}
      ${renderStatValue(
        "Need mapping",
        String(stats.needMapping),
        stats.needMapping > 0 ? "go to triage" : "",
        needTone,
        false,
        stats.needMapping > 0 ? "/unmapped-codes" : undefined,
      )}
      ${renderStatValue(
        "Errors",
        String(stats.errors),
        stats.errors > 0 ? "see Inbound" : "",
        errTone,
        false,
        stats.errors > 0 ? "/incoming-messages?status=errors" : undefined,
      )}
      ${renderStatValue(
        "End-to-end time",
        latency.value,
        latency.sub,
        "default",
        true,
        undefined,
        "Average time from message sent (MSH-7) to processed in Aidbox, over the last 100 messages. Covers MLLP + parse + convert + FHIR submit. Messages held in triage (>60s end-to-end) are excluded so operator response time doesn't swamp the metric.",
      )}
    </div>
  `;
}

function statusChip(status: TickerRow["status"]): string {
  if (status === "ok") {return `<span class="chip chip-ok">processed</span>`;}
  if (status === "warn") {return `<span class="chip chip-warn">needs mapping</span>`;}
  if (status === "err") {return `<span class="chip chip-err">error</span>`;}
  return `<span class="chip">pending</span>`;
}

const TICKER_GRID_COLS = "80px 170px 90px minmax(160px, 1fr) 130px";

function renderTickerHeader(): string {
  return `
    <div class="grid gap-3 items-center px-5 py-2 text-[10.5px] text-ink-3 font-medium uppercase tracking-[0.06em] border-t border-line bg-paper-2" style="grid-template-columns: ${TICKER_GRID_COLS}">
      <span>Time</span>
      <span>Type</span>
      <span>Sender</span>
      <span></span>
      <span class="justify-self-end">Status</span>
    </div>
  `;
}

function renderTickerRow(row: TickerRow, first: boolean): string {
  const border = first ? "" : "border-t border-line";
  // Each row is a link to Inbound. When we have the resource id, deep-link
  // to its detail pane via `?selected=`; otherwise land on the Inbound list.
  const href = row.id
    ? `/incoming-messages?selected=${encodeURIComponent(row.id)}`
    : "/incoming-messages";
  return `
    <a href="${href}" class="grid gap-3 items-center px-5 py-2.5 text-[13px] ${border} no-underline text-ink hover:bg-paper-2 transition-colors" style="grid-template-columns: ${TICKER_GRID_COLS}">
      <span class="font-mono text-ink-3 text-[11.5px]">${escapeHtml(row.time)}</span>
      <span class="chip text-[10.5px] justify-self-start truncate max-w-full" title="${escapeHtml(row.type)}">${escapeHtml(row.type)}</span>
      <span class="font-mono text-[11.5px] text-ink-2 min-w-0 truncate" title="${escapeHtml(row.note)}">${escapeHtml(row.note)}</span>
      <span></span>
      <span class="justify-self-end">${statusChip(row.status)}</span>
    </a>
  `;
}

export function renderTickerPartial(rows: TickerRow[], limit: number): string {
  const body =
    rows.length === 0
      ? `<div class="px-5 py-6 text-center text-ink-3 text-[13px]">No messages yet. Click <span class="font-medium text-ink-2">Run demo now</span> to seed the ticker.</div>`
      : renderTickerHeader() + rows.map((r, i) => renderTickerRow(r, i === 0)).join("");
  return `
    <div id="dashboard-ticker" class="card"
         hx-get="/dashboard/partials/ticker?limit=${limit}"
         hx-trigger="every 2s"
         hx-swap="outerHTML">
      <div class="card-head">
        <span class="dot accent pulse" aria-label="live"></span>
        <span class="card-title">Live ticker</span>
        <span class="card-sub">auto-refresh · 2s</span>
      </div>
      ${body}
    </div>
  `;
}

function renderDashboardBody(
  stats: DashboardStats,
  ticker: TickerRow[],
  demoEnabled: boolean,
): string {
  return `
    ${renderHero()}
    ${renderDemoConductor(demoEnabled)}
    ${renderStatsPartial(stats)}
    ${renderTickerPartial(ticker, DEFAULT_TICKER_LIMIT)}
  `;
}

// ============================================================================
// Handlers
// ============================================================================

interface DashboardDeps {
  demoEnabled: boolean;
}

async function safeStats(): Promise<DashboardStats> {
  try {
    return await getDashboardStats();
  } catch (error) {
    console.error(
      "[dashboard] stats query failed:",
      error instanceof Error ? error.message : error,
    );
    return { receivedToday: 0, needMapping: 0, errors: 0, avgLatencyMs: null };
  }
}

async function safeTicker(limit: number): Promise<TickerRow[]> {
  try {
    return await getTickerRows(limit);
  } catch (error) {
    console.error(
      "[dashboard] ticker query failed:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function handleDashboardPage(
  _req: Request,
  deps: DashboardDeps,
): Promise<Response> {
  const [navData, stats, ticker] = await Promise.all([
    getNavData(),
    safeStats(),
    safeTicker(DEFAULT_TICKER_LIMIT),
  ]);
  return htmlResponse(
    renderShell({
      active: "dashboard",
      title: "Dashboard",
      content: renderDashboardBody(stats, ticker, deps.demoEnabled),
      navData,
    }),
  );
}

export async function handleDashboardStats(): Promise<Response> {
  const stats = await safeStats();
  return htmlResponse(renderStatsPartial(stats));
}

export async function handleDashboardTicker(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const raw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(100, raw) : DEFAULT_TICKER_LIMIT;
  const rows = await safeTicker(limit);
  return htmlResponse(renderTickerPartial(rows, limit));
}

