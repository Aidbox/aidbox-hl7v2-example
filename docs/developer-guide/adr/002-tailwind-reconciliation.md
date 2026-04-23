# ADR-002: Tailwind Reconciliation — v4 Browser JIT with CSS-Native Config

**Status:** Accepted
**Date:** 2026-04-23
**Context:** UI design-system refactor (Tasks 6a–6b of `ai/tickets/2026-04-23-ui-design-system-refactor.md`); supersedes the "CSS story" open follow-up in `ai/tickets/ui-refactoring/STACK_DECISION.md`.

## Context

`STACK_DECISION.md` (locked 2026-04-23) recommended "Tailwind + warm-paper CSS vars as theme colors" with no build step. Tasks 2–5 (stylesheet, icon sprite, shell, route renames, Simulate Sender) shipped the *not-recommended* alternative instead: a new `src/ui/design-system.ts` with inline `style="..."` attributes on page bodies, while Tailwind remained CDN-loaded globally to keep Accounts + Outgoing Messages rendering. This forked the CSS system — two mutually-exclusive styling vocabularies coexisting without a written rationale for the flip.

Task 6 reconciles before the surface grows. Dashboard, Inbound detail, Unmapped Codes, and Terminology Map hadn't been built yet; reconciling first prevented multiplying the inline-style surface by ~5×.

An initial Task 6a shipped against Tailwind v3.4.17 Play CDN (`cdn.tailwindcss.com`) with JS-based `tailwind.config = {...}` inline, per the STACK_DECISION baseline. Mid-execution (during Task 6b) the user reported the remote Play CDN was hanging at page-load and asked for a local install matching the htmx/alpine pattern. v3's `cdn.tailwindcss.com` only serves v3.x — v4 (latest: 4.2.4) has no Play-CDN URL. The user elected the full v4 migration over keeping v3 vendored, accepting a larger reconciliation in exchange for the current major version.

## Decision

1. **Vendor Tailwind v4.2.4 browser build locally** at `public/vendor/tailwindcss-browser-4.2.4.min.js` (271 KB). Served via the existing `/static/vendor/*` route — same pattern as htmx 2.0.10 and Alpine 3.15.11.

2. **Configuration lives in CSS, not JS.** v4 drops `tailwind.config = {...}` entirely. Configuration moves into a `<style type="text/tailwindcss">` block that the browser runtime reads at page load:
   - `@theme { ... }` maps the warm-paper palette (declared once in `:root` in `DESIGN_SYSTEM_CSS`) into Tailwind's `--color-*` / `--font-*` / `--breakpoint-*` namespaces so `bg-paper`, `text-ink-3`, `font-serif`, `wide:text-lg` resolve correctly.
   - `@source inline(...)` replaces v3's JS safelist. Classes only appearing inside Alpine `<template x-if>` bodies or `:class` ternaries (not in the initial DOM) are listed here via brace-expansion patterns.
   - `@layer components { ... }` holds the compound-component vocabulary (`.card`, `.btn`, `.chip`, `.dot`, `.inp`, `.nav-item`, `.spinner`, `.clean-scroll`, `.h1`, `.h2`). Utility classes land in a later cascade tier than this layer, so pages can override a component class with a utility stack without a specificity fight.

3. **`:root` is the single source of truth for palette values.** The 17 warm-paper hex values are declared once in `DESIGN_SYSTEM_CSS`'s `:root` block. `@theme` references them via `--color-paper: var(--paper)` etc. — it's a mapping, not a duplicate. A unit test (`test/unit/ui/design-system-palette-sync.test.ts`) asserts 1:1 parity between `:root` custom-property names and `@theme` `--color-*` entries, so a rename in one place fails CI if not propagated.

4. **Utility-ish classes deleted from `DESIGN_SYSTEM_CSS`.** `.muted`, `.mono`, `.sub`, `.eyebrow`, `.count`, `.i`, `.i-sm` are gone. Every callsite now uses the Tailwind equivalent (`text-ink-3`, `font-mono`, `w-4 h-4`, etc.). A test (`design-system.test.ts#former-utility-ish-classes-are-gone`) guards against reintroduction.

