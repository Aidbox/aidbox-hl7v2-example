import { describe, test, expect } from "bun:test";
import { DESIGN_SYSTEM_CSS, TAILWIND_CSS } from "../../../src/ui/design-system";

// Single-source-of-truth guard. The palette is declared in DESIGN_SYSTEM_CSS
// as `:root` custom properties (e.g., `--paper: #FBF8F2`); TAILWIND_CSS's
// `@theme` block maps each one into Tailwind's v4 color namespace (e.g.,
// `--color-paper: var(--paper)`). Rename a token in `:root` without also
// renaming the `@theme` mapping and `bg-<old>` silently continues to work
// while no `bg-<new>` utility exists — a drift that won't fail typecheck
// or any other test. These assertions make that drift a test failure.

function extractRootVars(css: string): string[] {
  const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\s*\}/);
  if (!rootBlock) {return [];}
  return Array.from(rootBlock[1]!.matchAll(/--([a-z0-9-]+)\s*:/g))
    .map((m) => m[1]!)
    .sort();
}

function extractColorThemeKeys(css: string): string[] {
  const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\s*\}/);
  if (!themeBlock) {return [];}
  return Array.from(themeBlock[1]!.matchAll(/--color-([a-z0-9-]+)\s*:/g))
    .map((m) => m[1]!)
    .sort();
}

function extractColorThemeMappings(css: string): Record<string, string> {
  const themeBlock = css.match(/@theme\s*\{([\s\S]*?)\n\s*\}/);
  if (!themeBlock) {return {};}
  const mappings: Record<string, string> = {};
  for (const m of themeBlock[1]!.matchAll(
    /--color-([a-z0-9-]+)\s*:\s*var\(--([a-z0-9-]+)\)/g,
  )) {
    mappings[m[1]!] = m[2]!;
  }
  return mappings;
}

// Non-color palette tokens (fonts, breakpoints) aren't part of the palette
// but need the same 1:1 structural guarantee.
const FONT_ROOT_VARS = ["sans", "serif", "mono"];
const BREAKPOINT_THEME_KEYS = ["wide"];

describe("palette sync: :root vars ⇄ @theme color mappings", () => {
  const rootVars = extractRootVars(DESIGN_SYSTEM_CSS);
  const colorKeys = extractColorThemeKeys(TAILWIND_CSS);
  const mappings = extractColorThemeMappings(TAILWIND_CSS);

  const paletteRootVars = rootVars.filter((v) => !FONT_ROOT_VARS.includes(v));

  test("every palette :root var has a matching @theme --color-* mapping", () => {
    for (const name of paletteRootVars) {
      expect(colorKeys).toContain(name);
    }
  });

  test("every @theme --color-* maps to a :root var that actually exists", () => {
    for (const [colorName, rootName] of Object.entries(mappings)) {
      expect(rootVars).toContain(rootName);
      // And the mapping name matches the root var it points at — no
      // `--color-foo: var(--bar)` drift where the names intentionally differ.
      expect(rootName).toBe(colorName);
    }
  });

  test("palette key set matches exactly (no orphans on either side)", () => {
    expect(colorKeys).toEqual(paletteRootVars);
  });

  test("font :root vars have matching @theme --font-* mappings", () => {
    for (const name of FONT_ROOT_VARS) {
      expect(TAILWIND_CSS).toContain(`--font-${name}: var(--${name})`);
    }
  });

  test("breakpoint theme keys are declared in @theme", () => {
    for (const name of BREAKPOINT_THEME_KEYS) {
      expect(TAILWIND_CSS).toMatch(
        new RegExp(`--breakpoint-${name}\\s*:\\s*\\d+px`),
      );
    }
  });
});
