# UI Architecture

How the warm-paper web UI is wired, and the conventions to follow when adding or changing it. The visual system is documented separately in [`ui-design-tokens.md`](ui-design-tokens.md); use [`how-to/add-ui-page.md`](how-to/add-ui-page.md) for the end-to-end recipe when creating a new page.

## Stack

Server-rendered HTML from Bun handlers. No React, no build step for UI. Four client-side layers, used sparingly:

1. **htmx** (`public/vendor/htmx-2.0.10.min.js`) — partial fetches, URL pushing, auto-refresh polling. The default mechanism for any interaction that needs to hit the server.
2. **Alpine.js** (`public/vendor/alpine-3.15.11.min.js`) — local UI state without a round-trip (popovers, tab switches, client-only filtering, form edit buffers).
3. **Tailwind CSS v4** (`public/vendor/tailwindcss-browser-4.2.4.min.js`) — utility-first styling. Runs JIT in the browser; no build step. Warm-paper theme tokens and the compound-component vocabulary live in a `<style type="text/tailwindcss">` block emitted by the shell (see "Design-system classes" below). Rationale: [ADR-002](adr/002-tailwind-reconciliation.md).
4. **Plain `<form method="POST">`** — write operations that complete with a 302 redirect to the refreshed page, and legacy endpoints not yet htmx-aware.

Vendor JS is served through the static handler at [`src/ui/static.ts`](../../src/ui/static.ts); paths are version-stamped so `Cache-Control: immutable` is safe.

**One Tailwind for the whole app.** Both new pages (warm-paper design via theme tokens) and legacy pages (Accounts, Outgoing Messages — using the vanilla Tailwind gray/blue palette inside a `renderLegacyBody(...)` gray-card frame) run against the same vendored runtime. The `@theme` block extends the default palette; it doesn't replace it, so `bg-gray-100` keeps working alongside `bg-paper`.

## Shell composition

Every page handler calls [`renderShell`](../../src/ui/shell.ts) and passes the body as a string:

```typescript
return renderShell({
  active: "inbound",        // NavKey — must match a sidebar entry
  title: "Inbound Messages",
  content: bodyHtml,         // raw HTML string; wrap in renderLegacyBody() if still Tailwind
  navData,                   // from getNavData() in src/ui/shared.ts
});
```

The shell injects:
- Google Fonts in `<head>` (remote; the only external dep at runtime)
- Vendored `tailwindcss-browser-4.2.4.min.js` (parser-blocking — must run before first paint or FOUC)
- `<style type="text/tailwindcss">${TAILWIND_CSS}</style>` — the v4 theme + safelist + component layer
- Vendored htmx and Alpine with `defer`
- `<style>${DESIGN_SYSTEM_CSS}</style>` — `:root` palette vars + shell-scaffolding classes (`.app`, `.sidebar`, `.brand-*`, `.nav`, `.page`, `.env`)
- `<style>${LEGACY_STYLES}</style>` — HL7 tooltip styles
- Sidebar with three groups (Workspace / Terminology / Outbound), env pill, health dot
- Icon sprite at the end of `<body>` so every `renderIcon(name)` call works without a per-page import

There is **no topbar** on the shell. Pages render their own hero row (title + actions + chips) inside `content`. A single shared topbar with search + avatar was considered and dropped — every page's top row is meaningfully different, and a common header would have been noise.

**Legacy-body wrapping.** Pages whose markup is still Tailwind (Accounts, Outgoing Messages) wrap their body in `renderLegacyBody(content)` so the gray card frames the Tailwind palette against warm paper. New pages render directly into the main column.

## When to use htmx vs Alpine vs plain form POST

Decision order: **form POST → htmx → Alpine**. Prefer the simplest layer.

- **Plain `<form method="POST">`** — user mutates server state; post-action state is a full page refresh. Existing BAR send, Account create, Task defer all follow this pattern. Keep using it unless you need a fragment swap.
- **htmx** — you need to update a slice of the page without full reload. Typical: auto-refresh lists (`hx-trigger="every 5s"`), fragment swaps after save (`HX-Trigger` header fires a client event → another element listens via `hx-trigger="x from:body"`), URL-param navigation with detail-pane swap (`hx-push-url="?selected=:id"`).
- **Alpine** — purely client-side UI state: popover open/closed, tab currently active, a textarea's edit buffer before save, disabling a submit button until required fields are filled. Do not use Alpine to fetch data — that's htmx's job.

