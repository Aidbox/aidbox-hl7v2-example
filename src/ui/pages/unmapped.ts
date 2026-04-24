/**
 * Unmapped Codes — triage inbox (Variant A from page-unmapped.jsx).
 *
 * Layout: hero + 2-column grid (300px queue card + 1fr editor card).
 * URL params: ?code=<localCode>&sender=<localSystem> — pre-selects an entry
 * when arriving from the "Map code" link on the Inbound detail pane.
 *
 * Queue partial: aggregates open Task?status=requested, groups by
 * localCode+sender+field, counts waiting messages.
 * Editor partial: shows the selected code's display, example HL7 snippet,
 * LOINC suggestions, and Save/Skip footer actions.
 *
 * Actions:
 *   Save   → POST /api/mapping/tasks/:id/resolve (existing htmx-unaware endpoint)
 *   Skip   → client-only Alpine — advances Alpine selectedIndex, no server call
 */

import type { Task } from "../../fhir/hl7-fhir-r4-core/Task";
import type { IncomingHL7v2Message } from "../../fhir/aidbox-hl7v2-custom";
import { aidboxFetch, type Bundle } from "../../aidbox";
import { escapeHtml } from "../../utils/html";
import { renderShell } from "../shell";
import { htmlResponse, getNavData } from "../shared";
import { renderIcon } from "../icons";
import { suggestCodes, type SuggestedCode } from "../../api/terminology-suggest";

// ============================================================================
// Types
// ============================================================================

export interface QueueEntry {
  /** First Task id in this group — used for the resolve POST. */
  taskId: string;
  localCode: string;
  sender: string;
  field: string;
  display: string;
  count: number;
}

// ============================================================================
// FHIR queries
// ============================================================================

function getTaskInput(task: Task, key: string): string {
  return task.input?.find((i) => i.type?.text === key)?.valueString ?? "";
}

export async function getQueueEntries(): Promise<QueueEntry[]> {
  // Task IDs are deterministic (map-{cmId}-{systemHash}-{codeHash}), so
  // many incoming messages with the same unmapped code land on the SAME
  // Task resource. Counting Tasks would report "1 msg" regardless of how
  // many messages are actually waiting. Fetch messages instead and count
  // them per (localCode, sender) pair.
  const [tasksBundle, msgsBundle] = await Promise.all([
    aidboxFetch<Bundle<Task>>(
      `/fhir/Task?status=requested&_count=500&_sort=_lastUpdated`,
    ),
    aidboxFetch<Bundle<IncomingHL7v2Message>>(
      `/fhir/IncomingHL7v2Message?status=code_mapping_error&_count=500`,
    ),
  ]);
  const tasks = (tasksBundle.entry ?? []).map((e) => e.resource);
  const messages = (msgsBundle.entry ?? []).map((e) => e.resource);

  // Count waiting messages per (localCode, sender). The message's
  // `sendingApplication` (MSH-3) is the same identifier the Task stores
  // as `input["Sending application"]`, so the keys line up with the
  // Task-side grouping below.
  const msgCounts = new Map<string, number>();
  for (const msg of messages) {
    const sender = msg.sendingApplication ?? "";
    for (const uc of msg.unmappedCodes ?? []) {
      if (!uc.localCode) {continue;}
      const key = `${uc.localCode}|${sender}`;
      msgCounts.set(key, (msgCounts.get(key) ?? 0) + 1);
    }
  }

  // Group Tasks by localCode + sender + field. Each (code, sender)
  // combination is represented by exactly one Task (dedupe-by-id on the
  // server side) — the count comes from the message-side lookup.
  const groups = new Map<string, QueueEntry>();
  for (const task of tasks) {
    const localCode = getTaskInput(task, "Local code");
    const sender = getTaskInput(task, "Sending application");
    const field = getTaskInput(task, "Field") || getTaskInput(task, "Local system");
    if (!localCode) {continue;}
    const key = `${localCode}|${sender}|${field}`;
    if (groups.has(key)) {continue;}
    const msgKey = `${localCode}|${sender}`;
    groups.set(key, {
      taskId: task.id ?? "",
      localCode,
      sender,
      field,
      display: getTaskInput(task, "Local display") || localCode,
      // Fall back to 1 so a Task with no linked message still shows in
      // the queue — better than silently hiding it.
      count: msgCounts.get(msgKey) ?? 1,
    });
  }

  return [...groups.values()];
}

