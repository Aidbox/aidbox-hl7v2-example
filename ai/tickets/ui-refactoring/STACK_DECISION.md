# Frontend Stack Decision

**Decision:** htmx + Alpine.js on top of the existing server-rendered TypeScript/Bun stack.
**Rejected:** rewrite to React with JSON APIs.
**Status:** locked by user, 2026-04-23.

## Context

The UI refactoring ticket ships a new design (see `DESIGN_OVERVIEW.md`) for 5 pages: Dashboard, Inbound Messages, Simulate Sender, Unmapped Codes, Terminology Map. Accounts and Outgoing Messages are **out of scope** and stay as-is. Current stack: Bun + TypeScript, server-rendered HTML strings in `src/ui/pages/*.ts`, Tailwind, a handful of JSON endpoints (e.g. `/api/terminology/loinc`), one ad-hoc vanilla-JS widget (LOINC autocomplete).

The design prototype is written in React because Claude Design outputs React. The handoff README explicitly says not to copy the prototype's internal structure — recreate the visual output in whatever fits the target codebase.

## Complexity audit of the design

Going through each page before picking a stack:

| Page | Interactive surface | Needs SPA? |
|---|---|---|
| Dashboard | Auto-refreshing ticker (5s), pause toggle, "Run demo" POST | No |
| Inbound | Row → detail pane, 4 tabs in detail, type filter chips, list auto-refresh | No |
| Simulate Sender | Message-type/sender dropdowns regen body, syntax-highlighted textarea, SendCard state machine (idle/sending/sent/held) with animated checklist | No |
| Unmapped (triage) | Queue → editor, suggestion radio, manual search, Save → replay | No |
| Terminology | Table search, two column-header filter popovers (searchable multi-select, ESC/click-outside), Add/Edit modal with sticky header/footer | No |

None of the pages has cross-cutting client state, client-side routing, or a shared store. Every "reactive" piece is local — a popover, a modal, a send-button state machine. URL is the state across pages.

## Option A — htmx + Alpine.js (chosen)

### Pros

- **Matches existing style.** Every page already renders HTML strings and handles mutations with `form POST + 302`. htmx plugs straight in — `hx-get`, `hx-post`, `hx-target`, `hx-push-url`.
- **No build step added.** Two `<script>` tags in `src/ui/shared-layout.ts`, ~30kb gzipped total.
- **Single rendering system across the app.** Accounts / Outgoing Messages stay server-rendered; new pages are also server-rendered. No bifurcation.
- **Existing JSON endpoints stay where they make sense.** LOINC autocomplete pattern is already right; Alpine actually simplifies the current `querySelectorAll('[data-loinc-autocomplete]')` into `x-data="{q:'', results:[]}"`.
- **Test style unchanged.** Existing tests grep the rendered HTML string. Stays fast, stays simple.
- **Fast iteration.** "Edit HTML string, refresh browser" — important because the chat transcript shows heavy design churn (topbar added then removed, tabs collapsed into filters, modal rewritten twice). Design is likely to keep moving.
- **Browser primitives work by default.** Back button, shareable URLs, bookmarks — all free with server-rendered + htmx `hx-push-url`.
- **Progressive enhancement.** Pages work with JS disabled (degraded but functional). Nice for CI smoke-testing and for robustness.
- **Alpine handles the tricky widgets cleanly:** filter popovers (`x-on:click.outside`, `x-on:keyup.escape`, `x-show`), modals, SendCard state machine, textarea overlay reactivity — all idiomatic Alpine in ~20–50 lines each.

### Cons

- **Less ecosystem pull than React.** Fewer pre-built components; custom widgets are custom.
- **Two libraries to learn instead of one.** htmx for server-driven swaps, Alpine for client-only state. Line between them is usually clear, but occasionally you'll pick wrong and refactor.
- **Typed component boundaries are weaker.** With React + TypeScript, props are type-checked. With Alpine `x-data`, state is loosely typed JS in an HTML attribute.
- **Syntax-highlighted textarea in Simulate Sender is the one real risk.** Overlay-pre alignment is a CSS problem in any stack, but in htmx/Alpine there's no off-the-shelf editor component. Upgrade path if needed: CodeMirror 6 (framework-agnostic).

## Option B — React + JSON APIs (rejected)

### Pros

- **The design is already React.** Copy-paste start possible.
- **Typed component boundaries** across the full UI.
- **Big ecosystem** for pre-built filter popovers, modal libraries, virtualized tables, etc.
- **If future scope expands to a true SPA** (command palette across pages, real-time collab, heavy client-side routing), React amortizes.

### Cons

- **Two rendering systems in one app.** Accounts + Outgoing Messages are explicitly out of scope and stay server-rendered. React for new pages means forever maintaining both "server-rendered HTML string" and "React SPA" conventions in the same codebase.
- **Churn with no behavior change.** Every form-POST+302 needs a JSON endpoint + a client that handles redirect-on-success. Every list route needs a JSON twin. All of `messages.ts`, `mapping-tasks.ts`, `code-mappings.ts`, `mllp-client.ts` gets a parallel JSON surface that does the same thing the current HTML route does.
- **Build step added.** Bun can bundle it, but it's new surface: hot reload config, source maps, dev vs prod builds, cache invalidation.
- **Test style changes.** Component tests (testing-library) or Playwright instead of string-assert. Heavier, slower.
- **Demo iteration gets slower.** Edit JSX → wait for build → refresh → re-hydrate → debug state reset. The chat history shows iteration matters here.
- **The prototype being React is a coincidence.** The handoff README says don't copy the prototype's structure.

## What changes — at a glance

- Add `<script src="https://unpkg.com/htmx.org@latest">` and `<script src="https://unpkg.com/alpinejs" defer>` to `src/ui/shared-layout.ts`. (Or vendor them — ~30kb gzipped combined.)
- Define the warm-paper palette as CSS variables in `:root` inside `shared-layout.ts`. Extend `tailwind.config` with those variables as theme colors, so existing utility classes still work alongside the new palette.
- Existing routes keep returning full HTML for first loads. Add partial-returning routes (e.g. `GET /inbound-messages/:id/detail` returns only the detail pane) for htmx to swap.
- LOINC autocomplete pattern in `src/index.ts:66-96` stays as-is; it's the right shape already.
- Convert the one existing vanilla-JS widget to Alpine when its host page gets touched.

## When to revisit

Flip to React only if one of:

1. A separate admin console SPA with many more pages is funded, and sharing components across it and this app becomes valuable.
2. The design grows a persistent cross-page interactive surface (command palette with shared recent-items state, real-time cursors, etc.).
3. Client-side routing with instant page transitions becomes a hard product requirement.

None of these are on the roadmap today.

## Open follow-ups (not part of this decision)

- `ai/tickets/2026-04-22-demo-ready-ui-tier1.md` predates the visual design. Tasks 1 & 2 are done; tasks 3–7 need re-scoping against `DESIGN_OVERVIEW.md` (e.g. the blue/purple SVG pipeline diagram in old task 3 is not what the design landed on — the design uses a demo-conductor card + stats strip + live ticker in the warm-paper palette). Draft a replacement plan via `/plan` when ready to start implementation.
- Decide the CSS story: keep Tailwind utilities and encode the palette as CSS variables + a Tailwind theme extension (recommended), or drop Tailwind for the new pages entirely (not recommended — forks the CSS system).