A handler can be dual-mode. When a mutation endpoint needs to serve both a legacy form POST (302) and an htmx fragment swap, branch on `req.headers.get("HX-Request")`:

```typescript
if (req.headers.get("HX-Request") === "true") {
  return htmlResponse(refreshedFragment, {
    headers: { "HX-Trigger": "concept-map-entry-saved" },
  });
}
return redirectResponse("/terminology");
```

## Partial endpoints

URL convention: `/{page}/partials/{name}`.

Examples:
- `GET /incoming-messages/partials/list` — refresh the message list fragment
- `GET /incoming-messages/partials/type-chips` — refresh the per-type chip counts
- `GET /incoming-messages/:id/partials/detail` — server-render the detail pane
- `GET /incoming-messages/:id/partials/detail/:tab` — tab-specific fragment
- `GET /terminology/partials/facets/fhir` — filter popover contents

Rules:
- Partials return `text/html` with no doctype, no `<html>`, no sidebar — just the fragment.
- Partials that read query params should share their logic with the page handler (one function returns HTML, page wraps in `renderShell`, partial returns bare). Don't duplicate the rendering.
- Partial URLs should be bookmark-safe where possible (same query string as the page) so that a raw `curl` returns something useful during debugging.

## `?selected=` full-page-load pattern

Two-pane layouts (Inbound Messages, Terminology Map, Unmapped Codes) keep the selected entity in the URL:

- `?selected={id}` — pre-render the detail pane server-side on full page load so deep links work.
- Row click → `hx-get="/{page}/:id/partials/detail" hx-target="#detail" hx-push-url="?selected=:id"` — subsequent navigation swaps the fragment and updates the URL without reloading the page.
- List auto-refresh (`hx-trigger="every 5s"`) should be guarded by Alpine when a row is selected so the user's edit context isn't clobbered mid-type.

## Design-system classes

Full vocabulary with samples and Tailwind-theme mapping: [`ui-design-tokens.md`](ui-design-tokens.md).

Three tiers of styling, picked in this order:

### 1. Tailwind utilities (default)

Any inline spacing, sizing, color, layout rule: write it as a utility stack. The `@theme` block maps the warm-paper palette into Tailwind's color namespace, so `bg-paper`, `text-ink-3`, `border-line-2` etc. all resolve correctly. Spacing/sizing that doesn't hit a default Tailwind stop uses arbitrary values (`text-[11.5px]`, `mt-[22px]`, `leading-[1.7]`).

```html
<div class="flex items-center gap-3 mt-4 text-[13px] text-ink-2">
  <span class="font-mono text-ink-3">mllp://localhost:2575</span>
</div>
```

### 2. Compound component classes (`@layer components`)

Reusable multi-property visual contracts that would be verbose as utility stacks, AND that have hover/focus/pseudo-element behavior, AND that benefit from a stable name so designers and engineers can reference the same vocabulary:

- Layout: `.card` + `.card-head` + `.card-pad` + `.card-title` + `.card-sub`
- Type: `.h1`, `.h2` (serif), everything else is a utility stack
- Buttons: `.btn`, `.btn-primary`, `.btn-ghost`
- Chips: `.chip` + `.chip-ok|chip-warn|chip-err|chip-accent` for tone
- Dots: `.dot` + `.ok|warn|err|accent` for tone
- Forms: `.inp` (inherits focus ring styling + select-arrow chevron)
- Nav: `.nav-item`, `.nav-item.active` — sidebar row styling, internal
- Effects: `.clean-scroll`, `.spinner`

All declared in the `@layer components` block inside `TAILWIND_CSS` ([`src/ui/design-system.ts`](../../src/ui/design-system.ts)). Utilities land in a later cascade tier, so `<button class="btn px-6">` cleanly overrides `.btn`'s padding — no specificity fight, no `!important`. This is idiomatic and intentional; reviewers should expect utility overrides on component classes.

Prefer utilities over adding a new component class. Only promote to a compound class if the same 4+ utility stack appears 3+ times AND has non-trivial hover/focus/pseudo-element states.

### 3. Shell-scaffolding classes (plain CSS)

`.app`, `.sidebar`, `.brand-*`, `.nav`, `.page`, `.env` — app-wide layout plumbing that only the shell emits. Declared in plain `<style>` (not inside `@layer components`). Page bodies render inside `.page` and never re-apply these.

