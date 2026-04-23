# HL7v2 UI Refactoring — Design Overview

Source bundle: `hl7v2-v2/` (exported from Claude Design, 2026-04-22).
Primary design file: `hl7v2-v2/project/HL7v2 Design.html` — pulls in the `design/*.jsx` modules (React 18 + Babel standalone, inline styles + CSS variables).
Wireframes precursor: `hl7v2-v2/project/HL7v2 Wireframes.html` (+ `screens-*.jsx`). Not the final design; kept for history.
User intent transcript: `hl7v2-v2/chats/chat1.md`.
Reference snapshot of today's UI (for comparison only, not design): `hl7v2-v2/project/uploads/ui/`.

## Scope decided in the transcript

Five screens are in scope; **Accounts** and **Outgoing Messages** were explicitly cut:

| Screen               | Variant kept  | Source                          |
| -------------------- | ------------- | ------------------------------- |
| Dashboard            | **B** (Demo control) | `design/page-dashboard.jsx` (`DashboardB`) |
| Inbound Messages     | **A** (List + detail) | `design/page-inbound.jsx` (`InboundA`) |
| Simulate Sender      | **A** (Composer) | `design/page-simulate.jsx` (`SimulateA`) |
| Unmapped Codes       | **A** (triage inbox) | `design/page-unmapped.jsx` (`UnmappedA`) |
| Terminology Map      | **A** (canonical ledger) | `design/page-terminology.jsx` (`TerminologyA`) |

The global topbar (breadcrumbs + ⌘K search + settings + avatar) was removed in the last iteration — page `<h1>`s carry the title. Variant A/B switcher at bottom-right is design-review scaffolding, not production.

## Design system / visual language

- **Palette — "warm paper"**, defined as CSS variables on `:root` in `HL7v2 Design.html`:
  - Surface: `--paper #FBF8F2` (canvas), `--paper-2 #F5F0E6`, `--surface #FFFFFF`
  - Text: `--ink` / `--ink-2` / `--ink-3` (primary / body / muted)
  - Lines: `--line`, `--line-2`
  - Accent: `--accent #C6532A` (terracotta), `--accent-soft`, `--accent-ink`
  - Semantic: `--ok` green, `--warn` amber-gold, `--err` deep red, each with a `-soft` variant
- **Typography**: Inter (sans), Fraunces (serif — headings, stat numbers, italic voice moments), JetBrains Mono (codes, timestamps, HL7 segments).
- **Components** (all inline-styled; no Tailwind in the prototype):
  - `.card` / `.card-head` / `.card-pad` — bordered white surfaces
  - `.btn` / `.btn-primary` / `.btn-ghost`
  - `.chip` / `.chip-accent` / `.chip-ok` / `.chip-warn` / `.chip-err` — status badges
  - `.dot` + modifiers — colored status dots
  - `.inp` — inputs; focus ring uses `--accent-soft`
  - `.eyebrow` — small uppercase label above section titles
  - `Icon` (`design/shell.jsx`) — inline SVG sprite at bottom of the HTML, names: `home, inbox, send, alert, map, users, out, search, settings, chev-down, chev-right, plus, check, x, filter, clock, arrow-right, play, sparkle`
- **Layout**: 252px sticky sidebar + main column, `max-width: 1760px`, generous padding (`32–56px`), 8–22px gaps.
- **Voice**: occasional serif italic quotes ("HL7v2 isn't broken — it's just lived-in"; "written once, replayed forever"). Used as empty-state / pull-quote flavor, not chrome.

## Global navigation (`design/shell.jsx`)

Left sidebar, two groups:

- **Workspace**: Dashboard, Inbound Messages (shows count, e.g. `12.8k`), Simulate Sender
- **Terminology**: Unmapped Codes (count with `hot` accent color when non-zero, e.g. `17`), Terminology Map
- Footer: environment pill — green dot + `staging` + `mllp://10.1.4.22:2575`.
- Active item: white background + left accent bar.
- Brand: `h7` mark + "Inbound" + subtitle "HL7v2 · FHIR bridge".

Counts in the nav are hints the backend should supply (inbound total + unmapped-codes pending count).

## Common patterns to carry across pages