// ============================================================================
// Queue partial
// ============================================================================

export function renderQueuePartial(
  entries: QueueEntry[],
  selectedCode: string | undefined,
  selectedSender: string | undefined,
): string {
  const totalMessages = entries.reduce((s, e) => s + e.count, 0);
  const rows = entries
    .map((e, i) => {
      const href = `/unmapped-codes?code=${encodeURIComponent(e.localCode)}&sender=${encodeURIComponent(e.sender)}`;
      const editorUrl = `/unmapped-codes/${encodeURIComponent(e.localCode)}/partials/editor?sender=${encodeURIComponent(e.sender)}`;
      // Attribute-safe JSON: same trick as renderSuggestionRow — escape the
      // JSON so `"` / `'` inside don't break the surrounding attribute.
      const codeExpr = escapeHtml(JSON.stringify(e.localCode));
      const senderExpr = escapeHtml(JSON.stringify(e.sender));
      // Alpine drives the highlight client-side so we don't re-fetch the
      // queue on every click. `selectedCode`/`selectedSender` live on the
      // page-wide `x-data` scope; `renderUnmappedBody` seeds them with the
      // server-rendered selection so the initial paint matches.
      return `
        <a href='${escapeHtml(href)}'
           hx-get='${escapeHtml(editorUrl)}'
           hx-target='#unmapped-editor'
           hx-swap='outerHTML'
           hx-push-url='true'
           x-on:click.prevent='selectedCode = ${codeExpr}; selectedSender = ${senderExpr}; $refs.editorSkeleton && (document.getElementById("unmapped-editor").outerHTML = $refs.editorSkeleton.innerHTML)'
           :class='selectedCode === ${codeExpr} && selectedSender === ${senderExpr} ? "bg-paper-2 border-l-accent" : "border-l-transparent"'
           class='block no-underline ${i > 0 ? "border-t border-line" : ""} border-l-2 cursor-pointer hover:bg-paper-2/60'
           style='padding: 14px 16px'>
          <div class='flex items-center gap-2 mb-1'>
            <span class='font-mono text-[12.5px] font-semibold'
                  :class='selectedCode === ${codeExpr} && selectedSender === ${senderExpr} ? "text-accent-ink" : "text-ink"'>${escapeHtml(e.localCode)}</span>
            <span class='ml-auto font-mono text-[11px] text-ink-3'>${e.count} msg</span>
          </div>
          <div class='text-[11.5px] text-ink-3'>${escapeHtml(e.sender)}${e.field ? ` · ${escapeHtml(e.field)}` : ""}</div>
        </a>
      `;
    })
    .join("");

  // The `selectedCode`/`selectedSender` fallback initializer — when the
  // queue partial is loaded in isolation (not inside the page body), its
  // `<a>` bindings still reference the outer scope. If the outer scope
  // doesn't exist (e.g. SSR of the queue alone), Alpine quietly fails on
  // the bindings — no crash, but highlighting won't work. Expected.
  void selectedCode;
  void selectedSender;

  const emptyState = `
    <div class="p-8 text-center text-ink-3 text-[13px]">
      No unmapped codes — all clear.
    </div>
  `;

  return `
    <div id="unmapped-queue" class="card flex flex-col overflow-hidden self-start"
         hx-get="/unmapped-codes/partials/queue"
         hx-trigger="every 15s"
         hx-swap="outerHTML">
      <div class="card-head">
        <span class="card-title">Queue</span>
        <span class="card-sub">${entries.length} codes · ${totalMessages} msg</span>
      </div>
      ${entries.length ? rows : emptyState}
    </div>
  `;
}

// ============================================================================
// Editor loading skeleton — swapped into `#unmapped-editor` on queue-link
// click so the user sees a structural placeholder during the ~0.8s Aidbox
// `$expand` call, not a frozen stale editor.
// ============================================================================

