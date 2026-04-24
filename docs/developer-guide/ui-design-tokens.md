# UI Design Tokens

Reference for the warm-paper design system. Source of truth is [`src/ui/design-system.ts`](../../src/ui/design-system.ts) — this file paraphrases it for quick lookup, with samples agents can copy directly. The design prototype lives at `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`; don't re-read it on every task — use this file.

Architecture context: [`ui-architecture.md`](ui-architecture.md). Rationale for the Tailwind-v4-as-CSS-native-config approach: [ADR-002](adr/002-tailwind-reconciliation.md).

## Tailwind theme mapping

The warm-paper palette is declared once in `:root` (as CSS custom properties) and mapped into Tailwind v4's color namespace via `@theme`. Every token generates the full `bg-<name>` / `text-<name>` / `border-<name>` / `stroke-<name>` / `fill-<name>` / `ring-<name>` utility set.

### Palette

| `:root` var | Tailwind utilities | Value | Role |
|---|---|---|---|
| `--paper` | `bg-paper` `text-paper` `border-paper` | `#FBF8F2` | Canvas background (app shell). |
| `--paper-2` | `bg-paper-2` `...` | `#F5F0E6` | Sidebar fill, hover states on paper. |
| `--surface` | `bg-surface` `...` | `#FFFFFF` | Cards, inputs, elevated surfaces. |
| `--ink` | `text-ink` `bg-ink` `...` | `#1F1A15` | Primary text. |
| `--ink-2` | `text-ink-2` `...` | `#5A4F43` | Body text. |
| `--ink-3` | `text-ink-3` `...` | `#968B7D` | Muted / captions. (Replaces the deleted `.muted` class.) |
| `--line` | `border-line` `...` | `#E8E0D0` | Hairline borders. |
| `--line-2` | `border-line-2` `...` | `#D8CCB4` | Stronger dividers, focus rings. |
| `--accent` | `bg-accent` `text-accent` `...` | `#C6532A` | Terracotta — primary buttons, active-nav rail, "hot" counts. |
| `--accent-soft` | `bg-accent-soft` `...` | `#F6E3D8` | Accent chip backgrounds, focus glow. |
| `--accent-ink` | `text-accent-ink` `...` | `#8A3014` | Accent hover, accent text on soft bg. |
| `--ok` | `text-ok` `bg-ok` `stroke-ok` `...` | `#3F8A5C` | Success dot/chip foreground. |
| `--ok-soft` | `bg-ok-soft` `...` | `#E3F1E6` | Success chip background. |
| `--warn` | `text-warn` `...` | `#A37319` | Warning dot/chip foreground. |
| `--warn-soft` | `bg-warn-soft` `...` | `#F5ECCF` | Warning chip background. |
| `--err` | `text-err` `...` | `#A84428` | Error dot/chip foreground. |
| `--err-soft` | `bg-err-soft` `...` | `#F5DFD5` | Error chip background. |

**Rules:**
- Never introduce a new hex literal in a page body. Add a `:root` var first, and the matching `@theme` `--color-*` mapping, if a new tone is needed. A unit test (`design-system-palette-sync.test.ts`) enforces 1:1 parity between the two.
- Dark text always uses `text-ink` / `text-ink-2` / `text-ink-3`; never `text-gray-*` or hex literals.
- Chips, dots, and the active-nav rail are the only places the accent color appears. Don't paint headings, body text, or borders with it — that breaks the attention hierarchy.

### Typography

Three font stacks, all loaded from Google Fonts in the shell and mapped to Tailwind theme tokens:

| `:root` var | Tailwind utility | Stack | Use for |
|---|---|---|---|
| `--sans` | `font-sans` (default) | Inter (400/500/600/700) | Default body, nav, buttons, chips |
| `--serif` | `font-serif` | Fraunces (400/500/600 optical sizing) | `.h1` and `.h2` only — establishes the warm-paper editorial feel |
| `--mono` | `font-mono` | JetBrains Mono (400/500) | IDs, codes, MLLP endpoints, chip labels |

Type scale is defined by `.h1` and `.h2` compound classes (serif). Every other size is a Tailwind utility (`text-xs`, `text-sm`, `text-[13.5px]`, etc.). The design's most common sizes don't land on default Tailwind stops — use arbitrary values (`text-[11.5px]`, `text-[13.5px]`) when matching the HTML prototype.

### Breakpoints

| `:root` token | Tailwind prefix | Value |
|---|---|---|
| `--breakpoint-wide` | `wide:` | `1600px` |

Use `wide:text-lg` etc. for ≥1600px overrides. Currently only used by `.h1` (36px → 34px at `wide:`); future larger-viewport rules belong here too.

## Component classes

Compound components live in `@layer components` inside `TAILWIND_CSS`. Utilities out-cascade them, so `<button class="btn px-6">` cleanly overrides `.btn`'s padding.

### Layout

```html
<div class="app">                    <!-- grid: 252px sidebar + main -->
  <aside class="sidebar">...</aside>
  <main class="main">
    <div class="page">               <!-- 32px vertical rhythm; stacks cards -->
      <!-- page hero + cards -->
    </div>
  </main>
</div>
```

`.app`, `.sidebar`, `.main`, `.page` are shell-scaffolding classes. Page bodies render inside `.page` and never re-apply them.

### Typography

```html
<div class="text-[11px] tracking-[0.1em] uppercase text-ink-3 font-medium">Workspace</div>
<h1 class="h1">Inbound Messages</h1>
<p class="mt-1.5 text-[13.5px] text-ink-2">Every HL7v2 message we've received, with processing state.</p>
<h2 class="h2">Filters</h2>
<span class="text-ink-3">No tag</span>
<span class="font-mono">MSH|^~\&|...</span>
```

