// Warm-paper design system stylesheet. Source of truth:
// `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html` (lines 10–144).
//
// Two exports feed the shell head:
//   - DESIGN_SYSTEM_CSS: plain <style> — :root palette, body/reset base, and
//     shell-specific layout rules (`.app`, `.sidebar`, `.brand-*`, `.nav`,
//     `.page`, `.env`). These aren't worth expressing as Tailwind utility
//     stacks and don't need to be "Tailwind-aware".
//   - TAILWIND_CSS: <style type="text/tailwindcss"> — consumed by the v4
//     `@tailwindcss/browser` runtime. Contains:
//       * `@theme { ... }` mapping the warm-paper palette (from :root) into
//         Tailwind's color / font / breakpoint namespaces, so `bg-paper`,
//         `text-ink-3`, `font-mono`, `wide:...` all resolve correctly.
//       * `@source inline(...)` blocks — v4's replacement for v3's safelist.
//         Forces JIT emission of classes that only appear inside Alpine
//         `<template x-if>` bodies or `:class` ternaries (scan misses them).
//       * `@layer components { ... }` with the compound-component vocabulary
//         (`.card`, `.btn`, `.chip`, `.dot`, `.inp`, `.nav-item`, `.spinner`,
//         `.clean-scroll`, `.h1`, `.h2`). Cascade: components < utilities,
//         so a page can override `.btn` with a utility stack.
//
// v4 migration note (2026-04-23): the original Task 6a wiring used the v3
// Play CDN (`cdn.tailwindcss.com`) + inline `tailwind.config = {...}` JS
// object. v4 drops the JS config entirely — configuration is CSS-first via
// `@theme`, and safelisting is CSS-first via `@source inline(...)`. There
// is no `tailwind.config.js` file anymore; IntelliSense reads the `@theme`
// block. See `docs/developer-guide/adr/002-tailwind-reconciliation.md`.

export const DESIGN_SYSTEM_CSS = `
  :root {
    /* Warm paper palette — taken from wireframes, production-refined.
       These are the SINGLE SOURCE OF TRUTH for palette values. Tailwind's
       @theme block below maps them into the utility namespace; editing a
       hex here updates both direct var(--paper) usages AND bg-paper/text-* etc. */
    --paper:      #FBF8F2;   /* canvas */
    --paper-2:    #F5F0E6;   /* soft fill */
    --surface:    #FFFFFF;   /* card */
    --ink:        #1F1A15;   /* primary text */
    --ink-2:      #5A4F43;   /* body text */
    --ink-3:      #968B7D;   /* muted */
    --line:       #E8E0D0;   /* hairline */
    --line-2:     #D8CCB4;   /* stronger divider */
    --accent:     #C6532A;   /* terracotta — slightly deeper than wireframe for trust */
    --accent-soft:#F6E3D8;
    --accent-ink: #8A3014;
    --ok:         #3F8A5C;
    --ok-soft:    #E3F1E6;
    --warn:       #A37319;
    --warn-soft:  #F5ECCF;
    --err:        #A84428;
    --err-soft:   #F5DFD5;
    --sans: 'Inter', system-ui, -apple-system, sans-serif;
    --serif: 'Fraunces', 'Tiempos', Georgia, serif;
    --mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; background: var(--paper); color: var(--ink); font-family: var(--sans); -webkit-font-smoothing: antialiased; font-feature-settings: 'ss01', 'cv11'; }
  a:not([class]) { color: inherit; }
  button { font-family: inherit; cursor: pointer; }

  /* Shell layout */
  .app { display: grid; grid-template-columns: 252px 1fr; min-height: 100vh; }
  .sidebar { background: var(--paper-2); border-right: 1px solid var(--line); padding: 22px 14px 16px; display:flex; flex-direction:column; gap: 18px; position: sticky; top:0; height: 100vh; }
  .brand { display:flex; align-items:center; gap:10px; padding: 2px 8px 4px; }
  .brand-mark { width: 30px; height: 30px; border-radius: 6px; background: var(--ink); color: var(--paper); display:grid; place-items:center; font-family: var(--serif); font-weight: 500; font-size: 15px; letter-spacing: -0.02em; }
  .brand-name { font-family: var(--serif); font-weight: 500; font-size: 18px; letter-spacing: -0.01em; color: var(--ink); }
  .brand-sub { font-size: 11px; color: var(--ink-3); margin-top: -2px; letter-spacing: 0.02em; }
  .nav { display:flex; flex-direction:column; gap:1px; }
  .nav-label { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); padding: 14px 10px 6px; font-weight: 500; }
  .main { min-width: 0; }
  .page { padding: 32px 40px 48px; display:flex; flex-direction:column; gap: 22px; max-width: 1760px; margin: 0 auto; width: 100%; }
  .env { margin-top:auto; padding: 10px 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 7px; font-size: 12px; color: var(--ink-2); display:flex; align-items:center; gap:10px; }
  .env .dot { width: 7px; height:7px; border-radius:50%; background: var(--ok); }

  @media (min-width: 1600px) {
    .page { padding: 36px 56px 56px; gap: 26px; }
  }
`;

