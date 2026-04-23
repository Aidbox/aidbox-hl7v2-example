# Plan: UI Design System Refactor

## Overview

Implement the new warm-paper design system across 5 pages — Dashboard, Inbound Messages, Simulate Sender, Unmapped Codes, Terminology Map — on top of the existing server-rendered Bun+TypeScript stack. Accounts and Outgoing Messages are out of scope and keep their current page bodies. Stack: htmx + Alpine.js (no React, no build step for UI). Design + scope: `ai/tickets/ui-refactoring/DESIGN_OVERVIEW.md`. Stack rationale: `ai/tickets/ui-refactoring/STACK_DECISION.md`. Supersedes tasks 3–7 of `ai/tickets/2026-04-22-demo-ready-ui-tier1.md` (tasks 1–2 are already done and stay).

## Architectural decisions (locked)

- **Unified sidebar, mixed page bodies.** One shell for the whole app; the sidebar gets a third "Outbound" group containing Accounts + Outgoing Messages with their existing Tailwind bodies unchanged.
- **ACK History uses Aidbox FHIR `_history`.** Each status transition in `src/v2-to-fhir/processor-service.ts` is already a full `PUT` → a new version in Aidbox's `*_history` table. Fetched lazily per-message only when the ACK tab is opened. No new resource, no processor changes. Docs: https://www.health-samurai.io/docs/aidbox/api/rest-api/history
- **Vendor htmx + Alpine outside `src/`.** Static assets live at project root under `public/vendor/`; served by a new static-file route.
- **Chrome DevTools MCP** is set up as part of this refactor so agents can visually verify pages against the design.

## Validation

- `bun test:local` — must pass after every task (~10s)
- `bun run typecheck` — must pass after every task
- Manual smoke: open `http://localhost:3000`, walk the page under the active task, confirm visual match against `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`

---

## Task 1: Vendor htmx + Alpine + static-file route

- [ ] Create `public/vendor/`; download pinned htmx 1.9.x and Alpine 3.14.x minified builds (vendored, not CDN)
- [ ] Register `GET /static/*` in `src/index.ts` serving from `public/` via `Bun.file()`; set Content-Type from extension; reject any path containing `..`
- [ ] Keep font delivery on Google Fonts CDN for v1 (`<link>` to `fonts.googleapis.com/css2?family=Inter...&family=Fraunces...&family=JetBrains+Mono`) — matches current Tailwind-CDN pattern; self-hosting is a follow-up
- [ ] Add unit test in `test/unit/ui/static-route.test.ts`: real-file hit returns 200 + correct Content-Type; missing file returns 404; `../` traversal returns 400/404
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 2: Design system stylesheet + icon sprite

- [ ] Create `src/ui/design-system.ts` exporting `DESIGN_SYSTEM_CSS` (string) with warm-paper CSS variables on `:root` and component classes (`.app`, `.sidebar`, `.nav-item`, `.page`, `.h1`, `.h2`, `.sub`, `.eyebrow`, `.card`, `.card-head`, `.card-pad`, `.btn`, `.btn-primary`, `.btn-ghost`, `.chip` + tone modifiers, `.dot` + tone modifiers, `.inp`, `.mono`, `.muted`, `.clean-scroll`, `.spinner`) — copied verbatim from `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html:10-144`
- [ ] Create `src/ui/icons.ts` exporting `ICON_SPRITE_SVG` (string) with the full `<svg><defs>` block (ids `i-home, i-inbox, i-send, i-alert, i-map, i-users, i-out, i-search, i-settings, i-chev-down, i-chev-right, i-plus, i-check, i-x, i-filter, i-clock, i-arrow-right, i-play, i-sparkle`) and a `renderIcon(name, extraClass?)` helper returning `<svg class="i ..."><use href="#i-{name}"/></svg>`
- [ ] Unit test `test/unit/ui/design-system.test.ts`: CSS string contains `--paper`, `--accent #C6532A`, and the `.card` class; `renderIcon('home')` returns expected SVG markup
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 3: App shell + unified sidebar (no page bodies changed)