function renderEditorSkeleton(): string {
  const barCls = "bg-line/70 rounded animate-pulse";
  const row = `
    <div class="grid gap-3 items-center px-3.5 py-3 border rounded-[7px] bg-paper-2 border-line"
         style="grid-template-columns: 24px 110px 1fr 80px 120px">
      <div class="w-5 h-5 rounded-full ${barCls}"></div>
      <div class="h-3 ${barCls}" style="width: 70px"></div>
      <div class="h-3 ${barCls}" style="width: 80%"></div>
      <div class="h-4 ${barCls}" style="width: 50px"></div>
      <div class="h-3 ${barCls}"></div>
    </div>
  `;
  return `
    <div id="unmapped-editor" class="card flex flex-col self-start overflow-hidden">
      <!-- Header -->
      <div class="px-[26px] py-[22px] border-b border-line">
        <div class="h-2 ${barCls} mb-3" style="width: 220px"></div>
        <div class="flex items-center gap-4">
          <div class="flex-1 min-w-0">
            <div class="h-7 ${barCls} mb-2" style="width: 180px"></div>
            <div class="h-3 ${barCls}" style="width: 140px"></div>
          </div>
          <div class="text-right pl-5 border-l border-line shrink-0">
            <div class="h-7 ${barCls} mb-1" style="width: 40px; margin-left: auto"></div>
            <div class="h-2 ${barCls}" style="width: 120px"></div>
          </div>
        </div>
        <div class="mt-4 h-8 ${barCls}"></div>
      </div>

      <!-- Suggestions -->
      <div class="px-[26px] py-5">
        <div class="h-3 ${barCls} mb-3.5" style="width: 240px"></div>
        <div class="flex flex-col gap-2">
          ${row}
          ${row}
          ${row}
          <div class="h-11 ${barCls} mt-1 rounded-[7px]"></div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-[26px] py-4 border-t border-line flex items-center gap-3 bg-paper-2 rounded-b-lg">
        <div class="h-3 ${barCls} flex-1"></div>
        <div class="h-8 ${barCls} rounded" style="width: 60px"></div>
        <div class="h-8 ${barCls} rounded" style="width: 120px"></div>
      </div>
    </div>
  `;
}

// ============================================================================
// Editor partial
// ============================================================================

function renderScoreBar(score: number): string {
  const color =
    score >= 80
      ? "bg-accent"
      : score >= 60
      ? "bg-warn"
      : "bg-ink-3";
  return `
    <div class="flex items-center gap-2">
      <div class="w-[60px] h-[3px] bg-line rounded-sm overflow-hidden">
        <div class="${color} h-full" style="width:${score}%"></div>
      </div>
      <span class="font-mono text-[11.5px] text-ink-2 min-w-[28px] text-right">${score}%</span>
    </div>
  `;
}

function renderSuggestionRow(s: SuggestedCode): string {
  // Each row is a <label> around a radio input. Alpine `picked` drives
  // the visual state; the radio's name + value populate the form submit.
  //
  // XSS/parsing-safety: JSON.stringify(s.code) emits a double-quoted literal
  // (e.g. `"16913-6"`), which would prematurely terminate any surrounding
  // double-quoted HTML attribute. Using single-quoted attributes AND escaping
  // the JSON keeps both Alpine-bound expressions and human-readable text
  // attribute-safe (`'` → `&#39;`, `"` → `&quot;` — browsers decode before
  // Alpine/htmx read the attribute value).
  const codeExpr = escapeHtml(JSON.stringify(s.code));
  const displayExpr = escapeHtml(JSON.stringify(s.display));
  return `
    <label class='grid gap-3 items-center px-3.5 py-3 border rounded-[7px] cursor-pointer transition-colors'
           :class='picked.code === ${codeExpr} ? "bg-accent-soft border-accent" : "bg-paper-2 border-line"'
           style='grid-template-columns: 24px 110px 1fr 80px 120px'>
      <input type='radio' class='sr-only peer'
             x-on:change='picked = { code: ${codeExpr}, display: ${displayExpr} }'
             :checked='picked.code === ${codeExpr}'/>
      <div class='w-5 h-5 rounded-full grid place-items-center shrink-0'
           :class='picked.code === ${codeExpr} ? "border-[2px] border-accent" : "border-[1.5px] border-ink-3"'>
        <div class='w-[10px] h-[10px] rounded-full bg-accent' x-show='picked.code === ${codeExpr}'></div>
      </div>
      <span class='font-mono text-[12.5px] font-semibold text-accent-ink'>${escapeHtml(s.code)}</span>
      <span class='text-[13px] text-ink'>${escapeHtml(s.display)}</span>
      <span class='chip text-[10.5px] justify-self-start'>${escapeHtml(s.system)}</span>
      ${renderScoreBar(s.score)}
    </label>
  `;
}