- **Page shell**: `<div className="page">` with 18–22px gap between sections.
- **Page hero**: `eyebrow` + `h1` (serif) + `sub`, optional right-side action buttons.
- **Card + card-head** for any grouped content. Card-sub on the right of card-head is mono/muted — used for timestamps, counts.
- **List with detail**: 2-column grid (`minmax(560px, 1fr) 1fr` or `1fr 380px`), left is a table/list, right is a sticky detail panel. Selected row gets `--paper-2` bg and left `--accent` bar.
- **Status colors**: `ok` (green), `warn` (amber, actionable), `err` (red, hard fail), `pend` (neutral gray).
- **Modal**: fixed overlay with backdrop blur, centered card (max ~620px), ESC + click-outside close, sticky header + scrollable body + sticky footer. See `TerminologyA` form.
- **Filter popovers in column headers**: searchable multi-select with checkboxes + per-option counts. Active count badge on the filter icon. See `ColHeader` / `FilterList` in `page-terminology.jsx`.
- **Live indicator**: `dot ok` with soft shadow + "auto-refresh · 5s" mono label.

---

## Pages

### 1. Dashboard — `DashboardB` (Demo conductor)

**Purpose:** give a prospect a one-click demo story in under a minute; secondarily, show pipeline health.

**Sections:**
1. Hero: eyebrow "Staging · scripted demo", h1 "Demo control", one-liner subtitle.
2. **Demo conductor card**: 4-step horizontal stepper (ADT^A01 → ORU^R01 → VXU^V04 → ORU unknown) with primary "Run demo now" button + "Send single" / "Reset" ghost buttons. Right-side stack.
3. **Stats strip** (horizontal card, compact): Received today (+delta), Need mapping (warn), Errors (err), Avg latency, Workers health (dots for ORU processor / BAR builder / BAR sender + "polling every 5s").
4. **Live ticker card**: streaming feed of `{time, type, sender → note, status}` rows, auto-refresh 5s with pause. `dot accent` header dot.

**Actions:**
- Run demo scenario (fire-and-forget a pre-recorded sequence via MLLP).
- Run single message.
- Reset demo (clear last run / stats).
- Pause ticker auto-refresh.
- Filter ticker (button in original design A — might not be needed in B).

**Modals:** none.

**Backend needs (ideas, not spec):**
- Current counts: received today, need mapping, errors, avg latency, last-run timestamp.
- Worker status per service (ORU/ADT/VXU processor, BAR builder, BAR sender).
- Recent message stream (last ~N rows or SSE/poll) with type, sender, subject/note, status.
- Scripted demo trigger endpoint + list of scenarios (payloads can live in backend rather than frontend).

### 2. Inbound Messages — `InboundA`

**Purpose:** the integration engineer's daily view — browse live traffic, drill into any message to see raw/structured/FHIR/ACK history.

**Sections:**
1. Hero: "Inbound messages · 142 received today · 3 in triage · 2 errors" + filter/time-range/search buttons.
2. **Type filter chips** row: All, ORU^R01, ADT^A01, ADT^A08, ADT^A03, ORM^O01, BAR^P01, VXU^V04, errors — each with a count, active chip uses `chip-accent`.
3. **Two-pane split**:
   - **Left — message list (card)**: columns `dot · time · type · sender · message · status-chip`, with a pinned header row and selectable rows (click → update detail pane).
   - **Right — detail pane (card)**: header with status chip + type chip + message-id mono + "Replay" / "Map code" actions, then h2 `sender → receiver`, explanatory line, then **4 tabs**:
     - `Structured` — collapsed segment list (MSH, PID, PV1, ORC, OBR, OBX), each a mini-card with colored left-border if the segment is the problem; warning chip in segment header; field table `120px label | 1fr mono value` with unmapped values highlighted in warn.
     - `Raw HL7` — mono pre-block, segment names colored in accent, problem tokens highlighted in warn-soft.
     - `FHIR resources` — rendered bundle JSON with warn highlight on unresolved codings + inline `// ⚠ no LOINC mapping` comment.
     - `ACK history` — processing timeline rows `time · step chip · description · dot`.

**Actions per message:**
- Select row to view detail
- Replay
- Map code (jump to Unmapped Codes with the code pre-filled)
- Search / filter (by type, time range, sender, status)
- Type-chip filter pills (quick filter by type)

**Modals:** none (detail is inline, tabbed).

**Backend needs:**
- Paginated / streaming list of messages with `time, type, sender, subject, status, id`.
- Aggregated counts per type + global counters (today, triage, errors) for hero + chips.
- Message detail: parsed segments, raw HL7 text, converted FHIR bundle, ACK/processing log with timestamps.
- Replay endpoint (re-run pipeline on this message).
- Cross-link to a code-mapping creation flow ("Map code" action).

### 3. Simulate Sender — `SimulateA`

**Purpose:** developer/demo tool to fire HL7v2 at the MLLP listener from the UI.

