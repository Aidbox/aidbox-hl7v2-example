import { describe, test, expect } from "bun:test";
import { DESIGN_SYSTEM_CSS } from "../../../src/ui/design-system";
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

  test("includes every component class named in Task 2", () => {
    const required = [
      ".app",
      ".sidebar",
      ".nav-item",
      ".page",
      ".h1",
      ".h2",
      ".sub",
      ".eyebrow",
      ".card",
      ".card-head",
      ".card-pad",
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
      ".mono",
      ".muted",
      ".clean-scroll",
      ".spinner",
    ];
    for (const className of required) {
      expect(DESIGN_SYSTEM_CSS).toContain(className);
    }
  });

  test("defines the spin keyframes used by .spinner", () => {
    expect(DESIGN_SYSTEM_CSS).toContain("@keyframes spin");
  });

  test("does not leak prototype-only selectors (#root, .variant-bar)", () => {
    expect(DESIGN_SYSTEM_CSS).not.toContain("#root");
    expect(DESIGN_SYSTEM_CSS).not.toContain(".variant-bar");
  });

  test("has balanced braces (catches accidental truncation)", () => {
    const openBraces = DESIGN_SYSTEM_CSS.match(/\{/g)?.length ?? 0;
    const closeBraces = DESIGN_SYSTEM_CSS.match(/\}/g)?.length ?? 0;
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
  test("renders the default icon class with a symbol reference", () => {
    expect(renderIcon("home")).toBe(
      '<svg class="i" aria-hidden="true"><use href="#i-home"/></svg>',
    );
  });

  test("appends an extra class when provided", () => {
    expect(renderIcon("plus", "i-sm")).toBe(
      '<svg class="i i-sm" aria-hidden="true"><use href="#i-plus"/></svg>',
    );
  });

  test("renders compound-name icons like chev-right", () => {
    expect(renderIcon("chev-right")).toContain('href="#i-chev-right"');
  });
});
