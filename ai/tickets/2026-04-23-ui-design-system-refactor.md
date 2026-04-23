# Plan: UI Design System Refactor

## Overview

Implement the new warm-paper design system across 5 pages — Dashboard, Inbound Messages, Simulate Sender, Unmapped Codes, Terminology Map — on top of the existing server-rendered Bun+TypeScript stack. Accounts and Outgoing Messages are out of scope and keep their current page bodies (wrapped in a gray card inside the new shell so the warm-paper canvas doesn't clash). Stack: htmx + Alpine.js (no React, no build step for UI). Design + scope: `ai/tickets/ui-refactoring/DESIGN_OVERVIEW.md`. Stack rationale: `ai/tickets/ui-refactoring/STACK_DECISION.md`. Supersedes tasks 3–7 of `ai/tickets/2026-04-22-demo-ready-ui-tier1.md` (tasks 1–2 are already done and stay).

## Architectural decisions (locked)

- **Unified sidebar, mixed page bodies.** One shell for the whole app; the sidebar gets a third "Outbound" group containing Accounts + Outgoing Messages with their existing Tailwind bodies unchanged. Legacy bodies are wrapped in `<div class="bg-gray-100 rounded-lg p-6">` inside the shell's main column so they frame correctly against the warm-paper canvas.
- **Timeline tab uses Aidbox FHIR `_history`.** Each status transition in `src/v2-to-fhir/processor-service.ts` is already a full `PUT` → a new version in Aidbox's `*_history` table. Fetched lazily per-message only when the Timeline tab is opened. No new resource, no processor changes. The tab is labeled "Timeline" (not "ACK history") because it shows processing status transitions, not MSA-segment ACKs — integration engineers shouldn't be misled. Docs: https://www.health-samurai.io/docs/aidbox/api/rest-api/history
- **Simulate Sender uses a plain textarea.** No syntax-highlighted overlay for v1 — the "unmapped codes" signal lives in the editor card header chips, not inline. CodeMirror 6 is a follow-up if needed.
- **"Held for mapping" inferred by post-send status poll.** After MLLP returns AA, the send endpoint polls `IncomingHL7v2Message/:id` for up to ~3s. If status moves to `code_mapping_error`, return `held`. Otherwise `sent`. The MLLP ACK alone cannot distinguish the two because the listener ACKs on receive, before the async processor runs.
- **Suggestion ranking is substring-only.** No Jaro-Winkler / fuzzy similarity for v1. Exact-substring hits rank top; remaining matches rank by substring position + display length. Deferred to a follow-up if match quality is poor in practice.
- **Deprecate is out of v1 entirely.** Terminology Map has an "Edit" and a "Delete" action; no soft-deprecate flag, no strikethrough state, no "needs review" count (renders `0`). Soft-deprecate lifecycle moves to the non-goals list.
- **Unmapped Codes "Skip" is client-only.** Clicking Skip advances the selection to the next queue entry with no server call; skipped codes reappear on reload. "Skip all" is removed from v1 (no meaningful server-side semantics without the defer/on-hold decision).
- **Vendor htmx + Alpine outside `src/`.** Static assets live at project root under `public/vendor/`; served by a new static-file route with a strict whitelist regex (not just a `..` check).
- **Chrome DevTools MCP setup is a blocking validation step for Task 4** so agents can visually verify pages against the design.

## Validation

- `bun test:local` — must pass after every task (~10s)
- `bun run typecheck` — must pass after every task
- Manual smoke: open `http://localhost:3000`, walk the page under the active task, confirm visual match against `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`

---

## Task 1: Vendor htmx + Alpine + static-file route

- [x] Create `public/vendor/` (track the directory in git; add `public/` to repo root); download pinned htmx 2.0.x and Alpine 3.15.x minified builds (vendored, not CDN). Latest-stable checked against npm registry on 2026-04-23 (htmx 2.0.10, Alpine 3.15.11); htmx 2.x is the current major (1.9.x line is deprecated).
- [x] Register `GET /static/*` in `src/index.ts` serving from `public/` via `Bun.file()`; set Content-Type from extension; **path must match `^/static/vendor/[A-Za-z0-9._-]+\.(?:js|css|svg|woff2?)$`**, otherwise 404. Rejects `..`, URL-encoded `..`, absolute paths, backslashes.
- [x] Keep font delivery on Google Fonts CDN for v1 (`<link>` to `fonts.googleapis.com/css2?family=Inter...&family=Fraunces...&family=JetBrains+Mono`) — matches current Tailwind-CDN pattern; self-hosting is a follow-up  *(no-op this task — the shell that will include the `<link>` ships in Task 3a; called out here for continuity)*
- [x] Add unit test in `test/unit/ui/static-route.test.ts`: real-file hit returns 200 + correct Content-Type; missing file returns 404; `../`, `%2E%2E%2F`, and absolute paths all return 404
- [x] Run validation — must pass
- [ ] Stop for user review before next task

## Task 2: Design system stylesheet + icon sprite

- [x] Create `src/ui/design-system.ts` exporting `DESIGN_SYSTEM_CSS` (string) with warm-paper CSS variables on `:root` and component classes (`.app`, `.sidebar`, `.nav-item`, `.page`, `.h1`, `.h2`, `.sub`, `.eyebrow`, `.card`, `.card-head`, `.card-pad`, `.btn`, `.btn-primary`, `.btn-ghost`, `.chip` + tone modifiers, `.dot` + tone modifiers, `.inp`, `.mono`, `.muted`, `.clean-scroll`, `.spinner`) — copied verbatim from `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html:10-144` (prototype-only `#root` and `.variant-bar` rules dropped — they were the React-anchor and design-switcher affordances, not part of the app)
- [x] Create `src/ui/icons.ts` exporting `ICON_SPRITE_SVG` (string) with the full `<svg><defs>` block (ids `i-home, i-inbox, i-send, i-alert, i-map, i-users, i-out, i-search, i-settings, i-chev-down, i-chev-right, i-plus, i-check, i-x, i-filter, i-clock, i-arrow-right, i-play, i-sparkle`) and a `renderIcon(name, extraClass?)` helper returning `<svg class="i ..."><use href="#i-{name}"/></svg>`
- [x] Unit test `test/unit/ui/design-system.test.ts`: CSS string contains the variable **names** `--paper`, `--accent`, and the `.card` class selector (assert on identifiers, not hex values — colors are stable but values drift); `renderIcon('home')` returns expected SVG markup
- [x] Run validation — must pass
- [ ] Stop for user review before next task

## Task 3a: App shell scaffold + route renames + migrate Accounts

- [x] Create `src/ui/shell.ts` exporting `renderShell({ active, title, content, topActions? })` — doctype + head (Google Fonts, Tailwind CDN kept, `DESIGN_SYSTEM_CSS` inline, `/static/vendor/htmx-2.0.10.min.js`, `/static/vendor/alpine-3.15.11.min.js` — **versioned filenames**, required by the static handler's `Cache-Control: immutable` policy; bump the filename when upgrading the pin, existing health-check IIFE from `shared-layout.ts`) + body with sidebar, main column, and `ICON_SPRITE_SVG` at the bottom. Shell is additive — do **not** delete `renderLayout` in this task. *(Implementation detail: the health-check IIFE and LOINC autocomplete + HL7 tooltip assets were extracted into `src/ui/legacy-assets.ts` so `renderLayout` and `renderShell` can share them without a 170-line copy-paste. `renderShell` signature dropped `topActions` for v1 — no page needs it yet. NavKey: `dashboard|inbound|simulate|unmapped|terminology|accounts|outgoing`.)*
- [x] Sidebar groups: **Workspace** (Dashboard `/`, Inbound Messages `/incoming-messages`, Simulate Sender `/simulate-sender`), **Terminology** (Unmapped Codes `/unmapped-codes`, Terminology Map `/terminology`), **Outbound** (Accounts `/accounts`, Outgoing Messages `/outgoing-messages`); active-state styling + count badges on Inbound (total) and Unmapped (`hot` accent when non-zero). Count fields come from an extended `getNavData()` (see next bullet).
- [x] **Rename routes in `src/index.ts` to their final names in this task** (pointing at existing handlers; bodies migrated in 3b): `/mllp-client` → `/simulate-sender`, `/mapping/tasks` → `/unmapped-codes`, `/mapping/table` → `/terminology`. Keeps the sidebar links live from the moment the shell ships.
- [x] Grep-audit step: `rg -n '/mllp-client|/mapping/tasks|/mapping/table' src/ docs/ scripts/ test/` — fix each hit (including redirect `Location:` headers in `src/api/*`, doc links, test fixtures, **and hardcoded form `action` attributes inside the page bodies being retained for now** — e.g. `src/ui/pages/mllp-client.ts:245` `action="/mllp-client"` → `action="/simulate-sender"`). No 302 shims; everything points at the final URLs. *(Also updated `src/ui/shared-layout.ts` nav hrefs so the legacy tab bar routes correctly until its pages migrate in 3b, and updated the two existing nav-markup unit tests for the URL change. `/api/mapping/tasks/:id/resolve` is the resolution API and is unchanged.)*
- [x] Extend `getNavData()` in `src/ui/shared.ts`: keep the existing `pendingMappingTasksCount`, add `incomingTotal` (FHIR `IncomingHL7v2Message?_count=0&_total=accurate`)
- [x] Env pill at sidebar footer from `ENV` env var (green `dev`, amber `staging|test`, red `prod`) and mono line with `MLLP_HOST:MLLP_PORT` (defaults `localhost:2575`)
- [x] Legacy-body wrapper helper: `renderLegacyBody(content)` returns `<div class="bg-gray-100 rounded-lg p-6">${content}</div>` so Accounts/Outgoing Tailwind markup frames against warm-paper
- [x] Migrate `handleAccountsPage` in `src/ui/pages/accounts.ts` to `renderShell({ active: "accounts", content: renderLegacyBody(...) })` as the first real smoke of the shell. Other pages stay on `renderLayout` for now.
- [x] Update any nav-markup unit tests for the Accounts page (no dedicated accounts nav test existed; added `test/unit/ui/shell.test.ts` with 16 tests covering the shell's nav/sidebar/env pill — that's the new surface under test)
- [x] Run validation — must pass; manually confirm `/accounts` renders with the new sidebar AND every sidebar link returns 200 (legacy bodies still served under the renamed URLs) *(live smoke: all 7 sidebar URLs → 200, all 3 old URLs → 404 with no shims, accounts renders the shell with `bg-gray-100 rounded-lg p-6` frame around the legacy body; unmapped count=0, inbound total=2)*
- [ ] Stop for user review before next task

## Task 3b: Migrate remaining page bodies into the shell

- [ ] Migrate every remaining page handler (`messages.ts` both halves, `mapping-tasks.ts`, `code-mappings.ts`, `mllp-client.ts`) to call `renderShell`. Bodies unchanged (Tier-2 bodies will be rebuilt in Tasks 5–11). Use `renderLegacyBody` for Outgoing Messages; the others will get new warm-paper bodies soon so they can go directly in the main column.
- [ ] Update the remaining UI unit tests that assert nav markup (`test/unit/ui/*`)
- [ ] Add a smoke-tagged integration test `smoke: every shell page returns 200` that GETs `/`, `/accounts`, `/outgoing-messages`, `/incoming-messages`, `/simulate-sender`, `/unmapped-codes`, `/terminology` and asserts 200 + presence of the `.sidebar` marker in the body
- [ ] Run validation — must pass; manually confirm every page renders with the new sidebar
- [ ] Stop for user review before next task

## Task 3c: Delete legacy layout

- [ ] Delete `renderLayout`, `renderNav`, `renderTab`, `NavTab` type, and related helpers from `src/ui/shared-layout.ts`. Keep `highlightHL7WithDataTooltip` and the health-check IIFE (moved into the shell head in 3a).
- [ ] Remove any remaining imports of the deleted helpers
- [ ] Run validation — must pass (typecheck catches any missed imports)
- [ ] Stop for user review before next task

## Task 4: UI architecture docs + Chrome DevTools MCP

- [ ] Create `docs/developer-guide/ui-architecture.md` covering: when to use htmx vs Alpine vs plain form POST, partial-endpoint naming (`/{page}/partials/{name}`), design-system class vocabulary, icon sprite usage, shell composition, when server-renders the selected-detail on `?selected=` full page loads
- [ ] Create `docs/developer-guide/ui-design-tokens.md` — palette (warm-paper), typography (Inter/Fraunces/JetBrains Mono), spacing scale, component class inventory with tiny HTML samples. Direct reference for agents so they don't re-read the design HTML every time
- [ ] Create `docs/developer-guide/how-to/add-ui-page.md` — recipe: page handler, route registration, sidebar entry, partial pattern, tests
- [ ] Add Chrome DevTools MCP server to `.claude/settings.json` (or `.claude/settings.local.json`) per its install docs; surface the exact approval steps in `docs/developer-guide/ui-architecture.md`
- [ ] **Blocking validation**: user-approves MCP and confirms the agent can take a screenshot of `http://localhost:3000/` via Chrome DevTools MCP. Task 4 is not signed off until this works end-to-end.
- [ ] Add one-line pointer in `CLAUDE.md` under "Code Style" → "UI conventions: see `docs/developer-guide/ui-architecture.md`"
- [ ] Run validation — typecheck must pass; MCP screenshot must succeed
- [ ] Stop for user review before next task

## Task 5: Simulate Sender page (includes schema change for MSH-10 lookup)

**Problem:** the MLLP listener (`src/mllp/mllp-server.ts:107`) currently persists `IncomingHL7v2Message` without storing MSH-10 on the resource and without a SearchParameter for it, and Aidbox's assigned resource id never round-trips back through MLLP to the sender. So the post-send poll has no key to look up the message it just sent. Additionally, sending the same template twice (e.g., the "ORU^R01 Unknown LOINC" demo) must not collide — two resources must be distinguishable.

- [ ] **Schema change** in `init-bundle.json`: add field `IncomingHL7v2Message.messageControlId` (`type: string`), add a SearchParameter `IncomingHL7v2Message-message-control-id` (code `message-control-id`, expression `IncomingHL7v2Message.messageControlId`). Bump the bundle revision if the project tracks one; document in `docs/developer-guide/oru-processing.md` (or wherever the IncomingHL7v2Message schema is described)
- [ ] Update the generated type in `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` (re-run `bun run regenerate-fhir` if that's how the generated types stay in sync with the bundle; otherwise hand-edit)
- [ ] Update `storeMessage()` in `src/mllp/mllp-server.ts` to extract MSH-10 from the incoming HL7v2 and set `messageControlId` on the resource
- [ ] Run migration / Aidbox reload so the new SearchParameter is registered; unit-test the listener writes a `messageControlId`; integration test: POST a message via MLLP, then `GET /fhir/IncomingHL7v2Message?message-control-id={MSH-10}` returns exactly one entry
- [ ] Create `src/ui/pages/simulate-sender.ts` with `handleSimulateSenderPage` — composer layout per `DESIGN_OVERVIEW.md § Simulate Sender`, **plain textarea** (no overlay-pre highlighting in v1)
- [ ] Lift `MESSAGE_TYPES` array (ORU^R01, ORU^R01-unknown, ADT^A01, ADT^A08, VXU^V04, ORM^O01, BAR^P01) from `ai/tickets/ui-refactoring/hl7v2-v2/project/design/page-simulate.jsx:8-56` verbatim into the new page module; export it so Task 6 can import the templates for the scripted demo
- [ ] Alpine: editor component (`x-data` with `raw`, `typeId`, `sender`, computed `parsed`), SendCard state machine (`idle → sending → sent | held`) with elapsed tick. **No compose-time "contains unmapped code" chip** — the post-send status poll is the authoritative source (the design prototype's regex-on-body only worked for demo templates and would silently lie on real-world pasted bodies).
- [ ] **Export `sendMLLPMessage` from `src/ui/pages/mllp-client.ts`** (currently a private `function`) so the new handler can reuse it without duplication. (Or: move `sendMLLPMessage` into `src/mllp/client.ts` as part of this task if it's about to outlive `mllp-client.ts` — see Task 12 cleanup.)
- [ ] Replace the handler wired to `/simulate-sender` with `handleSimulateSenderPage`; register `POST /simulate-sender/send` that:
  1. **Rewrite MSH-10 to a fresh unique id** in the outbound raw HL7v2 (`SIM-${Date.now()}-${crypto.randomUUID().slice(0,8)}` or equivalent). This is the cornerstone that lets the user resend the same demo template back-to-back and still poll for the specific send. Helper: `rewriteMessageControlId(raw, newId)` with a unit test.
  2. Sends the rewritten raw HL7 via `sendMLLPMessage`; capture ACK
  3. **Polls `IncomingHL7v2Message?message-control-id={newId}&_elements=status&_count=1` every 500ms for up to 3s**, stopping when status is `processed`, `warning`, `code_mapping_error`, or any `*_error`. The first poll may return 0 entries if the listener hasn't written yet — treat 0-entry response as "keep polling," not as error.
  4. Returns JSON `{status: "sent"|"held"|"error", ack: string, messageControlId: string, messageStatus?: string}`. `held` when post-send status is `code_mapping_error`. `error` when status is any `*_error` or when MLLP send threw. `sent` otherwise (including timeout — optimistic: message was received, processing just hasn't caught up).
- [ ] Unit tests: `rewriteMessageControlId` replaces only MSH-10 (segment-delimiter / field-delimiter safe); happy-path send (mocked poll → `processed`); held-for-mapping send (mocked poll → `code_mapping_error`); MLLP-unreachable error path; poll-timeout falls back to `sent`; **duplicate-send test** — call the endpoint twice with the same template body, assert two distinct `messageControlId`s come back and both look up distinct rows
- [ ] Run validation — must pass; manual smoke: send ORU-unknown twice, see two separate rows in Inbound each with a distinct MSH-10; second send shows "Held for mapping" independently of the first
- [ ] Stop for user review before next task

## Task 6: Dashboard page + scripted demo runner

- [ ] Create `src/api/demo-scenario.ts` exporting `runDemoScenario()` that fires four MLLP messages (ADT^A01, ORU^R01 known, VXU^V04, ORU^R01 unknown) with 2s spacing, fire-and-forget (`.catch(console.error)`); import the templates from `src/ui/pages/simulate-sender.ts`'s exported `MESSAGE_TYPES` (shipped in Task 5)
- [ ] Register routes in `src/index.ts`: `POST /demo/run-scenario` (guarded by `DEMO_MODE !== "off"`, returns 202), `GET /dashboard/partials/stats`, `GET /dashboard/partials/ticker?limit=15`. **`DEMO_MODE` semantics**: default-on; endpoint is enabled when the env var is unset, empty, or any non-`"off"` string; only `DEMO_MODE=off` disables. Document alongside `DISABLE_POLLING` / `POLL_INTERVAL_MS` in `CLAUDE.md`'s env-flags section.
- [ ] Create `src/ui/pages/dashboard.ts` with `handleDashboardPage`: hero + demo-conductor card + stats strip + live ticker per `DESIGN_OVERVIEW.md § Dashboard`; htmx `hx-trigger="every 10s"` on stats, `hx-trigger="every 5s"` on ticker. **No pause toggle in v1** — ticker always auto-refreshes; the design's pause button is dropped (the reliable pattern — always-poll + Alpine cancels via `x-on:htmx:before-request` — is viable, but with a single-user demo the feature earns little; revisit if the refresh becomes genuinely disruptive). Moved to non-goals.
- [ ] Stats partial queries (all per-request, no caching):
  - received-today: `IncomingHL7v2Message?_lastUpdated=gt{today-ISO}&_count=0&_total=accurate`
  - need-mapping: `IncomingHL7v2Message?status=code_mapping_error&_count=0&_total=accurate`
  - errors: multi-status OR on the 3 hard-error statuses, `_count=0&_total=accurate`
  - avg-latency: fetch last 100 processed messages (`_sort=-_lastUpdated&_count=100&status=processed`), compute mean of `meta.lastUpdated - date` in-request
  - worker health: `getWorkerHealth()` in `src/workers.ts` returns `{ oruProcessor, barBuilder, barSender }` each `"up" | "down" | "disabled"`. When `DISABLE_POLLING=1` or handle is null, returns all `"disabled"` (don't crash)
- [ ] Move `GET /` in `src/index.ts` from `handleAccountsPage` to `handleDashboardPage`; `/accounts` stays reachable
- [ ] Unit tests for `demo-scenario.ts` (fires 4 sends in order) and both partials (happy path + empty state + worker-disabled state)
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

- [ ] **OPEN: runtime-verify** Aidbox `_history` is enabled AND versioning is not disabled on the `IncomingHL7v2Message` attribute definition. Run `curl -u root:$SECRET "http://localhost:8080/fhir/IncomingHL7v2Message/{any-id}/_history?_count=5"` and confirm response is a `Bundle` with `entry[]` each carrying `meta.versionId` and distinct `meta.lastUpdated`. If only one version comes back for a known-multi-update message, check Aidbox's `Attribute` definition for the resource and ensure `versioning` is not `disabled-on-resource`.
- [ ] Register `GET /incoming-messages/:id/partials/detail` (shell + default `structured` tab) and `GET /incoming-messages/:id/partials/detail/:tab` (tab-specific fragment)
- [ ] Implement 4 tab handlers:
  - `structured` — re-parse stored `message` via `@atomic-ehr/hl7v2`, render segment mini-cards; warn-border when segment contains the problem code
  - `raw` — reuse `highlightHL7WithDataTooltip` from `shared-layout.ts`
  - `fhir` — pretty-print `entries` array; warn highlight on unresolved codings with inline `// ⚠ no LOINC mapping` comment. Empty-state card when `entries` is absent (parsing_error / conversion_error messages)
  - `timeline` — fetch `/fhir/IncomingHL7v2Message/:id/_history?_count=50`, render timeline rows `{meta.lastUpdated, statusChip, error?}`. **Filter out consecutive versions where `status` and `error` are both unchanged** (those are entries-only PUTs from the processor and would clutter the timeline). Infer step chip heuristically from status delta (received→processed, *→code_mapping_error, etc.)
- [ ] User-facing tab labels: `Structured`, `Raw HL7`, `FHIR resources`, `Timeline` (not "ACK history")
- [ ] Detail header actions: "Replay" `hx-post`s to existing `POST /mark-for-retry/:id` with `hx-target="#detail" hx-swap="outerHTML"`; "Map code" (visible only when `unmappedCodes?.length`) links to `/unmapped-codes?code={encodeURIComponent(localCode)}&sender={encodeURIComponent(sender)}`
- [ ] **Make `/mark-for-retry/:id` htmx-aware**: when request header `HX-Request: true`, respond with the refreshed detail-pane HTML (reuse the detail-partial handler) and set `HX-Trigger: message-replayed` so the list pane can listen and refresh itself via `hx-trigger="message-replayed from:body"`. Non-htmx callers (existing Inbound "Retry" form posts) keep the `302 → /incoming-messages` behavior — branch on the header, don't break the old path.
- [ ] Tab switching: `hx-get` on tab button with `hx-target="#detail-body"`; Timeline tab is the only one that triggers an extra Aidbox call (lazy per user intent, per architectural decision)
- [ ] Unit tests for each of the 4 tab handlers (happy path + an error state per tab, including the entries-absent FHIR tab state); integration test in `test/integration/ui/` hitting `_history` against the test Aidbox for a message that's transitioned at least twice
- [ ] Run validation — must pass; manual smoke walks all 4 tabs on a real message
- [ ] Stop for user review before next task

## Task 9: Unmapped Codes rebuild + substring suggestion scoring

- [ ] Create `src/api/terminology-suggest.ts` exporting `suggestCodes(display, field)`: wraps existing `searchLoincCodes()` from `src/code-mapping/terminology-api.ts`. **Substring-only scoring for v1** — no Jaro-Winkler: exact-substring match in display → 100; case-insensitive token hit → 70; otherwise 40. Return top 3 `{code, display, score, system}`. If match quality proves weak in practice, a JW / fuzzy pass is a follow-up.
- [ ] Register `GET /api/terminology/suggest?display=&field=` route
- [ ] Create `src/ui/pages/unmapped.ts` with `handleUnmappedCodesPage` — queue + editor split per `DESIGN_OVERVIEW.md § Unmapped Codes`; supports `?code=&sender=` pre-selection (matches the "Map code" link from Inbound)
- [ ] Replace the handler wired to `/unmapped-codes` with `handleUnmappedCodesPage`; register `GET /unmapped-codes/partials/queue` and `GET /unmapped-codes/:code/partials/editor?sender=`; editor partial calls `suggestCodes()` for the pre-selected code's display
- [ ] **URL-encoding discipline**: `localCode` values can contain `^`, `/`, `:` (e.g. `UNKNOWN_TEST^LOCAL`). Every outbound link, `hx-get`, and `hx-post` that interpolates `localCode` must wrap it in `encodeURIComponent(...)`; every server handler must `decodeURIComponent(req.params.code)` (matches the existing pattern in `src/api/concept-map-entries.ts:97`). Add one unit test that round-trips a `^`-containing localCode through the `/unmapped-codes/:code/partials/editor` partial.
- [ ] Queue partial: aggregates open `Task?status=requested` (existing query), regroups by `localCode + sender + field`, counts messages via `Task.input`; returns queue list HTML
- [ ] Actions:
  - Save → existing `POST /api/mapping/tasks/:id/resolve`
  - **Skip** → **client-only Alpine action** that advances the queue selection to the next entry. No server call. Skipped codes reappear on reload.
  - **Skip all** → **removed from v1** (no Alpine button, no endpoint). Hero's right-side action slot keeps only the "Suggest with AI" ghost button rendered `disabled` with "coming soon" chip.
- [ ] Unit tests: scoring helper (exact substring, token hit, miss cases), queue partial (groups correctly), editor partial (pre-selection loads suggestions), Alpine skip test (either an Alpine unit test if tooling exists, or a DOM assertion that the Skip button has no `hx-*` attributes and only `x-on:click` wiring)
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 10: Terminology Map — table + filter popovers + detail

- [ ] Create `src/ui/pages/terminology.ts` with `handleTerminologyPage` — KPI strip + two-pane (table + detail); supports `?q=&fhir=&sender=` URL params (multi-valued `fhir` and `sender`)
- [ ] Replace the handler wired to `/terminology` with `handleTerminologyPage`; register partials: `GET /terminology/partials/table?q=&fhir=&sender=` (server-filtered rows), `GET /terminology/partials/facets/fhir`, `GET /terminology/partials/facets/sender`, `GET /terminology/partials/detail/:conceptMapId/:code`
- [ ] **URL-encoding discipline** (same as Task 9): every `hx-get`/`hx-post`/link interpolating `:code` must `encodeURIComponent(localCode)` and server handlers must `decodeURIComponent(req.params.code)`. Add a unit test for `/terminology/partials/detail/:conceptMapId/:code` with a `^`-containing localCode.
- [ ] Facet partials: in-memory scan of all ConceptMap entries (reuse existing `listConceptMaps` + group), return `{name, count}[]` rendered as searchable multi-select list; Alpine popover (`x-on:click.outside`, `x-on:keyup.escape`) wraps them
- [ ] Detail partial: FHIR target (split typography), local/std mapping, source panel, minimal lineage (**creation time from the current resource's `meta.createdAt`**, NOT `_history?_count=1` which would return the most recent version). Footer actions: **Edit** and **Delete** (no Deprecate).
- [ ] **No deprecated-state rendering.** No strikethrough. All rows are treated as active.
- [ ] KPI strip values: total mappings (sum across all maps); coverage % (processed / (processed + code_mapping_error) **all-time**, two `_count=0&_total=accurate` queries, no time filter); messages/window (replace with total processed messages count, `IncomingHL7v2Message?status=processed&_count=0&_total=accurate`); needs-review (literal `0` for v1).
- [ ] **No usage column in v1.** Design shows `usage:4820` per entry but we don't track this today and v1 only produces ~4 demo messages (would render 0/1 everywhere and undersell the feature). Render no usage field at all — don't leave a `—` placeholder either. Moved to non-goals with the implementation approach documented.
- [ ] Unit tests for the 4 new partials; integration test hitting facet counts against the test Aidbox
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 11: Terminology Map — Add/Edit modal + Delete

- [ ] Register `GET /terminology/partials/modal?mode=add` and `GET /terminology/partials/modal?mode=edit&conceptMapId=&code=` — returns modal body HTML (FHIR target select add-only, local system + code two-column, local display, search-to-map input with icon); edit mode locks target field
- [ ] Alpine wiring: backdrop + ESC + ✕ close; **submit disabled until all required fields filled**: in `add` mode — `fhirTarget`, `localSystem`, `localCode`, `targetCode`; in `edit` mode — `localCode` + `targetCode` (target is locked). `localDisplay` is optional.
- [ ] Submit routes to existing `POST /api/concept-maps/:id/entries` (add) or `POST /api/concept-maps/:id/entries/:code` (edit); on success: refreshed table + modal closes (see next bullet for how)
- [ ] **Make `handleAddEntry` / `handleUpdateEntry` / `handleDeleteEntry` htmx-aware** (`src/api/concept-map-entries.ts`): when `req.headers.get('HX-Request') === 'true'`, respond with the refreshed table-partial HTML (call the same renderer used by `GET /terminology/partials/table`, applying the current `q/fhir/sender` filters from form data or query string) and set response header `HX-Trigger: concept-map-entry-saved` (or `concept-map-entry-deleted`). Non-htmx callers (tests, direct form posts) keep the existing `302 → /mapping/table?conceptMapId=...` behavior — branch on the header, do not break the legacy path. Client: modal wrapper uses `@concept-map-entry-saved.window="open=false"` (Alpine) to close; table-partial swap happens via `hx-target="#terminology-table" hx-swap="outerHTML"` on the form. This is the idiomatic htmx pattern (`HX-Trigger` for cross-component side-effects, fragment response for the visible update).
- [ ] **Delete button** in detail footer: `hx-post` to `POST /api/concept-maps/:id/entries/:code/delete` (existing) with `hx-target="#terminology-table" hx-swap="outerHTML"`; uses the same htmx-aware branch. `hx-confirm="Delete this mapping?"` for v1 — follow-up to replace with an inline Alpine confirm popover. **Button is labeled "Delete", not "Deprecate"** — see Overview.
- [ ] Unit tests: modal renders in both modes; submit path succeeds for both legacy (302) and htmx (partial + `HX-Trigger`) branches; disabled-when-empty gate works for all required fields; delete round-trips through the htmx branch
- [ ] Run validation — must pass; manual smoke: Add a mapping via the modal, confirm it appears in the table and is retrievable via `GET /fhir/ConceptMap`; Delete a mapping, confirm the row disappears
- [ ] Stop for user review before next task

## Task 12: Cleanup

- [ ] Delete dead code: old `renderIncomingMessagesPage` body in `src/ui/pages/messages.ts` (keep Outgoing), legacy HTML rendering in `src/ui/pages/mapping-tasks.ts` and `src/ui/pages/code-mappings.ts`, page-render functions in `src/ui/pages/mllp-client.ts`. If `sendMLLPMessage` is still in `mllp-client.ts` at this point, **move it to `src/mllp/client.ts`** and delete `mllp-client.ts` entirely (keep `sendMLLPTest` if any test still uses it; otherwise delete it too).
- [ ] Re-run the `rg` grep-audit from Task 3a to confirm no stale references remain to `/mllp-client`, `/mapping/tasks`, `/mapping/table`, `renderLayout`, or `renderNav`
- [ ] Close `ai/tickets/2026-04-22-demo-ready-ui-tier1.md`: mark tasks 3–7 as "superseded by `2026-04-23-ui-design-system-refactor.md`", leave tasks 1–2 as-is (already done)
- [ ] End-to-end manual demo walkthrough: `/` Dashboard → Run demo → ticker shows 4 → click warn row → Inbound detail walks Structured/Raw/FHIR/Timeline tabs → Map code → Unmapped pre-selected → accept top suggestion → message reprocesses → Terminology Map shows the new entry → sidebar links all still work including Accounts/Outgoing (framed in gray card)
- [ ] Final `bun test:all`
- [ ] Stop for user review — confirm demo walkthrough feels right

---

## Non-goals for v1 (tracked for follow-up)

- **Per-mapping usage counts / last-seen timestamps.** Design shows `usage:4820` per entry but we don't track this today. Recommended implementation when picked up: add `IncomingHL7v2Message.appliedMappings: [{conceptMapId, localCode, localSystem, targetCode}]` + SearchParameter `applied-mapping-code`; each ConceptMap-using resolver (`observation-code-resolver`, `pv1-encounter` patient-class, `orc-servicerequest`) returns what it applied; processor-service stamps the final message; Terminology table queries `IncomingHL7v2Message?applied-mapping-code={code}&_count=0&_total=accurate` per row (batch with OR for pagination). Rejected alternatives: (a) counter on ConceptMap entry — write amplification and contention; (b) compute from `entries[].coding` — collides across maps and double-counts inline LOINC resolutions.
- **Soft-deprecate lifecycle for ConceptMap entries** (no `status` field, no strikethrough, no "needs review" counter — v1 treats everything as active; Delete is the only removal path)
- **Syntax-highlighted composer in Simulate Sender** (CodeMirror 6 or overlay-pre textarea — v1 is plain textarea)
- **Compose-time "contains unmapped code" chip in Simulate Sender** — the design prototype's regex was tied to demo-template literals (`LOCAL`, `UNKNOWN_TEST`) and would mislead on real bodies. The post-send status poll surfaces the honest answer; follow-up could add a real debounced server-side code-extract + ConceptMap check if the product needs pre-send warnings.
- **Jaro-Winkler / fuzzy similarity scoring** for suggestions (v1 is substring-only)
- **"Skip all" in Unmapped Codes** (v1 Skip is client-only next-item; no bulk action)
- **Ticker pause toggle on Dashboard** — single-user demo context makes the auto-refresh unobtrusive; the always-poll + Alpine `x-on:htmx:before-request` guard pattern is viable if we want it back later
- LLM-backed "Suggest with AI" batch action
- Sender-health page (deferred per `DESIGN_OVERVIEW.md` late-stage suggestions)
- Per-type `SearchParameter` on `IncomingHL7v2Message` (in-memory grouping is enough for demo scale)
- Custom `ProcessingLog` resource (Aidbox `_history` substitutes)
- Self-hosted fonts (Google Fonts CDN for v1)
- Re-skinning Accounts/Outgoing Messages to the warm-paper palette (they sit in a gray-card frame inside the shell for now)
