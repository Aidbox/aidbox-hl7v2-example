# UI Design Tokens

Reference for the warm-paper design system. Source of truth is [`src/ui/design-system.ts`](../../src/ui/design-system.ts) — this file paraphrases it for quick lookup, with samples agents can copy directly. The design prototype lives at `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`; don't re-read it on every task — use this file.

## Palette

All colors are CSS custom properties declared on `:root`. Reference them as `var(--paper)` etc., not as hex.

| Token            | Value      | Role |
|------------------|------------|------|
| `--paper`        | `#FBF8F2`  | Canvas background (app shell). |
| `--paper-2`      | `#F5F0E6`  | Sidebar fill, hover states on paper. |
| `--surface`      | `#FFFFFF`  | Cards, inputs, elevated surfaces. |
| `--ink`          | `#1F1A15`  | Primary text. |
| `--ink-2`        | `#5A4F43`  | Body text. |
| `--ink-3`        | `#968B7D`  | Muted / captions. |
| `--line`         | `#E8E0D0`  | Hairline borders. |
| `--line-2`       | `#D8CCB4`  | Stronger dividers, focus rings. |
| `--accent`       | `#C6532A`  | Terracotta — primary buttons, active-nav rail, "hot" counts. |
| `--accent-soft`  | `#F6E3D8`  | Accent chip backgrounds, focus glow. |
| `--accent-ink`   | `#8A3014`  | Accent hover, accent text on soft bg. |
| `--ok`           | `#3F8A5C`  | Success dot/chip foreground. |
| `--ok-soft`      | `#E3F1E6`  | Success chip background. |
| `--warn`         | `#A37319`  | Warning dot/chip foreground. |
| `--warn-soft`    | `#F5ECCF`  | Warning chip background. |
| `--err`          | `#A84428`  | Error dot/chip foreground. |
| `--err-soft`     | `#F5DFD5`  | Error chip background. |

Rules:
- Never introduce a new hex literal in a page body. Add a token first if a new tone is needed.
- Dark text always uses `--ink`, `--ink-2`, or `--ink-3`; never `#000` / gray literals.
- Chips, dots, and the active-nav rail are the only places the accent color appears. Don't paint headings, body text, or borders with it — that breaks the attention hierarchy.

## Typography

Three font stacks, all loaded from Google Fonts in the shell:

- `var(--sans)` → Inter (400/500/600/700). Default for body, nav, buttons, chips.
- `var(--serif)` → Fraunces (400/500/600 with optical sizing). Used for `.h1` and `.h2` only — these establish the warm-paper editorial feel.
- `var(--mono)` → JetBrains Mono (400/500). IDs, codes, MLLP endpoints, chip labels.

Type scale (from `.h1` down) is defined by `.h1`, `.h2`, `.sub`, `.eyebrow`. Everything else inherits the shell's 13.5px default.

## Component classes

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

### Typography

```html
<div class="eyebrow">Workspace</div>
<h1 class="h1">Inbound Messages</h1>
<p class="sub">Every HL7v2 message we've received, with processing state.</p>
<h2 class="h2">Filters</h2>
<span class="muted">No tag</span>
<span class="mono">MSH|^~\&|...</span>
```

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

Variants: use `card-pad` alone (no head) when the card is a plain padded surface.

### Buttons

```html
<button class="btn">Cancel</button>
<button class="btn btn-primary">Save mapping</button>
<button class="btn btn-ghost">Skip</button>
<button class="btn" disabled>Save</button>
```

- `.btn` is the base (paper-surface background, 1px line).
- `.btn-primary` is the accent terracotta — at most **one primary per pane**.
- `.btn-ghost` drops the surface; use for tertiary actions in hero rows.
- `disabled` attribute dims to 50% opacity and blocks the pointer.

### Chips

```html
<span class="chip">5</span>
<span class="chip chip-accent">4 unmapped</span>
<span class="chip chip-ok">processed</span>
<span class="chip chip-warn">warning</span>
<span class="chip chip-err">error</span>
```

Chips are always mono and always one line — for counts, status labels, and code identifiers.

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
<input class="inp mono" value="UNKNOWN_TEST^LOCAL">
<select class="inp">
  <option>Observation.code</option>
</select>
<textarea class="inp" rows="8"></textarea>
```

Focus ring uses `--accent-soft` + `--accent`. Don't override.

### Utilities

- `.muted` — set color to `--ink-3`.
- `.mono` — apply mono stack (inherits size; add `font-size` inline if needed).
- `.clean-scroll` — thin, accent-tinted scrollbars; use on scroll containers inside cards.
- `.spinner` — 14×14 spinning ring; drop inside a button when a long-running action is in flight.
- `.i`, `.i-sm` — SVG icon sizes (16px, 13px). See `renderIcon` in `src/ui/icons.ts`.

## Spacing

The design uses a loose ~4px grid. Tailwind's `gap-4`/`p-6` rhythm carries over. The `.page` container sets 32px vertical gaps between cards (26px on ≥1600px via the media query in `design-system.ts`). Prefer spacing via `.page`'s flex gap rather than per-card margins — consistency beats one-off fixes.

## Env pill (sidebar footer)

Two independent signals stacked in one card:

1. **Env tone dot + label** — `class="dot ok|warn|err"` next to uppercase env name (`DEV` / `STAGING` / `PROD`). Static; derived from `ENV` env var at render time.
2. **Health dot + "Aidbox" label** — `data-health-dot` + `data-health-label`. Updated every 10s by the health-check script in `legacy-assets.ts`.

Keep them on separate elements. An early version of the sidebar shared one dot for both signals; the health poller overwrote the env label every 10s and the health-state CSS silently won over the env tone via specificity, so prod ran green. See `src/ui/shell.ts#renderEnvPill` for the current separation.