export async function renderEditorPartial(
  entry: QueueEntry,
  suggestions: SuggestedCode[],
): Promise<string> {
  const suggestionsHtml =
    suggestions.length > 0
      ? suggestions.map((s) => renderSuggestionRow(s)).join("")
      : `<div class="p-5 bg-paper-2 border border-dashed border-line rounded-[7px] text-center text-ink-3 text-[13px]">
           No strong suggestions — search below to pick a code manually.
         </div>`;

  // Alpine-local state for the editor:
  //  - picked: {code, display} — single source of truth. Hidden form inputs
  //    mirror it, radio rows drive it, manual-search input replaces it.
  //  - Skip: reads the parent-scope `queue` array (encoded code/sender) and
  //    navigates to the next entry. No-op when already at the tail.
  // Escape the JSON so single quotes in display text (e.g. "Patient's …")
  // don't break the single-quoted x-data attribute.
  const initial = escapeHtml(
    JSON.stringify(
      suggestions[0]
        ? { code: suggestions[0].code, display: suggestions[0].display }
        : { code: "", display: "" },
    ),
  );

  // Alpine expression that's true when the current pick is NOT one of the
  // server-suggested LOINC rows — i.e., the user typed something manually or
  // clicked a typeahead result. Drives the manual-search row's "selected"
  // visual (orange dot + accent border) and unselects the suggestion rows.
  // `picked.code && picked.code !== 'sug1' && picked.code !== 'sug2' && ...`
  const suggestionCodesExpr = suggestions
    .map((s) => `picked.code !== ${JSON.stringify(s.code)}`)
    .join(" && ");
  const manualSelectedRaw = suggestionCodesExpr
    ? `picked.code && ${suggestionCodesExpr}`
    : `picked.code`;
  const manualSelected = escapeHtml(manualSelectedRaw);

  return `
    <div id="unmapped-editor" class="card flex flex-col self-start overflow-hidden"
         x-data='{ picked: ${initial} }'>
      <!-- Header -->
      <div class="px-[26px] py-[22px] border-b border-line">
        <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-2.5">
          Incoming code · ${escapeHtml(entry.sender)}${entry.field ? ` · ${escapeHtml(entry.field)}` : ""}
        </div>
        <div class="flex items-center gap-4">
          <div class="flex-1 min-w-0">
            <div class="font-mono text-[30px] font-semibold tracking-[-0.01em] text-accent-ink leading-none">
              ${escapeHtml(entry.localCode)}
            </div>
            <div class="text-[13px] text-ink-2 mt-1">${escapeHtml(entry.display)}</div>
          </div>
          <div class="text-right pl-5 border-l border-line shrink-0">
            <div class="font-mono text-[24px] font-semibold text-ink tracking-[-0.01em] tabular-nums leading-none">${entry.count}</div>
            <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mt-0.5">messages waiting</div>
          </div>
        </div>

        <!-- Example HL7 snippet -->
        <div class="mt-4 px-3.5 py-2.5 bg-paper-2 rounded border border-line font-mono text-[11.5px] text-ink-2 leading-[1.7] overflow-x-auto">
          <span class="text-ink-3">OBX|1|NM|</span><span class="text-warn bg-warn-soft px-[3px] rounded font-semibold">${escapeHtml(entry.localCode)}^${escapeHtml(entry.display)}^LOCAL</span><span class="text-ink-3">||—|units|—|||F</span>
        </div>
      </div>

      <!-- Suggestions -->
      <form id="resolve-form-${escapeHtml(entry.taskId)}"
            method="POST"
            action="/api/mapping/tasks/${encodeURIComponent(entry.taskId)}/resolve"
            class="contents"
            x-data="{ saving: false }"
            x-on:submit="saving = true">
        <input type="hidden" name="resolvedCode" :value="picked.code"/>
        <input type="hidden" name="resolvedDisplay" :value="picked.display"/>
        <!-- Preserved across validation failures so the editor stays open on
             the right entry instead of kicking the user back to the empty
             state. -->
        <input type="hidden" name="localCode" value="${escapeHtml(entry.localCode)}"/>
        <input type="hidden" name="localSender" value="${escapeHtml(entry.sender)}"/>

        <div class="px-[26px] py-5">
          <div class="flex items-center gap-2 mb-3.5">
            ${renderIcon("sparkle", "sm")}
            <span class="text-[12px] font-medium tracking-[0.06em] uppercase text-accent-ink">Suggested LOINC matches</span>
            <span class="text-[11.5px] text-ink-3">based on display text</span>
          </div>
          <div class="flex flex-col gap-2">
            ${suggestionsHtml}

            <!-- Manual search row with live LOINC typeahead. The popover
                 uses position:fixed with Alpine-computed coordinates so it
                 escapes the editor card's overflow-hidden (without that,
                 only the top 1–2 rows are visible before being clipped). -->
            <div class="relative"
                 x-data="{ popover: false, pos: null, reposition() { this.pos = $refs.loincInput?.getBoundingClientRect(); } }"
                 x-on:click.outside="popover = false"
                 x-on:keyup.escape.window="popover = false">
              <div class='flex items-center gap-3 px-3.5 py-3 bg-paper-2 border rounded-[7px] transition-colors'
                   :class='${manualSelected} ? "border-accent" : "border-dashed border-line"'>
                <div class='w-5 h-5 rounded-full grid place-items-center shrink-0'
                     :class='${manualSelected} ? "border-[2px] border-accent" : "border-[1.5px] border-ink-3"'>
                  <div class='w-[10px] h-[10px] rounded-full bg-accent' x-show='${manualSelected}'></div>
                </div>
                ${renderIcon("search", "sm")}
                <input x-ref="loincInput"
                       class="flex-1 bg-transparent border-none outline-none text-[13px]"
                       placeholder="Search LOINC codes…"
                       autocomplete="off"
                       name="loinc-query"
                       x-on:input="picked = { code: $event.target.value, display: '' }; reposition(); popover = $event.target.value.trim().length >= 1"
                       x-on:focus="reposition(); popover = $event.target.value.trim().length >= 1"
                       hx-get="/unmapped-codes/partials/loinc-suggest"
                       hx-trigger="input changed delay:200ms, focus"
                       hx-target="#loinc-typeahead"
                       hx-swap="innerHTML"/>
              </div>
              <div id="loinc-typeahead"
                   x-show="popover"
                   x-transition.opacity
                   class="fixed z-[300] bg-paper border border-line rounded-[7px] shadow-lg max-h-[300px] overflow-y-auto"
                   :style="pos ? 'top: ' + (pos.bottom + 4) + 'px; left: ' + pos.left + 'px; width: ' + pos.width + 'px' : 'display: none'"></div>
            </div>
          </div>
        </div>

        <!-- Footer: Save / Skip -->
        <div class="px-[26px] py-4 border-t border-line flex items-center gap-3 bg-paper-2 rounded-b-lg">
          <div class="flex-1 text-[12px] text-ink-3">
            Saving replays ${entry.count} queued message${entry.count !== 1 ? "s" : ""} and applies to future <span class="font-mono">${escapeHtml(entry.sender)}</span> traffic.
          </div>
          <!-- Skip: navigates to the next queue entry (client-only, no server call). -->
          <button type="button"
                  class="btn btn-ghost py-1.5 px-3 text-[12px]"
                  x-on:click="selectedIndex = Math.min(selectedIndex + 1, queue.length - 1); if (queue[selectedIndex]) window.location.href = '/unmapped-codes?code=' + queue[selectedIndex].code + '&sender=' + queue[selectedIndex].sender">Skip</button>
          <button type="submit"
                  class="btn btn-primary py-1.5 px-3 text-[12px] flex items-center gap-1.5"
                  :disabled="!picked.code || saving"
                  :class="(!picked.code || saving) ? 'opacity-70 cursor-not-allowed' : ''">
            <template x-if="saving">
              <span class="spinner w-3 h-3 border-[1.5px]"></span>
            </template>
            <template x-if="!saving">
              <span class="contents">${renderIcon("check", "sm")}</span>
            </template>
            <span x-text="saving ? 'Saving…' : 'Save mapping'"></span>
          </button>
        </div>
      </form>
    </div>
  `;
}