5. **No build step.** `@tailwindcss/browser` performs JIT compilation in the browser via a MutationObserver. Cost: the script is parser-blocking (~271 KB on the critical path); benefit: zero build infrastructure, edit-HTML-refresh-browser loop preserved. Matches the STACK_DECISION principle of "no build step for UI."

## Consequences

**Positive:**

- **Single CSS system.** New pages write Tailwind utilities; Accounts + Outgoing Messages keep rendering their existing Tailwind markup — no vocabulary fork. Re-skinning those two pages to warm-paper later is a rewrite of their bodies, not a framework change.
- **Palette is single-source.** Hex values live in one place (`:root` in `DESIGN_SYSTEM_CSS`). Tests enforce that `@theme` stays in sync.
- **Offline-capable dev loop.** No remote CDN dependency; agents/CI can run without internet. Matches htmx + Alpine's local-vendored pattern.
- **v4 upgrade path.** Using the current major version means new features (`@utility`, native container queries, `@custom-variant`) are available if Task 7+ needs them.
- **Safelist is explicit and co-located.** `@source inline(...)` lives next to the component layer it supports, making JIT-miss bugs easy to trace.

**Negative (accepted tradeoffs):**

- **271 KB parser-blocking script on the critical path.** No `defer` possible — the runtime must scan + compile CSS before the browser paints (else FOUC). Old v3 Play CDN had the same shape remotely (~407 KB). A future "if we add a build step" follow-up would extract this to a pre-built `.css` file, but that contradicts STACK_DECISION's no-build-step principle and isn't on the roadmap.
- **Theme declared in two language surfaces.** `DESIGN_SYSTEM_CSS` (plain CSS) and `TAILWIND_CSS` (Tailwind-flavored CSS with `@theme` / `@source`) are separate string exports in `src/ui/design-system.ts`. Both ship to the browser. Editors without Tailwind Language Server understand the former but not the latter's directives.
- **No `tailwind.config.js` for IntelliSense.** v4's Tailwind Language Server reads the `@theme` block directly from CSS. Editors configured against v3 won't see the warm-paper tokens until the plugin is updated.
- **Utility overrides silently beat `@layer components`.** A page author who writes `<button class="btn px-6">` is opting out of the `.btn` padding without the cascade making that obvious. By-design, but a reviewer trap. The pattern is documented in `docs/developer-guide/ui-architecture.md`.

## Alternatives Considered

1. **Keep Tailwind v3.4.17 Play CDN remote.** Original plan. Rejected by the user after observing the hang; local-vendored pattern matches htmx/alpine. v3 would also accumulate deprecation debt against current Tailwind.

2. **Vendor Tailwind v3.4.17 locally (same shape, different URL).** Smallest diff from Task 6a's v3 work. Rejected by the user in favor of current major version.

3. **Full build step (Vite / PostCSS + `tailwindcss` CLI generating a static `.css` file).** Eliminates the 271 KB runtime payload, but introduces the build infrastructure STACK_DECISION explicitly rejected. Revisit if the runtime payload becomes a demo-blocker — current size is below the htmx+alpine combined baseline anyway.

4. **Drop Tailwind entirely for new pages; only use the design-system vocabulary.** The "not recommended" option from STACK_DECISION's open follow-up. Rejected: forks the CSS system between "new page" vs "legacy Tailwind page" permanently.

## Implementation

- Vendored runtime: `public/vendor/tailwindcss-browser-4.2.4.min.js`
- Theme + safelist + component layer: `TAILWIND_CSS` export in `src/ui/design-system.ts`
- Palette `:root` declaration: `DESIGN_SYSTEM_CSS` export in the same file
- Shell wiring: `src/ui/shell.ts` (script tag + `<style type="text/tailwindcss">` block)
- Palette-drift guard: `test/unit/ui/design-system-palette-sync.test.ts`
- Deleted-selector guard: `test/unit/ui/design-system.test.ts` → `former utility-ish classes are gone`
- Safelist coverage validation: live MCP probe documented in the ticket's Task 6b completion note

## Superseded

- `STACK_DECISION.md` § "Open follow-ups" → "Decide the CSS story" — resolved by this ADR.
