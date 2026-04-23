# UI Architecture

How the warm-paper web UI is wired, and the conventions to follow when adding or changing it. The visual system is documented separately in [`ui-design-tokens.md`](ui-design-tokens.md); use [`how-to/add-ui-page.md`](how-to/add-ui-page.md) for the end-to-end recipe when creating a new page.

## Stack

Server-rendered HTML from Bun handlers. No React, no build step for UI. Three client-side layers, used sparingly:

1. **htmx** (`public/vendor/htmx-2.0.10.min.js`) — partial fetches, URL pushing, auto-refresh polling. The default mechanism for any interaction that needs to hit the server.
2. **Alpine.js** (`public/vendor/alpine-3.15.11.min.js`) — local UI state without a round-trip (popovers, tab switches, client-only filtering, form edit buffers).
3. **Plain `<form method="POST">`** — write operations that complete with a 302 redirect to the refreshed page, and legacy endpoints not yet htmx-aware.

Vendor JS is served through the static handler at [`src/ui/static.ts`](../../src/ui/static.ts); paths are version-stamped so `Cache-Control: immutable` is safe.

**Tailwind CDN coexistence.** The shell still loads Tailwind via CDN for the Accounts + Outgoing Messages legacy bodies. Do not use Tailwind classes in *new* markup — everything new uses the design-system classes below. Tailwind exits when those two pages are re-skinned (out of scope for the current rebuild; tracked as non-goals).

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
- Google Fonts + Tailwind CDN + `DESIGN_SYSTEM_CSS` + `LEGACY_STYLES` in `<head>`
- Vendored htmx and Alpine with `defer`
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

Full class vocabulary with samples: [`ui-design-tokens.md`](ui-design-tokens.md). In short:

- Layout: `.app`, `.sidebar`, `.main`, `.page`, `.card` + `.card-head` + `.card-pad` — the shell emits the `.app > .sidebar + .main > .page` structure; page bodies only render inside `.page` and never re-apply `.app` / `.sidebar` / `.main`
- Type: `.h1` (serif hero), `.h2` (serif section), `.sub` (body), `.eyebrow` (small caps label), `.muted`, `.mono`
- Buttons: `.btn`, `.btn-primary`, `.btn-ghost`
- Chips: `.chip` + `.chip-ok|chip-warn|chip-err|chip-accent` for tone
- Dots: `.dot` + `.ok|warn|err|accent`
- Forms: `.inp` (also `.inp.mono` for hex/code inputs)
- Utilities: `.clean-scroll`, `.spinner`

Every class is defined in [`src/ui/design-system.ts`](../../src/ui/design-system.ts). Do not introduce ad-hoc inline styles for the same visual — add a new class there, or use the existing one.

## Icon sprite

Every icon comes from the shared sprite embedded by the shell. Use [`renderIcon`](../../src/ui/icons.ts):

```typescript
import { renderIcon } from "../icons";

renderIcon("inbox")           // default size (16px)
renderIcon("plus", "i-sm")    // 13px variant
```

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
├── shared-layout.ts      # highlightHL7WithDataTooltip only (historical name; renamed to hl7-display.ts in Task 12)
├── static.ts             # /static/* route
├── pagination.ts         # shared pagination helpers
└── pages/                # one file per route
```

When you add a new module under `src/ui/`, keep its responsibility tight. A page module should export one handler per route it owns plus a small set of test-only exports (see the existing `mapping-tasks.ts` pattern). Shared helpers go in `shared.ts`; shared styling in `design-system.ts`.

## Common gotchas

- **Forgot `escapeHtml`.** Any user-controlled string interpolated into a template must go through `escapeHtml` from `src/utils/html.ts` — including values read from `URL.searchParams`, form POST bodies, and Aidbox resources. XSS leaks otherwise.
- **`renderShell` called without `navData`.** TypeScript catches this, but the error message is about an object shape mismatch — the fix is always `const navData = await getNavData()` before the render.
- **Two sidebar entries with the same NavKey.** The shell picks the first match; the second is silently inactive. `NavKey` is a string union — adding a new page means both extending the union *and* listing the entry in `buildNavGroups`.
- **`hot` count modifier is opt-in.** `NavLink.hot: true` paints the count badge accent; without it, a non-zero count renders neutral. Use it to signal "the user should notice this" (e.g. unmapped codes pending) — not just "count > 0."
- **Chrome DevTools MCP silently inactive.** If an approval round-tripped but screenshots still error, restart Claude Code; MCP servers are loaded at session start.
- **Alpine `:style` string replaces the static `style` attribute.** `:style="'color:var(--warn)'"` (string) overwrites the element's entire static `style="..."` — any `margin`, `padding`, `font-size` you set inline will silently disappear. Use the object form instead: `:style="{ color: ... }"` **merges** with the static style. Verify with `getComputedStyle` if a visual change doesn't apply.
