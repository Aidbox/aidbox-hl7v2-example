/**
 * Warm-paper app shell. Wraps page bodies in a sidebar + main column
 * that matches `ai/tickets/ui-refactoring/hl7v2-v2/project/HL7v2 Design.html`.
 *
 * `renderShell` is the replacement for the legacy `renderLayout`; during the
 * migration both coexist. `renderLegacyBody` frames a Tailwind body inside a
 * gray card so the warm-paper canvas doesn't clash with pages whose markup
 * hasn't been rebuilt yet.
 *
 * The design prototype includes a `.topbar` (crumb + search + avatar); the
 * shell intentionally omits it. Pages render their own hero rows inside
 * `content` — each page owns its crumb + actions per DESIGN_OVERVIEW. If a
 * cross-page search lands, it belongs in the sidebar, not a duplicated topbar.
 */

import { DESIGN_SYSTEM_CSS, TAILWIND_CSS } from "./design-system";
import { ICON_SPRITE_SVG, renderIcon, type IconName } from "./icons";
import type { NavData } from "./shared";
import {
  LEGACY_STYLES,
  HEALTH_CHECK_SCRIPT,
  HL7_TOOLTIP_SCRIPT,
  LOINC_AUTOCOMPLETE_SCRIPT,
} from "./legacy-assets";
import { escapeHtml } from "../utils/html";

export type NavKey =
  | "dashboard"
  | "inbound"
  | "simulate"
  | "unmapped"
  | "terminology"
  | "accounts"
  | "outgoing";

export interface ShellOptions {
  active: NavKey;
  title: string;
  content: string;
  navData: NavData;
}