Plain CSS shell rules must not target classed page elements in ways that collide with Tailwind utilities. In Tailwind v4, utility CSS is emitted inside cascade layers; unlayered shell CSS outranks it. For example, use `a:not([class]) { color: inherit; }`, never `a { color: inherit; }`, or legacy tab links with `text-white` / `text-gray-*` will inherit body text color.

### Former utility-ish classes (DELETED — do not reintroduce)

`.muted`, `.mono`, `.sub`, `.eyebrow`, `.count`, `.i`, `.i-sm` are gone. Use the Tailwind equivalent:

| Old class | Replacement |
|---|---|
| `.muted` | `text-ink-3` |
| `.mono` | `font-mono` |
| `.sub` | `text-[13.5px] text-ink-2 mt-1.5` (or full utility stack) |
| `.eyebrow` | `text-[11px] tracking-[0.1em] uppercase text-ink-3 font-medium` |
| `.count` | `ml-auto text-[11px] font-mono text-ink-3` (or `text-accent font-medium` for hot tone) |
| `.i` | `w-4 h-4 shrink-0 stroke-current fill-none [stroke-width:1.6] ...` (use `renderIcon()` below) |
| `.i-sm` | same as `.i` + `w-[13px] h-[13px]` |

A unit test guards against reintroduction.

### Alpine `:class` vs `:style` — when to pick which

For **single-token color/tone branches**, prefer `:class` with a ternary:

```html
<div :class="status === 'ok' ? 'text-ok' : 'text-ink-3'">...</div>
```

Tailwind JIT emits both branches (the class names appear literally in the HTML source, which the MutationObserver scans). When a ternary's class isn't visible in the initial DOM because it only resolves inside an Alpine `<template x-if>` body, add it to `@source inline(...)` in `TAILWIND_CSS` so JIT pre-emits it. The warm-paper tone set (`{bg,text,border}-{paper,paper-2,...,err-soft}`) is already safelisted globally for this reason.

For **truly computed values** (anything the user can type, or values derived from numeric state), keep the object form of `:style`:

```html
<div :style="{ left: cursorX + 'px' }">...</div>
```

**Footgun (unchanged from v3):** Alpine `:style` in *string* form replaces the static `style` attribute. `:style="'color:var(--warn)'"` overwrites the element's entire static `style="..."` — any `margin`, `padding`, `font-size` you set inline will silently disappear. Use the object form instead; it **merges** with the static style. Verify with `getComputedStyle` if a visual change doesn't apply. (For warm-paper tone bindings, the preferred answer is `:class` — this footgun only applies when a true computed value forces `:style`.)

## Icon sprite

Every icon comes from the shared sprite embedded by the shell. Use [`renderIcon`](../../src/ui/icons.ts):

```typescript
import { renderIcon } from "../icons";

renderIcon("inbox")           // default size (16px) → w-4 h-4 utility stack
renderIcon("plus", "sm")      // 13px variant        → adds w-[13px] h-[13px]
```

Legacy `.i` / `.i-sm` classes are gone; `renderIcon()` now emits Tailwind utility stacks directly (`w-4 h-4 shrink-0 stroke-current fill-none [stroke-width:1.6] [stroke-linecap:round] [stroke-linejoin:round]` by default).

Available icons: `home`, `inbox`, `send`, `alert`, `map`, `users`, `out`, `search`, `settings`, `chev-down`, `chev-right`, `plus`, `check`, `x`, `filter`, `clock`, `arrow-right`, `play`, `sparkle`. Adding a new icon = append a `<symbol>` to `ICON_SPRITE_SVG` and add the name to `ICON_NAMES`; a unit test catches drift.

## Chrome DevTools MCP

Chrome DevTools MCP lets the agent drive a headless browser against the running dev server — take screenshots, read console logs, inspect the DOM. Useful when a review needs to verify a page visually against the design.

**Setup (one-time, user approval required):**

**Prerequisites.**