- [ ] Create `src/ui/shell.ts` exporting `renderShell({ active, title, content, topActions? })` — doctype + head (Google Fonts, Tailwind CDN kept, `DESIGN_SYSTEM_CSS` inline, `/static/vendor/htmx.min.js`, `/static/vendor/alpine.min.js`, existing health-check IIFE from `shared-layout.ts`) + body with sidebar, main column, and `ICON_SPRITE_SVG` at the bottom
- [ ] Sidebar groups: **Workspace** (Dashboard `/`, Inbound Messages `/incoming-messages`, Simulate Sender `/simulate-sender`), **Terminology** (Unmapped Codes `/unmapped-codes`, Terminology Map `/terminology`), **Outbound** (Accounts `/accounts`, Outgoing Messages `/outgoing-messages`); active-state styling + count badges on Inbound (total) and Unmapped (`hot` accent when non-zero)
- [ ] Extend `getNavData()` in `src/ui/shared.ts`: add `incomingTotal` (FHIR `IncomingHL7v2Message?_count=0`) alongside existing `pendingTaskCount`
- [ ] Env pill at sidebar footer from `ENV` env var (green `dev`, amber `staging|test`, red `prod`) and mono line with `MLLP_HOST:MLLP_PORT` (defaults `localhost:2575`)
- [ ] Migrate every existing page handler in `src/ui/pages/*.ts` (accounts, messages for both halves, mapping-tasks, code-mappings, mllp-client) to call `renderShell` instead of `renderLayout`; delete `renderLayout` and the legacy top-nav helpers from `src/ui/shared-layout.ts` in the same commit (no gradual migration — project isn't in production)
- [ ] Rename routes in `src/index.ts` to their final names, pointing at the existing handlers (bodies rebuilt in Tasks 5, 9, 10): `/mllp-client` → `/simulate-sender`, `/mapping/tasks` → `/unmapped-codes`, `/mapping/table` → `/terminology`
- [ ] Update any UI unit test that asserts nav markup (`test/unit/ui/*`) for the new sidebar structure
- [ ] Run validation — must pass; manually confirm every existing page renders with the new sidebar and old body intact
- [ ] Stop for user review before next task

## Task 4: UI architecture docs + Chrome DevTools MCP

- [ ] Create `docs/developer-guide/ui-architecture.md` covering: when to use htmx vs Alpine vs plain form POST, partial-endpoint naming (`/{page}/partials/{name}`), design-system class vocabulary, icon sprite usage, shell composition, when server-renders the selected-detail on `?selected=` full page loads
- [ ] Create `docs/developer-guide/ui-design-tokens.md` — palette (warm-paper), typography (Inter/Fraunces/JetBrains Mono), spacing scale, component class inventory with tiny HTML samples. Direct reference for agents so they don't re-read the design HTML every time
- [ ] Create `docs/developer-guide/how-to/add-ui-page.md` — recipe: page handler, route registration, sidebar entry, partial pattern, tests
- [ ] Add Chrome DevTools MCP server to `.claude/settings.json` (or `.claude/settings.local.json`) per its install docs; MCP approval is user-initiated — surface the exact approval steps in `docs/developer-guide/ui-architecture.md`
- [ ] Add one-line pointer in `CLAUDE.md` under "Code Style" → "UI conventions: see `docs/developer-guide/ui-architecture.md`"
- [ ] Run validation — must pass (typecheck is the only mechanical check for docs; no broken imports)
- [ ] Stop for user review before next task

## Task 5: Simulate Sender page

- [ ] Create `src/ui/pages/simulate-sender.ts` with `handleSimulateSenderPage` — composer layout per `DESIGN_OVERVIEW.md § Simulate Sender`
- [ ] Lift `MESSAGE_TYPES` array (ORU^R01, ORU^R01-unknown, ADT^A01, ADT^A08, VXU^V04, ORM^O01, BAR^P01) from `ai/tickets/ui-refactoring/hl7v2-v2/project/design/page-simulate.jsx:8-56` verbatim into the new page module; export it so Task 6 can import the templates for the scripted demo
- [ ] Alpine: editor component (`x-data` with `raw`, `typeId`, `sender`, computed `parsed`/`hasUnknown`), overlay `<pre>` + transparent textarea (accent segment names, warn highlight on unmapped tokens), SendCard state machine (`idle → sending → sent | held`) with elapsed tick
- [ ] Replace the handler wired to `/simulate-sender` (renamed in Task 3) with `handleSimulateSenderPage`; register `POST /simulate-sender/send` reusing `sendMLLPMessage()` from `src/ui/pages/mllp-client.ts` and returning JSON `{status: "sent"|"held", ack: string, messageId: string}` (ACK `AA` → sent, `AE` → held)
- [ ] Unit tests: happy-path send, held-for-mapping send (unknown code in body), MLLP-unreachable error path
- [ ] Run validation — must pass; manual smoke in browser (pick ORU unknown template, send, see "Held for mapping" banner)
- [ ] Stop for user review before next task

## Task 6: Dashboard page + scripted demo runner

- [ ] Create `src/api/demo-scenario.ts` exporting `runDemoScenario()` that fires four MLLP messages (ADT^A01, ORU^R01 known, VXU^V04, ORU^R01 unknown) with 2s spacing, fire-and-forget (`.catch(console.error)`); import the templates from `src/ui/pages/simulate-sender.ts`'s exported `MESSAGE_TYPES` (shipped in Task 5)
- [ ] Register routes in `src/index.ts`: `POST /demo/run-scenario` (guarded by `DEMO_MODE !== "off"`, returns 202), `GET /dashboard/partials/stats`, `GET /dashboard/partials/ticker?limit=15`
- [ ] Create `src/ui/pages/dashboard.ts` with `handleDashboardPage`: hero + demo-conductor card + stats strip + live ticker per `DESIGN_OVERVIEW.md § Dashboard`; htmx `hx-trigger="every 10s"` on stats, `every 5s` on ticker; Alpine `x-data` for ticker-pause toggle
- [ ] Stats partial computes: received-today, need-mapping (`status=code_mapping_error`), errors (multi-status OR), avg-latency (from `meta.lastUpdated - date` over last 100 processed messages in-memory), worker health (new `getWorkerHealth()` in `src/workers.ts` exposing the current handle's running state)
- [ ] Move `GET /` in `src/index.ts` from `handleAccountsPage` to `handleDashboardPage`; `/accounts` stays reachable
- [ ] Unit tests for `demo-scenario.ts` (fires 4 sends in order) and both partials (happy path + empty state)
- [ ] Run validation — must pass; manual smoke: click "Run demo now", confirm 4 rows appear in the ticker within ~10s
- [ ] Stop for user review before next task

## Task 7: Inbound Messages — list pane + type chips

- [ ] Create `src/ui/pages/inbound.ts` with `handleInboundMessagesPage` — hero, type-chip row, two-pane layout (list card + empty-state detail card); supports `?type=&status=&batch=&selected=` URL params; when `selected` is set, pre-render detail pane server-side into `#detail`
- [ ] Register routes: `GET /incoming-messages/partials/list?type=&status=&batch=&selected=`, `GET /incoming-messages/partials/type-chips`
- [ ] Type-chips partial: scans `_count=500` recent `IncomingHL7v2Message`, groups by `type` in-memory, renders chip row with counts; `errors` pseudo-chip aggregates the 4 error statuses
- [ ] Htmx wiring: row click → `hx-get="/incoming-messages/:id/partials/detail" hx-target="#detail" hx-push-url="?selected=:id"`; list auto-refresh `every 5s` guarded off by Alpine when a row is selected (no mid-edit stomp)
- [ ] Swap `GET /incoming-messages` from `handleIncomingMessagesPage` (in `src/ui/pages/messages.ts`) to the new `handleInboundMessagesPage`; keep the Outgoing half of `messages.ts` intact
- [ ] Update/rewrite the affected incoming-messages unit test for the new markup; add one for the type-chips partial
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 8: Inbound Messages — detail pane + 4 tabs (with Aidbox history)

- [ ] **OPEN: runtime-verify** Aidbox `_history` is enabled on the dev instance before starting this task. Run `curl -u root:Vbro4upIT1 "http://localhost:8080/fhir/IncomingHL7v2Message/{any-id}/_history?_count=5"` and confirm response is a `Bundle` with `entry[]` each carrying `meta.versionId` and distinct `meta.lastUpdated`. If not, investigate the `BOX_*` toggle via Aidbox support docs before proceeding.
- [ ] Register `GET /incoming-messages/:id/partials/detail` (shell + default `structured` tab) and `GET /incoming-messages/:id/partials/detail/:tab` (tab-specific fragment)
- [ ] Implement 4 tab handlers: `structured` (re-parse stored `message` via `@atomic-ehr/hl7v2`, render segment mini-cards; warn-border when segment contains the problem code), `raw` (reuse `highlightHL7WithDataTooltip` from `shared-layout.ts`), `fhir` (pretty-print `entries` array; warn highlight on unresolved codings with inline `// ⚠ no LOINC mapping` comment), `acks` (fetch `/fhir/IncomingHL7v2Message/:id/_history?_count=50`, render timeline rows with `meta.lastUpdated` + status transition + error if present; infer step chip heuristically from status delta)
- [ ] Detail header actions: "Replay" posts to existing `POST /mark-for-retry/:id`; "Map code" (visible only when `unmappedCodes?.length`) links to `/unmapped-codes?code={localCode}&sender={sender}`
- [ ] Tab switching: `hx-get` on tab button with `hx-target="#detail-body"`; ACK tab is the only one that triggers an extra Aidbox call (lazy per user intent, per architectural decision)
- [ ] Unit tests for each of the 4 tab handlers (happy path + an error state per tab); integration test in `test/integration/ui/` hitting `_history` against the test Aidbox for a message that's transitioned at least twice
- [ ] Run validation — must pass; manual smoke walks all 4 tabs on a real message
- [ ] Stop for user review before next task

## Task 9: Unmapped Codes rebuild + suggestion scoring

- [ ] Create `src/api/terminology-suggest.ts` exporting `suggestCodes(display, field)`: wraps existing `searchLoincCodes()` from `src/code-mapping/terminology-api.ts`; scores each result (exact-substring in display → 100; Jaro-Winkler similarity → 40–95; short-display bonus); returns top 3 `{code, display, score, system}`
- [ ] Register `GET /api/terminology/suggest?display=&field=` route
- [ ] Create `src/ui/pages/unmapped.ts` with `handleUnmappedCodesPage` — queue + editor split per `DESIGN_OVERVIEW.md § Unmapped Codes`; supports `?code=&sender=` pre-selection (matches the "Map code" link from Inbound)
- [ ] Replace the handler wired to `/unmapped-codes` (renamed in Task 3) with `handleUnmappedCodesPage`; register `GET /unmapped-codes/partials/queue` and `GET /unmapped-codes/:code/partials/editor?sender=`; editor partial calls `suggestCodes()` for the pre-selected code's display
- [ ] Queue partial: aggregates open `Task?status=requested` (existing query), regroups by `localCode + sender + field`, counts messages via `Task.input`; returns queue list HTML
- [ ] Wire actions: Save → existing `POST /api/mapping/tasks/:id/resolve`; Skip → new `POST /unmapped-codes/:code/skip?sender=` that wraps `POST /defer/:id` per matching task; "Skip all" and "Suggest with AI" buttons rendered `disabled` with "coming soon" chip (explicit v1 non-goals)
- [ ] Unit tests: scoring helper (known-high + known-low cases), queue partial (groups correctly), editor partial (pre-selection loads suggestions)
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 10: Terminology Map — table + filter popovers + detail

- [ ] Create `src/ui/pages/terminology.ts` with `handleTerminologyPage` — KPI strip + two-pane (table + detail); supports `?q=&fhir=&sender=` URL params (multi-valued `fhir` and `sender`)
- [ ] Replace the handler wired to `/terminology` (renamed in Task 3) with `handleTerminologyPage`; register partials: `GET /terminology/partials/table?q=&fhir=&sender=` (server-filtered rows), `GET /terminology/partials/facets/fhir`, `GET /terminology/partials/facets/sender`, `GET /terminology/partials/detail/:conceptMapId/:code`
- [ ] Facet partials: in-memory scan of all ConceptMap entries (reuse existing `listConceptMaps` + group), return `{name, count}[]` rendered as searchable multi-select list; Alpine popover (`x-on:click.outside`, `x-on:keyup.escape`) wraps them
- [ ] Detail partial: FHIR target (split typography), local/std mapping, source panel, minimal lineage (creation time from `ConceptMap/_history?_count=1` lazy), Deprecate/Edit footer
- [ ] KPI strip values: total mappings (sum across all maps), coverage % (processed / processed + code_mapping_error over last 30d), messages/window (`_count=0` for 30d), needs-review (literal `0` for v1 until deprecation-tracking ticket lands)
- [ ] **OPEN:** usage count per entry (design shows `usage:4820`) — not tracked today. Render `—` for v1 with a note in `docs/developer-guide/ui-design-tokens.md`; separate ticket for denormalized counters
- [ ] Unit tests for the 4 new partials; integration test hitting facet counts against the test Aidbox
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 11: Terminology Map — Add/Edit modal

- [ ] Register `GET /terminology/partials/modal?mode=add` and `GET /terminology/partials/modal?mode=edit&conceptMapId=&code=` — returns modal body HTML (FHIR target select add-only, local system + code two-column, local display, search-to-map input with icon); edit mode locks target field
- [ ] Alpine wiring: backdrop + ESC + ✕ close; submit disabled until `localCode` + `targetCode` filled
- [ ] Submit routes to existing `POST /api/concept-maps/:id/entries` (add) or `POST /api/concept-maps/:id/entries/:code` (edit); on success: close modal, htmx-swap the table partial to refresh the row
- [ ] Deprecate button in detail footer: `POST /api/concept-maps/:id/entries/:code/delete` (existing); confirm via native `confirm()` for v1 — follow-up to replace with inline Alpine confirm popover
- [ ] Unit tests: modal renders in both modes, submit path succeeds, disabled-when-empty gate works
- [ ] Run validation — must pass; manual smoke: Add a mapping via the modal, confirm it appears in the table and is retrievable via `GET /fhir/ConceptMap`
- [ ] Stop for user review before next task

## Task 12: Cleanup

- [ ] Delete dead code: old `renderIncomingMessagesPage` body in `src/ui/pages/messages.ts` (keep Outgoing), legacy HTML rendering in `src/ui/pages/mapping-tasks.ts` and `src/ui/pages/code-mappings.ts`, page-render functions in `src/ui/pages/mllp-client.ts` (keep `sendMLLPMessage` + `sendMLLPTest` primitives)
- [ ] Sanity-check: every sidebar link returns 200 (old URLs `/mllp-client`, `/mapping/tasks`, `/mapping/table` were renamed in Task 3, not redirected — no 302s to verify)
- [ ] Close `ai/tickets/2026-04-22-demo-ready-ui-tier1.md`: mark tasks 3–7 as "superseded by `2026-04-23-ui-design-system-refactor.md`", leave tasks 1–2 as-is (already done)
- [ ] End-to-end manual demo walkthrough: `/` Dashboard → Run demo → ticker shows 4 → click warn row → Inbound detail walks Structured/Raw/FHIR/ACK tabs → Map code → Unmapped pre-selected → accept top suggestion → message reprocesses → Terminology Map shows the new entry → sidebar links all still work including Accounts/Outgoing
- [ ] Final `bun test:all`
- [ ] Stop for user review — confirm demo walkthrough feels right

---

## Non-goals for v1 (tracked for follow-up)

- Per-mapping usage counts / last-seen timestamps (show `—` for now)
- Deprecate-with-review lifecycle for ConceptMap entries
- LLM-backed "Suggest with AI" batch action
- Sender-health page (deferred per `DESIGN_OVERVIEW.md` late-stage suggestions)
- Per-type `SearchParameter` on `IncomingHL7v2Message` (in-memory grouping is enough for demo scale)
- Custom `ProcessingLog` resource (Aidbox `_history` substitutes)
- Self-hosted fonts (Google Fonts CDN for v1)
- Re-skinning Accounts/Outgoing Messages to the warm-paper palette