function renderEmptyEditor(): string {
  return `
    <div id="unmapped-editor" class="card flex flex-col self-start overflow-hidden min-h-[360px]">
      <div class="card-head">
        <span class="card-title">Select a code</span>
      </div>
      <div class="flex-1 grid place-items-center text-ink-3 text-[13px] py-16 px-8 text-center">
        Pick a code from the queue to see suggestions and map it.
      </div>
    </div>
  `;
}

// ============================================================================
// Page body
// ============================================================================

async function renderUnmappedBody(
  entries: QueueEntry[],
  selected: QueueEntry | undefined,
  suggestions: SuggestedCode[],
  selectedCode: string | undefined,
  selectedSender: string | undefined,
  errorMessage: string | undefined,
): Promise<string> {
  const totalMessages = entries.reduce((s, e) => s + e.count, 0);
  const eyebrow = entries.length
    ? `Triage · ${entries.length} code${entries.length !== 1 ? "s" : ""} holding ${totalMessages} message${totalMessages !== 1 ? "s" : ""}`
    : "Triage · all clear";

  const editor = selected
    ? await renderEditorPartial(selected, suggestions)
    : renderEmptyEditor();

  // Alpine state for the queue — selectedIndex tracks which entry is active
  // for the Skip button. The queue list links still use href for navigation,
  // so Alpine is only responsible for the Skip advancement UX.
  const queueJson = JSON.stringify(
    entries.map((e) => ({
      code: encodeURIComponent(e.localCode),
      sender: encodeURIComponent(e.sender),
    })),
  );
  const selectedIdx = selected
    ? entries.findIndex(
        (e) => e.localCode === selectedCode && e.sender === selectedSender,
      )
    : -1;

  // Escape JSON literals so `"` inside them don't break the surrounding
  // double-quoted x-data attribute.
  const selectedCodeInit = escapeHtml(JSON.stringify(selectedCode ?? ""));
  const selectedSenderInit = escapeHtml(JSON.stringify(selectedSender ?? ""));

  return `
    <div x-data="{
      queue: ${escapeHtml(queueJson)},
      selectedIndex: ${selectedIdx},
      selectedCode: ${selectedCodeInit},
      selectedSender: ${selectedSenderInit},
      get next() { return this.queue[this.selectedIndex + 1]; }
    }">
      ${
        errorMessage
          ? `
        <div class="mb-4 px-4 py-2.5 bg-warn-soft border border-warn rounded-[7px] flex items-center gap-2 text-[13px] text-warn-ink">
          ${renderIcon("alert", "sm")}
          <span class="flex-1">${escapeHtml(errorMessage)}</span>
        </div>`
          : ""
      }
      <div class="flex items-end gap-4 mb-4">
        <div class="flex-1">
          <div class="text-[10px] tracking-[0.1em] uppercase text-ink-3 font-medium mb-1.5">${escapeHtml(eyebrow)}</div>
          <h1 class="h1">Unmapped codes</h1>
          <div class="text-[13px] text-ink-2 mt-1">Map once, the backlog replays automatically. No lost messages, no manual fixups.</div>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-ghost py-1.5 px-3 text-[12.5px] opacity-50 cursor-not-allowed" disabled>
            ${renderIcon("sparkle", "sm")} Suggest with AI
            <span class="chip text-[10px] ml-1">coming soon</span>
          </button>
        </div>
      </div>

      <div class="grid gap-4" style="grid-template-columns: 300px 1fr; align-items: start">
        ${renderQueuePartial(entries, selectedCode, selectedSender)}
        ${editor}
      </div>

      <!-- Hidden skeleton source — queue-link clicks copy this markup into
           #unmapped-editor immediately (via $refs.editorSkeleton.innerHTML)
           so the user sees a structural placeholder while htmx fetches the
           real editor partial (blocked ~0.8s on Aidbox ValueSet/$expand). -->
      <template x-ref="editorSkeleton">${renderEditorSkeleton()}</template>
    </div>
  `;
}

