// Icon sprite + renderer.
// The shell renders ICON_SPRITE_SVG once per page; individual icons reference
// symbols by id via <use href="#i-{name}"/>.
//
// Icon sizing is now expressed as Tailwind utilities rather than the deleted
// `.i` / `.i-sm` class pair. The defaults match the legacy CSS: 16px square
// (`w-4 h-4`) with stroke-inheriting SVG attrs. The `sm` modifier drops to
// 13px via `w-[13px] h-[13px]` (3.25 isn't a Tailwind spacing stop so the
// arbitrary value keeps the wireframe size exact).

export const ICON_NAMES = [
  "home",
  "inbox",
  "send",
  "alert",
  "map",
  "users",
  "out",
  "search",
  "settings",
  "chev-down",
  "chev-right",
  "plus",
  "check",
  "x",
  "filter",
  "clock",
  "arrow-right",
  "play",
  "sparkle",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

// The only modifier used today; widen this union when a new vocabulary lands.
export type IconClassModifier = "sm";

// Shared utility stacks. Kept as constants so the test and renderer never
// drift in their expectation of what class an icon actually carries.
const ICON_BASE_CLASSES =
  "w-4 h-4 shrink-0 stroke-current fill-none [stroke-width:1.6] [stroke-linecap:round] [stroke-linejoin:round]";
const ICON_SM_OVERRIDE_CLASSES = "w-[13px] h-[13px]";

export const ICON_SPRITE_SVG = `
<svg width="0" height="0" class="absolute" aria-hidden="true">
  <defs>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></symbol>
    <symbol id="i-inbox" viewBox="0 0 24 24"><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7M3 12l3-8h12l3 8M3 12h5l2 3h4l2-3h5"/></symbol>
    <symbol id="i-send" viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></symbol>
    <symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></symbol>
    <symbol id="i-map" viewBox="0 0 24 24"><path d="m1 6 7-3 8 3 7-3v15l-7 3-8-3-7 3zM8 3v15M16 6v15"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/></symbol>
    <symbol id="i-out" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></symbol>
    <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></symbol>
    <symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.9 1 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></symbol>
    <symbol id="i-chev-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
    <symbol id="i-chev-right" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
    <symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></symbol>
    <symbol id="i-x" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></symbol>
    <symbol id="i-filter" viewBox="0 0 24 24"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></symbol>
    <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></symbol>
    <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></symbol>
    <symbol id="i-play" viewBox="0 0 24 24"><path d="M6 4l14 8L6 20z" fill="currentColor"/></symbol>
    <symbol id="i-sparkle" viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></symbol>
  </defs>
</svg>`;

// Icons are decorative — they get `aria-hidden="true"` so screen readers
// ignore them. When the icon is the only semantic content of a control (e.g.
// an icon-only button), the *parent* must supply `aria-label`.
export function renderIcon(name: IconName, size?: IconClassModifier): string {
  const classAttr =
    size === "sm"
      ? `${ICON_BASE_CLASSES} ${ICON_SM_OVERRIDE_CLASSES}`
      : ICON_BASE_CLASSES;
  return `<svg class="${classAttr}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}
