# Plan: Demo-Ready UI (Tier 1)

## Overview

Transform the admin-grade UI into a customer-demo-ready UI without a rewrite. Biggest unlock: auto-start the three polling services inside the web server so the pipeline is genuinely live on screen. Everything else (dashboard, nav regrouping, severity-graded status colors, auto-refresh, demo scenario button) builds on that foundation.

Scope is Tier 1 only. Side-by-side HL7↔FHIR viewer, Account summary cards, and sender/date filters are Tier 2 and explicitly out of scope.

## Decisions locked upstream (from chat)

- Auto-start polling in `src/index.ts` with `DISABLE_POLLING=1` env escape hatch.
- Renames: `MLLP Test Client → Simulate Sender`, `Mapping Tasks → Unmapped Codes`, `Code Mappings → Terminology Map`, `Incoming Messages → Inbound Messages`. **Keep `Outgoing Messages` as-is.**
- Demo scenario button fires happy-path messages (ORU, ADT, VXU) + one ORU with an unmapped LOINC to showcase the remediation flow.

## Validation

- `bun test:local` — must pass after every task
- `bun run typecheck` — must pass after every task
- Manual smoke: open http://localhost:3000, confirm dashboard loads and nav works

## Task 1: Auto-start polling services in the web server

- [x] Add `startAllPollingServices()` helper that boots the three services (ORU/ADT/VXU processor, BAR account builder, BAR sender) with a demo-friendly poll interval (3–5s, not the 60s default) — live in a new `src/workers.ts` so it's testable independently of `src/index.ts`
- [x] Call `startAllPollingServices()` from `src/index.ts` after `Bun.serve()` unless `process.env.DISABLE_POLLING === "1"`
- [x] On SIGINT/SIGTERM in `src/index.ts`, call `stopAllPollingServices()` before exit
- [x] Log a single startup line indicating which services started and the poll interval (so `bun run logs` shows the demo is live)
- [x] Update `CLAUDE.md` "Quick Start" / "IncomingHL7v2Message statuses" section to note that polling runs in-process (with the `DISABLE_POLLING` escape hatch) — this is new project memory, not stale architecture
- [x] Add a unit test for `startAllPollingServices` verifying all three services are started and stopped
- [x] Fix `bun --hot` worker leak — cache handle on `globalThis` so each reload stops the prior workers before starting new ones *(discovered during validation; wasn't in the original plan)*
- [x] Run validation — typecheck + all 1638 unit tests pass
- [x] Stop for user review before next task

## Task 2: Nav restructure, renames, and environment badge

- [x] In `src/ui/shared-layout.ts`, replace the flat 6-tab nav with three visually grouped sections on one row: **Inbound** (Inbound Messages, Simulate Sender, Unmapped Codes), **Outbound** (Accounts, Outgoing Messages), **Reference** (Terminology Map). Vertical divider between groups + tiny uppercase group label.
- [x] Apply label renames: `MLLP Test Client → Simulate Sender`, `Mapping Tasks → Unmapped Codes`, `Code Mappings → Terminology Map`, `Incoming Messages → Inbound Messages`. Left `Outgoing Messages` unchanged. URL paths unchanged.
- [x] Update page `<h1>` headings and `<title>` tags in `messages.ts`, `mapping-tasks.ts`, `code-mappings.ts`, `mllp-client.ts`. Updated the one affected unit test assertion.
- [x] Added top-right status cluster: env badge (from `ENV`, default `dev`; red for prod, amber for staging/test) + Aidbox health dot with live client-side polling every 10s. Skipped version label (no `version` field in `package.json`).
- [x] Added `GET /api/health` route — pings `/fhir/metadata` with `AbortSignal.timeout(1500)`, returns `{ ok, aidbox: "up"|"down", ms, error? }`. Bumped timeout from the plan's 500ms to 1500ms after live measurement showed metadata typically responds in ~200ms but cold-start can exceed 500ms.
- [x] Run validation — typecheck + 1638 unit tests pass; live server confirms nav + health endpoint render correctly
- [x] Stop for user review before next task

## Task 3: Dashboard landing page

- [ ] Create `src/ui/pages/dashboard.ts` with `handleDashboardPage(req)` that renders at `/`
- [ ] Reroute `/` in `src/index.ts` from `handleAccountsPage` to `handleDashboardPage`. Accounts remains reachable at `/accounts`.
- [ ] Dashboard content, top to bottom:
  - [ ] One-line headline: "HL7v2 ↔ FHIR Integration" + sentence of what the project does
  - [ ] Inline SVG pipeline diagram: `Sender → MLLP → IncomingHL7v2Message → Preprocess → Convert → Aidbox FHIR` on one arrow; `Account → BAR Builder → OutgoingBarMessage → Receiver` on the other. Static SVG, no interactivity. Tailwind-colored (blue inbound, purple outbound).
  - [ ] 4-count tile row: `Received today`, `Processed today`, `Errored today`, `Unmapped codes (pending)`. Counts come from `/fhir/IncomingHL7v2Message?_count=0&...` and `/fhir/Task?code=<mapping-types>&status=requested&_count=0`. Tiles link to the filtered list views.
  - [ ] Recent activity feed: last 10 `IncomingHL7v2Message` + last 10 `OutgoingBarMessage`, merged by `meta.lastUpdated`, each a single row with: direction arrow (↓ inbound, ↑ outbound), message type, status badge, relative time. Each row links to its detail page.
- [ ] Auto-refresh the dashboard via a `<meta http-equiv="refresh" content="5">` tag. Dashboard has no forms or `<details>` to preserve so full refresh is fine here.
- [ ] Add `handleDashboardPage` to the nav as a new `Home` tab at the far left, before the Inbound group
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 4: Severity-graded status colors

- [ ] Create `src/ui/status-badge.ts` exporting `renderStatusBadge(status: string, kind: "incoming" | "outgoing" | "account" | "task"): string`. Centralize the switch statements currently scattered across `src/ui/pages/messages.ts:371-390`, `:250-261` and `src/ui/pages/accounts.ts:221-230`.
- [ ] Palette: `red` (hard errors: `parsing_error`, `sending_error`, `conversion_error`, Account `failed`), `amber` (soft warnings: `warning`, Account `error`), **`blue`** (actionable-but-not-broken: `code_mapping_error` — change from current yellow so it stops colliding with `warning`), `green` (`processed`, `sent`, `completed`), `gray` (`deferred`, `pending`, `received`).
- [ ] Include a tiny icon in each badge (`✓`, `⚠`, `✗`, `◷`) using inline SVG, so color-blind viewers can still distinguish.
- [ ] Replace inline badge rendering in `messages.ts` and `accounts.ts` with calls to the new helper
- [ ] Update `docs/developer-guide/error-statuses.md` color column if it documents colors
- [ ] Unit test `renderStatusBadge` covering all status×kind combinations
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 5: Auto-refresh list pages

- [ ] Add a shared `autoRefreshScript(intervalMs: number)` helper to `src/ui/shared-layout.ts` that, on the client, every `intervalMs`, refetches the current URL with `fetch`, parses the response, and swaps the `<main>` list content — **only when no `<details>` is open and no form input is focused**. This preserves the user's expanded panels and in-flight typing during a demo.
- [ ] Wrap list content in `src/ui/pages/messages.ts` (incoming + outgoing), `src/ui/pages/accounts.ts`, `src/ui/pages/mapping-tasks.ts`, `src/ui/pages/code-mappings.ts` in a `<div id="list-region" data-autorefresh>` so the client script can find the swap target.
- [ ] Enable the script with 5s interval on Inbound, Outgoing, Accounts. Disable on Unmapped Codes and Terminology Map (those are remediation pages; flipping content under the user mid-edit would be hostile).
- [ ] Visible indicator: small "Live" pulsing dot in the page header when auto-refresh is active, clickable to pause.
- [ ] Run validation — must pass. Manually verify that opening a `<details>` panel pauses refresh for that page.
- [ ] Stop for user review before next task

## Task 6: Demo scenario button

- [ ] On the Dashboard, add a "Run demo scenario" button (primary, blue) that POSTs to new `/demo/run-scenario` route
- [ ] `/demo/run-scenario` handler sends these messages via MLLP to `localhost:2575` with 2-second delays between each, in background (fire-and-forget with `.catch(console.error)`; return 302 to `/` immediately):
  1. `ADT^A01` happy path (use the existing sample from `src/ui/pages/mllp-client.ts:130`)
  2. `ORU^R01` with known LOINC codes (existing sample)
  3. `VXU^V04` v2.8.2 happy path (existing sample)
  4. `ORU^R01` with unknown local codes — the "Unknown LOINC" sample from `mllp-client.ts:175` — to showcase the unmapped-code → Unmapped Codes workflow
- [ ] The button disables itself for 10 seconds after click (client-side) so an eager presenter can't double-fire a burst.
- [ ] Guard the route behind `DEMO_MODE !== "off"` (default on) so it can be disabled in non-demo deployments via env
- [ ] Require the MLLP server to be running on port 2575 — on error, the button handler should record the error in a `flash` query param and redirect back, so the dashboard shows a clear "MLLP server not running — run `bun run mllp`" banner rather than silently failing
- [ ] Integration smoke test: `smoke: demo scenario fires 4 messages` — verify the handler queues 4 MLLP sends
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 7: Cleanup

- [ ] Re-label the manual trigger buttons now that polling auto-runs: `Process All` → `Run now`, `Build BAR (N pending)` → `Run now (N pending)`, `Send Pending (N)` → `Run now (N pending)`. Add a muted subtitle `Auto-runs every 5s` beneath each.
- [ ] Add a README snippet and `docs/developer-guide/architecture.md` note on the new in-process polling behavior and `DISABLE_POLLING` / `DEMO_MODE` env flags
- [ ] Sanity-check all nav links still route 200 after the rename pass
- [ ] Final `bun test:all` — must pass
- [ ] Stop for user review — confirm demo walkthrough feels right