// ============================================================================
// Handlers
// ============================================================================

export async function handleUnmappedCodesPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const selectedCode = url.searchParams.get("code") ?? undefined;
  const selectedSender = url.searchParams.get("sender") ?? undefined;
  const errorMessage = url.searchParams.get("error") ?? undefined;

  const [navData, entries] = await Promise.all([
    getNavData(),
    getQueueEntries(),
  ]);

  const selected = selectedCode
    ? entries.find(
        (e) =>
          e.localCode === selectedCode &&
          (!selectedSender || e.sender === selectedSender),
      )
    : undefined;

  const suggestions = selected
    ? await suggestCodes(selected.display, selected.field)
    : [];

  const content = await renderUnmappedBody(
    entries,
    selected,
    suggestions,
    selectedCode,
    selectedSender,
    errorMessage,
  );

  return htmlResponse(
    renderShell({
      active: "unmapped",
      title: "Unmapped Codes",
      navData,
      content,
    }),
  );
}

export async function handleUnmappedQueuePartial(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  const selectedCode = url.searchParams.get("code") ?? undefined;
  const selectedSender = url.searchParams.get("sender") ?? undefined;
  // Direct browser hits bypass the shell/Tailwind/Alpine — redirect to
  // the full page. htmx requests come through as-is.
  if (req.headers.get("HX-Request") !== "true") {
    const qs = new URLSearchParams();
    if (selectedCode) {qs.set("code", selectedCode);}
    if (selectedSender) {qs.set("sender", selectedSender);}
    const s = qs.toString();
    return new Response(null, {
      status: 302,
      headers: { Location: s ? `/unmapped-codes?${s}` : "/unmapped-codes" },
    });
  }
  const entries = await getQueueEntries();
  return htmlResponse(renderQueuePartial(entries, selectedCode, selectedSender));
}