interface NavLink {
  key: NavKey;
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  hot?: boolean;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

function buildNavGroups(navData: NavData): NavGroup[] {
  return [
    {
      label: "Workspace",
      links: [
        { key: "dashboard", href: "/", label: "Dashboard", icon: "home" },
        {
          key: "inbound",
          href: "/incoming-messages",
          label: "Inbound Messages",
          icon: "inbox",
          count: navData.incomingTotal,
        },
        { key: "simulate", href: "/simulate-sender", label: "Simulate Sender", icon: "send" },
      ],
    },
    {
      label: "Terminology",
      links: [
        {
          key: "unmapped",
          href: "/unmapped-codes",
          label: "Unmapped Codes",
          icon: "alert",
          count: navData.pendingMappingTasksCount,
          hot: navData.pendingMappingTasksCount > 0,
        },
        { key: "terminology", href: "/terminology", label: "Terminology Map", icon: "map" },
      ],
    },
    {
      label: "Outbound",
      links: [
        { key: "accounts", href: "/accounts", label: "Accounts", icon: "users" },
        { key: "outgoing", href: "/outgoing-messages", label: "Outgoing Messages", icon: "out" },
      ],
    },
  ];
}

function renderNavLink(link: NavLink, active: NavKey): string {
  const activeClass = link.key === active ? " active" : "";
  // Count-badge styling (was .nav-item .count / .nav-item .count.hot) is now
  // expressed as utilities so the compound-component vocabulary stays lean.
  // Tailwind utilities land in a later cascade tier than `@layer components`,
  // so they win against the component-layer `.nav-item` rules without a
  // specificity fight — no `!important` or `font-normal` neutralizers needed.
  // Cold badge intentionally says nothing about weight; hot badge actively
  // sets `font-medium`. The `ml-auto` is load-bearing: it pushes the count
  // to the row's right edge inside `.nav-item`'s flex container.
  const countTone = link.hot ? "text-accent font-medium" : "text-ink-3";
  // Counts are OOB-swap targets for the sidebar poller — each count span
  // has a stable id so /partials/sidebar-counts can refresh both from a
  // single request without replacing the whole nav. See renderSidebarCountSpan.
  const countId = link.key === "inbound" ? "nav-count-inbound"
    : link.key === "unmapped" ? "nav-count-unmapped" : "";
  const count =
    link.count !== undefined && countId
      ? `<span data-count${link.hot ? " data-hot" : ""} id="${countId}" class="ml-auto text-[11px] font-mono ${countTone}">${link.count}</span>`
      : "";
  return `<a class="nav-item${activeClass}" href="${link.href}">${renderIcon(link.icon)}<span>${link.label}</span>${count}</a>`;
}

/**
 * Renders a count span suitable for htmx out-of-band swap. Used by
 * /partials/sidebar-counts to refresh both counts in a single poll without
 * replacing the surrounding nav structure (which would lose focus/hover).
 */
export function renderSidebarCountSpan(
  id: "nav-count-inbound" | "nav-count-unmapped",
  count: number,
  hot: boolean,
): string {
  const tone = hot ? "text-accent font-medium" : "text-ink-3";
  return `<span data-count${hot ? " data-hot" : ""} id="${id}" hx-swap-oob="true" class="ml-auto text-[11px] font-mono ${tone}">${count}</span>`;
}

function renderNavGroup(group: NavGroup, active: NavKey, isFirst: boolean): string {
  // First group sits snug against the brand block — no top padding. Later
  // groups keep .nav-label's default `padding: 14px 10px 6px`.
  const firstClass = isFirst ? " pt-0" : "";
  const links = group.links.map((link) => renderNavLink(link, active)).join("");
  return `<div class="nav-label${firstClass}">${group.label}</div>${links}`;
}

interface EnvInfo {
  label: string;
  tone: "ok" | "warn" | "err";
}

function getEnvInfo(): EnvInfo {
  const raw = (process.env.ENV || "dev").toLowerCase();
  if (raw === "prod" || raw === "production") {
    return { label: raw, tone: "err" };
  }
  if (raw === "staging" || raw === "test") {
    return { label: raw, tone: "warn" };
  }
  return { label: raw, tone: "ok" };
}

// Two independent signals live in the sidebar footer:
//   1. ENV tone (ok/warn/err) + label — static, from process env at render time.
//   2. Aidbox health (up/down) + "Aidbox" label — updated by HEALTH_CHECK_SCRIPT.
// They must not share elements: the poller would otherwise stomp the env label
// and its color would override the env tone via data-attribute CSS specificity.
function renderEnvPill(): string {
  const env = getEnvInfo();
  const host = escapeHtml(process.env.MLLP_HOST || "localhost");
  const port = escapeHtml(process.env.MLLP_PORT || "2575");
  const envLabel = escapeHtml(env.label);
  return `
  <div class="env">
    <div class="flex flex-col min-w-0 gap-1.5 w-full">
      <div class="flex items-center gap-2">
        <span class="dot ${env.tone}"></span>
        <span class="text-ink text-[12.5px] font-medium uppercase tracking-[0.05em]">${envLabel}</span>
      </div>
      <span class="font-mono text-ink-3 text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">mllp://${host}:${port}</span>
      <div class="flex items-center gap-1.5 border-t border-line pt-1.5" title="Aidbox status (checking...)" data-health-tooltip>
        <span data-health-dot></span>
        <span class="text-ink-3 text-[11.5px]" data-health-label>Aidbox</span>
      </div>
    </div>
  </div>`;
}

function renderSidebar(active: NavKey, navData: NavData): string {
  const groups = buildNavGroups(navData);
  const nav = groups
    .map((group, index) => renderNavGroup(group, active, index === 0))
    .join("");

  return `
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">h7</div>
      <div>
        <div class="brand-name">Inbound</div>
        <div class="brand-sub">HL7v2 · FHIR bridge</div>
      </div>
    </div>
    <div class="nav">${nav}</div>
    <!-- Hidden poller — refreshes the sidebar counts every 5s via OOB swap.
         hx-swap="none" because the response body only contains the OOB spans,
         nothing to swap into the poller element itself. -->
    <div hx-get="/partials/sidebar-counts" hx-trigger="every 5s" hx-swap="none" class="hidden"></div>
    ${renderEnvPill()}
  </aside>`;
}

export function renderShell(opts: ShellOptions): string {
  const sidebar = renderSidebar(opts.active, opts.navData);
  // Fraunces dropped 2026-04-24 — the editorial serif read as magazine
  // rather than developer tool. Inter 400/500/600 + JetBrains Mono
  // 400/500 cover all the typographic needs now.
  const googleFonts = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFonts}" rel="stylesheet">
  <script src="/static/vendor/tailwindcss-browser-4.2.4.min.js"></script>
  <style type="text/tailwindcss">${TAILWIND_CSS}</style>
  <script src="/static/vendor/htmx-2.0.10.min.js" defer></script>
  <script src="/static/vendor/alpine-3.15.11.min.js" defer></script>
  <style>${DESIGN_SYSTEM_CSS}</style>
  <style>${LEGACY_STYLES}</style>
</head>
<body>
  <div class="app">
    ${sidebar}
    <main class="main">
      <div class="page">${opts.content}</div>
    </main>
  </div>
  ${ICON_SPRITE_SVG}
  <script>
    // Helper used by the Inbound list's hx-trigger filter. Defined in
    // the shell (not the page) so htmx can reference it without
    // worrying about Alpine init order. Kept as a plain function
    // call — htmx's filter tokenizer can't handle optional chaining
    // or nested CSS attribute-selector brackets; see the comment in
    // renderListPartial for the full footgun list.
    window.__hasSelectedDetail = function() {
      var d = document.getElementById('detail');
      return !!(d && d.getAttribute('data-selected'));
    };
    // Used by the Inbound list's hx-vals to thread current URL
    // params (type, status, batch, selected) into each auto-refresh
    // poll. htmx's hx-vals 'js:' eval can't handle property access
    // like Object.fromEntries without tripping its tokenizer; route
    // through a plain function call.
    window.__getListParams = function() {
      var p = new URLSearchParams(window.location.search);
      var out = {};
      p.forEach(function(v, k) { out[k] = v; });
      return out;
    };
    ${HEALTH_CHECK_SCRIPT}
    ${HL7_TOOLTIP_SCRIPT}
    ${LOINC_AUTOCOMPLETE_SCRIPT}
  </script>
</body>
</html>`;
}

export function renderLegacyBody(content: string): string {
  return `<div class="bg-gray-100 rounded-lg p-6">${content}</div>`;
}