// Tailwind v4 uses conventional theme-token names (--color-*, --font-*,
// --breakpoint-*) to generate utility classes. We reference the :root vars
// declared above so there's exactly one palette definition — the @theme
// block is a *mapping*, not a duplicate. Tradeoff: every token exists as
// two CSS variables at runtime (e.g., `--paper` and `--color-paper`). The
// cost is ~34 extra var declarations; the win is no drift between the two
// names. If the :root vars are ever renamed, the @theme references here
// are the only place that needs updating.
export const TAILWIND_CSS = `
  @theme {
    --color-paper: var(--paper);
    --color-paper-2: var(--paper-2);
    --color-surface: var(--surface);
    --color-ink: var(--ink);
    --color-ink-2: var(--ink-2);
    --color-ink-3: var(--ink-3);
    --color-line: var(--line);
    --color-line-2: var(--line-2);
    --color-accent: var(--accent);
    --color-accent-soft: var(--accent-soft);
    --color-accent-ink: var(--accent-ink);
    --color-ok: var(--ok);
    --color-ok-soft: var(--ok-soft);
    --color-warn: var(--warn);
    --color-warn-soft: var(--warn-soft);
    --color-err: var(--err);
    --color-err-soft: var(--err-soft);

    --font-sans: var(--sans);
    --font-serif: var(--serif);
    --font-mono: var(--mono);

    --breakpoint-wide: 1600px;
  }

  /* Safelist: classes Tailwind JIT can't find via DOM scan.
     - .spinner lives inside Alpine <template x-if> blocks (Simulate Sender's
       sending state) — not rendered until user action.
     - Warm-paper tone utilities appear only inside Alpine :class ternaries;
       pre-emit the full (bg|text|border)-<token> matrix via brace expansion
       so tone transitions don't flicker during the first JIT recompile. */
  @source inline("spinner");
  @source inline("{bg,text,border}-{paper,paper-2,surface,ink,ink-2,ink-3,line,line-2,accent,accent-soft,accent-ink,ok,ok-soft,warn,warn-soft,err,err-soft}");

  @layer components {
    .card { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
    .card-pad { padding: 18px 20px; }
    .card-head { display:flex; align-items:center; gap:10px; padding: 14px 20px; border-bottom: 1px solid var(--line); }
    .card-title { font-size: 13px; font-weight: 500; color: var(--ink); letter-spacing: -0.005em; }
    .card-sub { font-size: 11.5px; color: var(--ink-3); margin-left: auto; font-family: var(--mono); }

    .btn { display:inline-flex; align-items:center; gap:7px; padding: 7px 12px; border-radius: 6px; border:1px solid var(--line); background: var(--surface); color: var(--ink); font-size: 13px; font-weight: 500; white-space:nowrap; }
    .btn:hover { border-color: var(--line-2); background: var(--paper-2); }
    .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 500; }
    .btn-primary:hover { background: var(--accent-ink); border-color: var(--accent-ink); }
    .btn-ghost { background: transparent; border-color: transparent; color: var(--ink-2); }
    .btn-ghost:hover { background: rgba(31, 26, 21, 0.04); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .chip { display:inline-flex; align-items:center; gap:5px; padding: 2px 8px; font-size: 11.5px; border-radius: 4px; background: var(--paper-2); color: var(--ink-2); border: 1px solid var(--line); font-family: var(--mono); font-weight: 500; white-space: nowrap; }
    .chip-accent { background: var(--accent-soft); color: var(--accent-ink); border-color: transparent; }
    .chip-ok   { background: var(--ok-soft);   color: var(--ok);   border-color: transparent; }
    .chip-warn { background: var(--warn-soft); color: var(--warn); border-color: transparent; }
    .chip-err  { background: var(--err-soft);  color: var(--err);  border-color: transparent; }

    .dot { width:6px; height:6px; border-radius:50%; background: var(--ink-3); display:inline-block; flex-shrink:0; }
    .dot.ok { background: var(--ok); }
    .dot.warn { background: var(--warn); }
    .dot.err { background: var(--err); }
    .dot.accent { background: var(--accent); }

    .inp { padding: 9px 11px; background: var(--surface); border: 1px solid var(--line); border-radius: 6px; color: var(--ink); font-size: 13px; font-family: inherit; outline: none; transition: border-color 0.1s; width: 100%; box-sizing: border-box; min-width: 0; }
    .inp:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .inp::placeholder { color: var(--ink-3); }
    select.inp { appearance: none; -webkit-appearance: none; background-image: linear-gradient(45deg, transparent 50%, var(--ink-3) 50%), linear-gradient(135deg, var(--ink-3) 50%, transparent 50%); background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%; background-size: 5px 5px; background-repeat: no-repeat; padding-right: 28px; cursor: pointer; }

    .nav-item { display:flex; align-items:center; gap:10px; padding: 7px 10px; border-radius: 6px; color: var(--ink-2); font-size: 13.5px; text-decoration:none; cursor:pointer; white-space: nowrap; transition: background .12s; position:relative; }
    .nav-item:hover { background: rgba(31, 26, 21, 0.04); color: var(--ink); }
    .nav-item.active { background: var(--surface); color: var(--ink); font-weight: 500; box-shadow: 0 1px 2px rgba(31,26,21,0.04), 0 0 0 1px var(--line); }
    .nav-item.active::before { content:''; position:absolute; left:-14px; top:8px; bottom:8px; width:2px; background: var(--accent); border-radius: 2px; }

    .spinner { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid currentColor; border-top-color: transparent; animation: spin 0.7s linear infinite; display: inline-block; }

    .clean-scroll { scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }
    .clean-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
    .clean-scroll::-webkit-scrollbar-thumb { background: var(--line-2); border-radius: 4px; }
    .clean-scroll::-webkit-scrollbar-track { background: transparent; }

    .h1 { font-family: var(--serif); font-size: 30px; font-weight: 500; letter-spacing: -0.02em; margin: 0; line-height: 1.1; }
    .h2 { font-family: var(--serif); font-size: 20px; font-weight: 500; letter-spacing: -0.01em; margin: 0; }

    @media (min-width: 1600px) {
      .h1 { font-size: 34px; }
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  }
`;