export async function handleUnmappedEditorPartial(
  req: Request,
): Promise<Response> {
  const params = (req as Request & { params?: Record<string, string> }).params;
  const rawCode = params?.code;
  if (!rawCode) {return new Response("Missing code", { status: 400 });}
  const localCode = decodeURIComponent(rawCode);

  const url = new URL(req.url);
  const sender = url.searchParams.get("sender") ?? "";

  // Partials are meant to be swapped into the full page by htmx. Direct
  // browser hits produce raw, unstyled, mis-encoded HTML. Redirect them
  // to the full page with the right selection so the user lands somewhere
  // sensible instead of a broken-looking dump.
  if (req.headers.get("HX-Request") !== "true") {
    const qs = new URLSearchParams({ code: localCode });
    if (sender) {qs.set("sender", sender);}
    return new Response(null, {
      status: 302,
      headers: { Location: `/unmapped-codes?${qs.toString()}` },
    });
  }

  const entries = await getQueueEntries();
  const entry = entries.find(
    (e) => e.localCode === localCode && (!sender || e.sender === sender),
  );
  if (!entry)
    {return new Response(renderEmptyEditor(), {
      headers: { "Content-Type": "text/html" },
    });}

  const suggestions = await suggestCodes(entry.display, entry.field);
  const html = await renderEditorPartial(entry, suggestions);
  return new Response(html, { headers: { "Content-Type": "text/html" } });
}

// ============================================================================
// LOINC typeahead — HTML-returning variant of /api/terminology/suggest.
// Used by the manual-search input in the editor partial to drop a clickable
// suggestion list below the input field.
// ============================================================================

export async function handleLoincTypeaheadPartial(
  req: Request,
): Promise<Response> {
  const url = new URL(req.url);
  // htmx fires this from the `loinc-query` input when the user types; the
  // `picked.code` input-listener also fires, so the value is in the form
  // field `loinc-query`. We also accept `display` for symmetry with the
  // JSON endpoint.
  const query = (
    url.searchParams.get("loinc-query") ??
    url.searchParams.get("display") ??
    ""
  ).trim();
  if (query.length < 1) {
    return new Response("", { headers: { "Content-Type": "text/html" } });
  }

  // Typeahead shows up to 6 rows — the editor's pre-shown "Suggested LOINC
  // matches" list still uses the default 3.
  const results = await suggestCodes(query, undefined, 6);
  if (results.length === 0) {
    return new Response(
      `<div class="px-3.5 py-3 text-[12px] text-ink-3">No LOINC matches for "${escapeHtml(query)}".</div>`,
      { headers: { "Content-Type": "text/html" } },
    );
  }

  const rows = results
    .map((r) => {
      // Attribute-safe JSON for Alpine expressions (same trick as elsewhere).
      const codeExpr = escapeHtml(JSON.stringify(r.code));
      const displayExpr = escapeHtml(JSON.stringify(r.display));
      return `
        <button type='button'
                class='w-full text-left border-0 bg-transparent cursor-pointer hover:bg-paper-2 flex items-start gap-3 px-3.5 py-2.5 border-b border-line last:border-b-0'
                x-on:click='picked = { code: ${codeExpr}, display: ${displayExpr} }; popover = false; $root.querySelector("[name=loinc-query]").value = ${codeExpr}'>
          <span class='font-mono text-[12.5px] font-semibold text-accent-ink shrink-0'>${escapeHtml(r.code)}</span>
          <span class='text-[12.5px] text-ink flex-1'>${escapeHtml(r.display)}</span>
          <span class='font-mono text-[11px] text-ink-3 shrink-0'>${r.score}%</span>
        </button>
      `;
    })
    .join("");
  return new Response(rows, { headers: { "Content-Type": "text/html" } });
}