**Sections:**
1. Hero: eyebrow "Compose & send · staging MLLP · 10.1.4.22:2575", h1, subtitle.
2. **Two-pane split**:
   - **Left — editor card**: header with `message.hl7` filename, version chip, segment count chip, resolvable-codes chip (ok / warn if `UNKNOWN_TEST` or `LOCAL` detected). Body: mono textarea with line numbers, segment names highlighted accent, unmapped-code tokens highlighted warn. Footer: mono char/segment counter.
   - **Right — controls stack**:
     - **Quick tweaks card**: Sender select (MSH-3) — ACME_LAB / StMarys / CHILDRENS / billing; Message type select with description line (turns warn if type contains unmapped codes).
     - **SendCard** (stateful): `idle | sending | sent | held | error` states.
       - idle: big "Send" + "then jump to Inbound" hint
       - sending: spinner button + step checklist (Open MLLP connection / Transmit / Await ACK) with elapsed timer
       - sent: green "Sent · accepted" banner with ACK MSA|AA + message id; "Send another" + "jump to Inbound"
       - held: amber "Held for mapping" banner with ACK MSA|AE + explanation + "see it in Unmapped codes" link

**Prebuilt message templates** (`MESSAGE_TYPES` in source): ORU^R01 (clean), ORU^R01-unknown, ADT^A01, ADT^A08, VXU^V04, ORM^O01, BAR^P01. Each has a `build(sender)` generator.

**Actions:**
- Pick message type / sender (regenerates body)
- Edit raw HL7 freely
- Send to MLLP listener
- Jump to Inbound / Unmapped after send

**Modals:** none.

**Backend needs:**
- MLLP send endpoint (takes raw HL7v2 string, returns ACK + message id).
- Optional: list of known senders from config (for the dropdown).
- Optional: saved scenarios / templates stored server-side (currently hardcoded client-side).

### 4. Unmapped Codes — `UnmappedA` (Triage inbox)

**Purpose:** "inbox zero" for code mappings — every unresolved code blocks messages; map once → backlog replays.

**Sections:**
1. Hero: eyebrow "Triage · 3 codes holding 17 messages", h1, subtitle "Map once, the backlog replays automatically." Right actions: "Skip all" ghost, "Suggest with AI" sparkle.
2. **Two-pane split**:
   - **Left — Queue card** (300px): rows per unmapped code = `code (mono) · msg count · sender · field`, selected gets paper-2 bg + accent left bar.
   - **Right — Editor card**:
     - Header: eyebrow with "Incoming code · {sender} · {field} · first seen {time}". Big mono accent code + serif italic display text. Right side: large serif count "12" + "messages waiting".
     - Context panel: paper-2 box showing a sample OBX line with the code highlighted in warn + "example from MSG… · N minutes ago".
     - **Suggested matches** section with sparkle eyebrow: list of `{code, display, score%, system}` rows, top row pre-selected with accent radio. Confidence bar (>80% accent, >60% warn, else muted).
     - **Manual search** dashed box with search input "Search LOINC, SNOMED, or browse all…".
     - **Empty state** when no suggestions: dashed placeholder message.
     - Footer bar (paper-2): "Saving replays {N} queued messages and applies to future {sender} traffic." + Skip / Save mapping actions.

**Actions:**
- Select code from queue
- Accept a suggestion (radio)
- Search/browse all code systems manually
- Save mapping → triggers backlog replay
- Skip (move to end of queue)
- Skip all
- Suggest with AI (batch-suggest across the queue)

**Variant B** (`UnmappedB`, bulk table) exists in source if the triage inbox UX doesn't fit — has Accept / Edit per row and "Auto-map all" button.

**Modals:** none in A (editor is a pane). B has no modals either.

**Backend needs:**
- Pending unmapped codes list: `{local_system, code, display, sender, field, fhir_target_hint, first_seen, message_count}`.
- Per-code suggestions: fuzzy match against target code system (LOINC / SNOMED / RxNorm / etc), scored.
- Code-system search endpoint (for manual pick).
- Save mapping endpoint → creates ConceptMap entry + triggers replay of queued `IncomingHL7v2Message`s in `code_mapping_error` state.
- Skip / defer endpoints (already exist: `/defer/:id`, `/mark-for-retry/:id`).
- Optional: LLM-backed "Suggest with AI" batch endpoint.

### 5. Terminology Map — `TerminologyA`

**Purpose:** canonical ledger of every established local-code → FHIR-field mapping. Organized by **FHIR target** (Observation.code, Condition.code, Encounter.class, …), not by HL7 field.

