# Add a new UI page

End-to-end recipe for adding a new page to the warm-paper UI. Background: [`../ui-architecture.md`](../ui-architecture.md); class vocabulary: [`../ui-design-tokens.md`](../ui-design-tokens.md).

## 1. Create the page module

Each page lives at `src/ui/pages/{slug}.ts` and owns its route handler plus any partial handlers.

```typescript
// src/ui/pages/senders.ts
import { renderShell } from "../shell";
import { htmlResponse, getNavData } from "../shared";
import { renderIcon } from "../icons";
import { escapeHtml } from "../../utils/html";

export async function handleSendersPage(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const selected = url.searchParams.get("selected");

  const navData = await getNavData();
  const senders = await loadSenders();
  const selectedDetail = selected ? await loadSender(selected) : null;

  const content = `
    ${renderHero()}
    <div style="display:grid; grid-template-columns: 360px 1fr; gap: 18px;">
      <div class="card" id="sender-list">
        ${renderSenderList(senders, selected)}
      </div>
      <div class="card" id="detail">
        ${selectedDetail ? renderSenderDetail(selectedDetail) : renderEmptyDetail()}
      </div>
    </div>
  `;

  return renderShell({
    active: "senders",           // must be a NavKey (extend src/ui/shell.ts)
    title: "Senders",
    content,
    navData,
  });
}

function renderHero(): string {
  return `
    <div>
      <div class="eyebrow">Workspace</div>
      <h1 class="h1" style="margin-top:4px;">Senders</h1>
      <p class="sub">Every HL7v2 source that has pushed a message.</p>
    </div>
  `;
}
```

Keep the handler under 80 lines. Extract render helpers (`renderSenderCard`, `renderSenderList`) into the same module. Heavy data-fetching helpers belong in a separate service file, not in the page module.

Always pipe user-controlled strings through `escapeHtml` from `src/utils/html.ts` before interpolating into the template — URL params, form values, and Aidbox resource fields are all untrusted from the shell's perspective.

### Two-pane (list + detail) pattern

For pages with a selection URL param (`?selected=`), the same render helpers serve both the initial full page load (server-renders the detail into `#detail`) and the htmx partial swap on row click. Don't duplicate the rendering:

```typescript
// Shared renderer — single source of truth
function renderSenderDetail(sender: Sender): string { /* ... */ }

// Partial handler returns just the fragment
export async function handleSenderDetailPartial(req: Request & { params: { id: string } }): Promise<Response> {
  const sender = await loadSender(req.params.id);
  return htmlResponse(renderSenderDetail(sender));
}
```

List rows wire into htmx with:

```html
<a hx-get="/senders/${escapeHtml(sender.id)}/partials/detail"
   hx-target="#detail"
   hx-swap="innerHTML"
   hx-push-url="?selected=${escapeHtml(sender.id)}">
  ${escapeHtml(sender.name)}
</a>
```

## 2. Register the route

In [`src/index.ts`](../../src/index.ts), add the route alongside the existing UI routes:

```typescript
import { handleSendersPage } from "./ui/pages/senders";

// ...
routes: {
  // ...
  "/senders": handleSendersPage,
  "/senders/partials/list": handleSendersListPartial,
  // ...
}
```

Routes for partials use the `/{page}/partials/{name}` convention. Method-specific handlers go in an object: `"/senders": { GET: handlePage, POST: createSender }`.

## 3. Add a sidebar entry

In [`src/ui/shell.ts`](../../src/ui/shell.ts):

1. Extend `NavKey` with the new key: `| "senders"`.
2. Add the link under the right group in `buildNavGroups`. Choose `Workspace` / `Terminology` / `Outbound` based on the page's role. Pick an icon from the existing sprite — add a new `<symbol>` to `src/ui/icons.ts` only if none fit.
3. Optionally add a count: if the sidebar should show a badge, extend `NavData` in [`src/ui/shared.ts`](../../src/ui/shared.ts) and fetch the count in `getNavData()`.

Run the existing shell tests (`bun test test/unit/ui/shell.test.ts`) — the "all expected links render" test will catch a typo.

## 4. Partial endpoints

If the page has fragments that update in place (list refresh, tab swap, detail pane), register them next to the page handler and return raw HTML without the shell:

```typescript
export async function handleSendersListPartial(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const filter = url.searchParams.get("filter");
  const senders = await loadSenders(filter);
  return htmlResponse(renderSendersList(senders));
}
```

Client-side, use htmx to swap:

```html
<div id="senders-list"
     hx-get="/senders/partials/list"
     hx-trigger="every 5s"
     hx-swap="outerHTML">
  <!-- server-rendered initial list -->
</div>
```

For two-pane layouts, make the detail-pane partial bookmark-safe by also server-rendering it when `?selected=` is present on the page's initial GET.

## 5. Interactivity rules of thumb

- **Form mutation that reloads the page → plain `<form method="POST">`** + `redirectResponse("/senders")`.
- **Fragment swap after mutation → dual-mode handler**. Branch on `req.headers.get("HX-Request") === "true"`; when true, return the refreshed fragment + `HX-Trigger` header; when false, return a 302.
- **Client-only state (popover, tabs, disabled-until-filled) → Alpine**. `x-data`, `x-on:click.outside`, `x-bind:disabled`. Never Alpine-fetch — use htmx.
- **Auto-refresh lists → `hx-trigger="every 5s"`** guarded by an Alpine flag when the user has a row selected.

## 6. Tests

Minimum coverage:

- **Unit test at `test/unit/ui/{slug}.test.ts`**: render the page with a fake `NavData` and assert: the page title is in the output, the sidebar key is marked active, and at least one page-specific marker is present (hero heading, card title). Avoid brittle snapshots.
- **If the page has partials**: unit test each partial's happy path + empty state. Partial handlers should be pure-ish (take params, fetch data, return HTML) — mock only the data layer.
- **Integration test at `test/integration/ui/{slug}.integration.test.ts`** (optional but recommended): exercise the handler against the real test Aidbox with seed data. Tag the smoke-worthy case with a name starting `smoke: ` so it joins `bun test:smoke`.

## 7. Accessibility + responsive

- Every icon-only control needs `aria-label` on the control (the `<svg>` is `aria-hidden` by default).
- Use semantic elements: `<button>` for actions, `<a href>` for navigation, `<form>` for writes. Don't replace buttons with clickable divs.
- The shell's grid is fixed at 252px + 1fr. Content is responsive within the main column via CSS grid / flex. Don't add your own viewport-width breakpoints; use the existing `.page` media query if you need a denser large-screen variant.

## 8. What NOT to do

- Do not import `renderLayout` or `renderNav` — they were deleted in Task 3c. Use `renderShell`.
- Do not add new Tailwind classes to new pages. Tailwind CDN is still loaded for the legacy Accounts + Outgoing bodies; new markup uses the design-system classes.
- Do not inline `<style>` blocks in page bodies. Add the rule to `DESIGN_SYSTEM_CSS` in `src/ui/design-system.ts`.
- Do not hit the database from a render helper. Fetch in the handler, pass data into rendering functions.
- Do not re-read the design HTML prototype (`ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`) on every task. `ui-design-tokens.md` and this recipe are the extracted reference; re-open the prototype only when investigating a visual question neither doc answers.
