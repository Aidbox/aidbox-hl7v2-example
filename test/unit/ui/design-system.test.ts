import { describe, test, expect } from "bun:test";
import { DESIGN_SYSTEM_CSS, TAILWIND_CSS } from "../../../src/ui/design-system";
import { ICON_NAMES, ICON_SPRITE_SVG, renderIcon } from "../../../src/ui/icons";

describe("DESIGN_SYSTEM_CSS", () => {
  test("declares the warm-paper palette variables on :root", () => {
    expect(DESIGN_SYSTEM_CSS).toContain(":root");
    expect(DESIGN_SYSTEM_CSS).toContain("--paper");
    expect(DESIGN_SYSTEM_CSS).toContain("--paper-2");
    expect(DESIGN_SYSTEM_CSS).toContain("--ink");
    expect(DESIGN_SYSTEM_CSS).toContain("--accent");
    expect(DESIGN_SYSTEM_CSS).toContain("--accent-soft");
    expect(DESIGN_SYSTEM_CSS).toContain("--ok");
    expect(DESIGN_SYSTEM_CSS).toContain("--warn");
    expect(DESIGN_SYSTEM_CSS).toContain("--err");
  });

  test("declares font-family custom properties", () => {
    expect(DESIGN_SYSTEM_CSS).toContain("--sans");
    expect(DESIGN_SYSTEM_CSS).toContain("--serif");
    expect(DESIGN_SYSTEM_CSS).toContain("--mono");
  });

  test("retains shell-specific layout classes", () => {
    // These classes frame the whole app — they aren't worth expressing as
    // Tailwind utility stacks and must stay in DESIGN_SYSTEM_CSS.
    const required = [".app", ".sidebar", ".page", ".nav-label", ".env"];
    for (const className of required) {
      expect(DESIGN_SYSTEM_CSS).toContain(className);
    }
  });

  test("does not reset colors on classed anchors", () => {
    // Tailwind v4 emits utilities inside cascade layers. An unlayered
    // `a { color: inherit }` reset outranks class utilities like `text-white`
    // on legacy filter tabs, so only unclassed links may inherit color here.
    expect(DESIGN_SYSTEM_CSS).toContain("a:not([class]) { color: inherit; }");
    expect(DESIGN_SYSTEM_CSS).not.toContain("a { color: inherit; }");
  });

  test("former utility-ish classes are gone (Task 6b deleted them after migrating usages)", () => {
    // `.muted` / `.mono` / `.sub` / `.eyebrow` / `.count` / `.i` / `.i-sm`
    // have been replaced by Tailwind utilities (`text-ink-3`, `font-mono`,
    // etc.) and must not come back — any resurrection would re-introduce
    // the reconciliation split flagged in STACK_DECISION.md.
    const deleted = [".muted", ".mono", ".sub", ".eyebrow", ".count"];
    for (const selector of deleted) {
      const pattern = new RegExp(
        `(^|[^A-Za-z0-9_-])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s.{:,])`,
      );
      expect(DESIGN_SYSTEM_CSS).not.toMatch(pattern);
      // `.count` was nested inside `.nav-item` in TAILWIND_CSS; verify
      // the nested form is gone too.
      expect(TAILWIND_CSS).not.toMatch(pattern);
    }
    expect(DESIGN_SYSTEM_CSS).not.toMatch(/(^|[^A-Za-z0-9_-])\.i(?=[\s.{:,])/);
    expect(DESIGN_SYSTEM_CSS).not.toMatch(/(^|[^A-Za-z0-9_-])\.i-sm(?=[\s.{:,])/);
  });

  test("compound-component classes are gone from DESIGN_SYSTEM_CSS (they live in TAILWIND_CSS)", () => {
    const moved = [
      ".card",
      ".card-pad",
      ".card-head",
      ".btn",
      ".btn-primary",
      ".chip-ok",
      ".inp",
      ".nav-item",
      ".spinner",
      ".h1",
    ];
    for (const selector of moved) {
      const pattern = new RegExp(
        `(^|[^A-Za-z0-9_-])${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s.{:,])`,
      );
      expect(DESIGN_SYSTEM_CSS).not.toMatch(pattern);
    }
  });

  test("has balanced braces (catches accidental truncation)", () => {
    const openBraces = DESIGN_SYSTEM_CSS.match(/\{/g)?.length ?? 0;
    const closeBraces = DESIGN_SYSTEM_CSS.match(/\}/g)?.length ?? 0;
    expect(openBraces).toBe(closeBraces);
    expect(openBraces).toBeGreaterThan(0);
  });
});

describe("TAILWIND_CSS (Tailwind v4 CSS-native config)", () => {
  test("declares a @theme block (v4 replacement for v3's tailwind.config.js)", () => {
    expect(TAILWIND_CSS).toContain("@theme");
  });

  test("maps every warm-paper palette token into Tailwind's --color-* namespace", () => {
    // Each --color-<name> declaration makes `bg-<name>`, `text-<name>`,
    // `border-<name>` etc. resolve against the :root var of the same name.
    const palette = [
      "paper",
      "paper-2",
      "surface",
      "ink",
      "ink-2",
      "ink-3",
      "line",
      "line-2",
      "accent",
      "accent-soft",
      "accent-ink",
      "ok",
      "ok-soft",
      "warn",
      "warn-soft",
      "err",
      "err-soft",
    ];
    for (const token of palette) {
      expect(TAILWIND_CSS).toContain(`--color-${token}: var(--${token})`);
    }
  });

  test("declares the three font-family tokens mapping to :root vars", () => {
    expect(TAILWIND_CSS).toContain("--font-sans: var(--sans)");
    expect(TAILWIND_CSS).toContain("--font-serif: var(--serif)");
    expect(TAILWIND_CSS).toContain("--font-mono: var(--mono)");
  });

  test("declares the wide breakpoint as a v4 theme token", () => {
    // --breakpoint-wide maps to the `wide:` variant prefix in v4.
    expect(TAILWIND_CSS).toContain("--breakpoint-wide: 1600px");
  });

  test("safelists .spinner via @source inline (v4 replacement for v3 safelist)", () => {
    expect(TAILWIND_CSS).toContain('@source inline("spinner")');
  });

  test("safelists the warm-paper tone utilities via @source inline brace expansion", () => {
    // The brace-expansion string pre-emits (bg|text|border)-<token> for every
    // palette color, so Alpine :class ternaries never flicker unstyled.
    expect(TAILWIND_CSS).toMatch(/@source inline\("\{bg,text,border\}/);
    for (const token of ["paper", "ink-3", "ok-soft", "warn", "err-soft"]) {
      expect(TAILWIND_CSS).toContain(token);
    }
  });

  test("@layer components block declares every compound-component class", () => {
    expect(TAILWIND_CSS).toContain("@layer components");
    const required = [
      ".card",
      ".card-pad",
      ".card-head",
      ".btn",
      ".btn-primary",
      ".btn-ghost",
      ".chip",
      ".chip-accent",
      ".chip-ok",
      ".chip-warn",
      ".chip-err",
      ".dot",
      ".inp",
      "select.inp",
      ".nav-item",
      ".nav-item.active",
      ".spinner",
      ".clean-scroll",
      ".h1",
      ".h2",
    ];
    for (const className of required) {
      expect(TAILWIND_CSS).toContain(className);
    }
  });

  test("defines the spin keyframes used by .spinner", () => {
    expect(TAILWIND_CSS).toContain("@keyframes spin");
  });

  test("has balanced braces", () => {
    const openBraces = TAILWIND_CSS.match(/\{/g)?.length ?? 0;
    const closeBraces = TAILWIND_CSS.match(/\}/g)?.length ?? 0;
    expect(openBraces).toBe(closeBraces);
    expect(openBraces).toBeGreaterThan(0);
  });
});

describe("ICON_SPRITE_SVG", () => {
  test("declares every named icon symbol", () => {
    for (const name of ICON_NAMES) {
      expect(ICON_SPRITE_SVG).toContain(`id="i-${name}"`);
    }
  });

  test("hides the sprite container from assistive tech and layout", () => {
    expect(ICON_SPRITE_SVG).toContain('aria-hidden="true"');
    expect(ICON_SPRITE_SVG).toContain('width="0"');
    expect(ICON_SPRITE_SVG).toContain('height="0"');
  });

  test("sprite symbol count matches ICON_NAMES length (catches drift both ways)", () => {
    const symbolIds = ICON_SPRITE_SVG.match(/id="i-[A-Za-z-]+"/g) ?? [];
    expect(symbolIds.length).toBe(ICON_NAMES.length);
  });
});

describe("renderIcon", () => {
  test("renders default size (16px) as Tailwind utilities", () => {
    const html = renderIcon("home");
    expect(html).toContain('class="w-4 h-4');
    expect(html).toContain("shrink-0");
    expect(html).toContain("stroke-current");
    expect(html).toContain("fill-none");
    expect(html).toContain('<use href="#i-home"/>');
    expect(html).toContain('aria-hidden="true"');
    // .i / .i-sm classes are gone — no legacy reference should survive.
    expect(html).not.toMatch(/class="[^"]*\bi\b/);
    expect(html).not.toMatch(/class="[^"]*\bi-sm\b/);
  });

  test("applies sm size override (13px)", () => {
    const html = renderIcon("plus", "sm");
    expect(html).toContain("w-4 h-4");
    expect(html).toContain("w-[13px]");
    expect(html).toContain("h-[13px]");
  });

  test("renders compound-name icons like chev-right", () => {
    expect(renderIcon("chev-right")).toContain('href="#i-chev-right"');
  });
});