- Chrome or Chromium installed on the host. On NixOS the `chrome-devtools-mcp` server does not auto-discover the Nix-store path — install `google-chrome` or `chromium` via home-manager / system packages and set `CHROME_EXECUTABLE` below.
- `CHROME_EXECUTABLE` env var exported before launching Claude Code. Pick the path that fits your machine:
  - Debian/Ubuntu: `export CHROME_EXECUTABLE=/usr/bin/google-chrome-stable`
  - macOS: `export CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  - NixOS (home-manager user install): `export CHROME_EXECUTABLE=$(which google-chrome-stable)`
  - Generic fallback: `export CHROME_EXECUTABLE=$(command -v google-chrome-stable || command -v google-chrome || command -v chromium)`

1. Project-wide server definition lives at `.mcp.json` (committed, already in place) and reads `${CHROME_EXECUTABLE}` from the environment:

   ```json
   {
     "mcpServers": {
       "chrome-devtools": {
         "command": "npx",
         "args": [
           "-y",
           "chrome-devtools-mcp@latest",
           "--executablePath",
           "${CHROME_EXECUTABLE}"
         ]
       }
     }
   }
   ```

   Keeping the path out of `.mcp.json` itself means teammates and CI can point at different Chrome installs without editing a committed file. If `CHROME_EXECUTABLE` is unset, the MCP server refuses to launch — the error is clear and the fix is to export the var.

2. To opt in, the user approves the server in Claude Code (interactive prompt on first run) **or** adds `"enabledMcpjsonServers": ["chrome-devtools"]` to `.claude/settings.local.json`. The agent cannot flip this toggle itself — it's a deliberate security boundary.
3. First approval downloads the package via `npx`; expect a 10–30s delay. If the tools don't appear after approval, restart Claude Code.
4. Verify: ask the agent to take a screenshot of `http://localhost:3000/`. Once approval lands, `mcp__chrome-devtools__*` tools become available — prompt "Use Chrome DevTools MCP to capture a screenshot of the dashboard." If the screenshot succeeds, MCP is live.

When reviewing a UI change, the agent should screenshot the affected page before and after the change and compare against `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`.

## File layout

```
src/ui/
├── shell.ts              # renderShell, renderLegacyBody, NavKey
├── design-system.ts      # DESIGN_SYSTEM_CSS
├── icons.ts              # ICON_SPRITE_SVG, ICON_NAMES, renderIcon
├── legacy-assets.ts      # CSS + scripts inherited from the Tailwind layout
├── shared.ts             # htmlResponse, redirectResponse, getNavData, NavData
├── hl7-display.ts        # highlightHL7WithDataTooltip (renamed from shared-layout.ts in Task 13)
├── static.ts             # /static/* route
├── pagination.ts         # shared pagination helpers
└── pages/                # one file per route
```

When you add a new module under `src/ui/`, keep its responsibility tight. A page module should export one handler per route it owns plus a small set of test-only exports (see `terminology.ts` or `inbound.ts` for the warm-paper pattern). Shared helpers go in `shared.ts`; shared styling in `design-system.ts`.

## Common gotchas

- **Forgot `escapeHtml`.** Any user-controlled string interpolated into a template must go through `escapeHtml` from `src/utils/html.ts` — including values read from `URL.searchParams`, form POST bodies, and Aidbox resources. XSS leaks otherwise.
- **`renderShell` called without `navData`.** TypeScript catches this, but the error message is about an object shape mismatch — the fix is always `const navData = await getNavData()` before the render.
- **Two sidebar entries with the same NavKey.** The shell picks the first match; the second is silently inactive. `NavKey` is a string union — adding a new page means both extending the union *and* listing the entry in `buildNavGroups`.
- **`hot` count modifier is opt-in.** `NavLink.hot: true` paints the count badge accent; without it, a non-zero count renders neutral. Use it to signal "the user should notice this" (e.g. unmapped codes pending) — not just "count > 0."
- **Chrome DevTools MCP silently inactive.** If an approval round-tripped but screenshots still error, restart Claude Code; MCP servers are loaded at session start.
- **Class inside Alpine `<template x-if>` doesn't style on first paint.** Tailwind JIT scans the DOM; classes only present inside conditional templates aren't scanned until Alpine renders the template, at which point the MutationObserver triggers a recompile (~ms). For classes that must be styled the instant they appear (spinner during send, tone chips during state transition), add them to `@source inline(...)` in `TAILWIND_CSS` — it pre-emits them at initial compile.
- **Unlayered CSS beats Tailwind v4 utilities.** `DESIGN_SYSTEM_CSS` is plain unlayered CSS, while Tailwind utilities are layered. A broad reset like `a { color: inherit; }` overrides class utilities on anchors (`text-white`, `text-blue-600`) even though the class selector looks more specific. Keep resets scoped to unclassed elements or move them into Tailwind's base layer.
- **`:root` palette rename silently breaks utilities.** `--paper` → `bg-paper` works via an explicit `@theme { --color-paper: var(--paper); }` mapping. Renaming `--paper` without updating the mapping means `bg-paper` continues to exist but points at an undeclared variable. `test/unit/ui/design-system-palette-sync.test.ts` catches this.