**Sections:**
1. Hero: "Terminology map · Every local code, bound to a FHIR field — written once, replayed forever." + "Add mapping" primary.
2. **KPI strip** (4 cells, no divider): Total mappings, Coverage %, Messages/mo, Needs review.
3. **Two-pane split**:
   - **Left — Table card** (1fr):
     - Toolbar row (paper-2): search input, "Clear N filters" pill (when filters active), `{filtered} of {total}` counter.
     - Column header with **per-column filter popovers** on `FHIR target` and `Sender` (searchable multi-select with counts; ESC / click-outside close; active-count badge on the filter icon).
     - Rows: `Local code (mono + display) · System chip (colored by code system) · Standard code (mono + std display) · FHIR target (split typography Resource.path) · Sender`. Deprecated mappings rendered strikethrough + muted.
     - Empty state: "No mappings match your filters."
   - **Right — Detail card** (380px, sticky):
     - "FHIR target" section (gradient paper-2 header): split-weight label + system chip + status dot (active / deprecated / needs review).
     - **Mapping body**: "Local" eyebrow + mono value + serif italic display → "maps to" divider → "Standard · {system}" eyebrow + mono accent value + std display.
     - **Source** panel (paper-2, 2-col): Source (sender + HL7 field) | Last seen (relative time).
     - **Lineage timeline**: Mapping created (who/when) → Backlog replayed (N messages) → Applied to {sender} since. Bullet dots.
     - Footer actions: Deprecate | Edit.

**System color coding** (mono pill):
- LOINC green, SNOMED sky, ICD-10 orange, RxNorm violet, v3 Interp amber, v3 Act pink, FHIR slate.

**Modals:**
- **Add / Edit mapping modal** (`formMode: 'add' | 'edit'`):
  - Header: title + subtitle + close ✕. In edit mode, FHIR target is locked and noted as such.
  - Body: FHIR target select (add-only), Local system + Local code (two-column), Local display, Search-to-Map input (prefixed with search icon + target system label, e.g. "Search LOINC codes…").
  - Footer: muted caption ("Applies to every future message & replays the backlog automatically.") + Cancel / Create-or-Save primary. Submit disabled unless code + target filled.
  - Dismiss: ESC, backdrop click, ✕, Cancel.

**Actions:**
- Search / filter table (free-text + FHIR-target multi-select + sender multi-select)
- Select row → detail panel updates
- Add mapping (modal)
- Edit mapping (modal, target locked)
- Deprecate mapping
- Clear filters

**Backend needs:**
- All ConceptMap entries with `{localSystem, localCode, localDisplay, stdCode, stdDisplay, stdSystem, fhirField, sender, hl7Field, usageCount, lastSeen, mappedBy, mappedOn, status}`.
- Aggregates for KPI strip: total count, coverage %, messages routed per month, review-needed count.
- Facet counts for filter popovers (per FHIR target, per sender).
- Search endpoint for target system codes inside the modal (LOINC/SNOMED/etc).
- Lineage per mapping: created event, backlog-replay event(s), usage timeline.
- Deprecate mapping endpoint.
- Create / update mapping endpoints.

---

## User's late-stage design suggestions (from chat, for future consideration)

The designer ended the session with unsolicited critique worth remembering:

**Trim:**
- Unmapped Codes could be a saved filter on Inbound instead of a separate page.
- Simulate Sender is developer-tool-ish; maybe a global ⌘T modal rather than primary nav.
- Remove Variant A/B switcher in production.

**Add:**
- Onboarding / "first 60 seconds" flow (currently Dashboard assumes senders are wired).
- First-class **message replay with diff** (before-mapping vs after-mapping FHIR output).
- Mapping confidence in the unmapped queue (already partially present as the suggestion scores).
- Environment promotion flow (staging → prod mapping review).
- **Sender health page** — last message, volume trend, ACK/NAK ratio, unmapped-code rate.

**Open question:** primary persona is integration engineer (flow / replay / ACK / health) vs data steward (terminology / review / audit). Designer's lean: engineer first, steward later.

---

## Integration notes for this codebase

Reference only — not a plan.

- Current UI lives in `src/ui/pages/*.ts` (server-rendered HTML strings). Design is pure client-side React. Matching the visual output will likely mean either:
  - (a) keeping server-rendered HTML and porting styles + structure by hand (closer to today's stack), or
  - (b) moving to a client-rendered React app, which is a bigger shift.
- The screens map reasonably onto existing routes:
  - `/` → Dashboard (currently Accounts)
  - `/messages` (or similar) → Inbound Messages
  - MLLP client page → Simulate Sender
  - Mapping Tasks → Unmapped Codes (A/triage version)
  - Code Mappings → Terminology Map
- Accounts + Outgoing Messages: **explicitly out of scope** for this refactor. They continue to exist in the current UI; design simply doesn't cover them.
- Polling / live-refresh assumptions in the design already match the in-process pollers described in `CLAUDE.md` (5s default). No new backend concepts introduced by the design except possibly a scripted-demo endpoint and a "replay backlog on mapping save" hook (code_mapping_error auto-requeue is already there).