- `.h1` / `.h2` are serif (Fraunces), used for hero titles and section titles. Every other typographic scale is a utility stack.
- The small-caps "eyebrow" label is a utility stack, not a class — see the first line above. Used above `.h1` on page hero rows.

### Cards

```html
<div class="card">
  <div class="card-head">
    <span class="card-title">Recent activity</span>
    <span class="card-sub">updated 2s ago</span>
  </div>
  <div class="card-pad">
    <!-- body -->
  </div>
</div>
```

Use `.card-pad` alone (no head) when the card is a plain padded surface. Stack `.card flex flex-col overflow-hidden` for cards whose body is a full-width input (e.g. Simulate Sender's editor).

### Buttons

```html
<button class="btn">Cancel</button>
<button class="btn btn-primary">Save mapping</button>
<button class="btn btn-ghost">Skip</button>
<button class="btn" disabled>Save</button>
<button class="btn btn-primary w-full justify-center py-2.5 px-3">Send</button>
```

- `.btn` is the base (paper-surface background, 1px line).
- `.btn-primary` is the accent terracotta — at most **one primary per pane**.
- `.btn-ghost` drops the surface; use for tertiary actions in hero rows.
- `disabled` attribute dims to 50% opacity and blocks the pointer (handled by `.btn:disabled`).
- Override padding/sizing with utilities (`w-full`, `justify-center`, `py-2.5 px-3`) — they cleanly win over `.btn`'s base values.

### Chips

```html
<span class="chip">5</span>
<span class="chip chip-accent">4 unmapped</span>
<span class="chip chip-ok">processed</span>
<span class="chip chip-warn">warning</span>
<span class="chip chip-err">error</span>
<span class="chip text-[10.5px]">HL7v2 · 2.5.1</span>  <!-- size override -->
```

Chips are always mono, one line, 11.5px. Override the size with `text-[10.5px]` etc. when embedded inside a card-head row.

### Dots

```html
<span class="dot"></span>          <!-- neutral -->
<span class="dot ok"></span>
<span class="dot warn"></span>
<span class="dot err"></span>
<span class="dot accent"></span>
```

6×6 circle, inline-flex. Pair with text for legends (env pill, health indicator, per-row status).

### Forms

```html
<input class="inp" placeholder="Search…">
<input class="inp font-mono" value="UNKNOWN_TEST^LOCAL">
<select class="inp font-mono mt-1">
  <option>Observation.code</option>
</select>
<textarea class="inp" rows="8"></textarea>
```

Focus ring uses `--accent-soft` + `--accent`. Don't override. `select.inp` gets a custom chevron via background-image; don't add extra chevron markup.

Note: the `.inp.mono` modifier rule is gone — compose `class="inp font-mono"` instead.

### Effects

- **`.clean-scroll`** — thin, accent-tinted scrollbars; use on scroll containers inside cards.
- **`.spinner`** — 14×14 spinning ring; drop inside a button when a long-running action is in flight. Safelisted explicitly because it's commonly hidden inside Alpine `<template x-if>` blocks.

  ```html
  <button disabled class="btn btn-primary w-full justify-center gap-2.5">
    <span class="spinner"></span> Sending…
  </button>
  ```

  For smaller variants, override size + border with arbitrary utilities: `class="spinner w-2.5 h-2.5 text-ink-3 shrink-0 border-[1.5px]"`.

## Spacing

The design uses a loose ~4px grid. Tailwind's default spacing scale covers the common stops (`gap-3` = 12px, `p-5` = 20px, `mt-1.5` = 6px). For the design's non-default values (11.5px, 18px, 22px, 26px), use arbitrary values: `text-[11.5px]`, `py-[18px]`, `mb-[22px]`.

The `.page` container sets 32px vertical gaps between cards (26px at `wide:`). Prefer spacing via `.page`'s flex gap rather than per-card margins — consistency beats one-off fixes.

## Deleted classes (do not reintroduce)

These were removed in Task 6b. A unit test guards against resurrection.

| Old class | Replacement |
|---|---|
| `.muted` | `text-ink-3` |
| `.mono` | `font-mono` |
| `.sub` | utility stack (see the typography sample above) |
| `.eyebrow` | utility stack (see the typography sample above) |
| `.count` | `ml-auto text-[11px] font-mono text-ink-3` (or `text-accent font-medium` for hot tone) |
| `.i` | `w-4 h-4 shrink-0 stroke-current fill-none [stroke-width:1.6] ...` (via `renderIcon()`) |
| `.i-sm` | same + `w-[13px] h-[13px]` (via `renderIcon(name, "sm")`) |
| `.inp.mono` | compose `class="inp font-mono"` |

## Env pill (sidebar footer)

Two independent signals stacked in one card:

1. **Env tone dot + label** — `class="dot ok|warn|err"` next to uppercase env name (`DEV` / `STAGING` / `PROD`). Static; derived from `ENV` env var at render time.
2. **Health dot + "Aidbox" label** — `data-health-dot` + `data-health-label`. Updated every 10s by the health-check script in `legacy-assets.ts`.

Keep them on separate elements. An early version of the sidebar shared one dot for both signals; the health poller overwrote the env label every 10s and the health-state CSS silently won over the env tone via specificity, so prod ran green. See `src/ui/shell.ts#renderEnvPill` for the current separation.
