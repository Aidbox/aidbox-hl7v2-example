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

import { DESIGN_SYSTEM_CSS } from "./design-system";
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
  const count =
    link.count !== undefined
      ? `<span class="count${link.hot ? " hot" : ""}">${link.count}</span>`
      : "";
  return `<a class="nav-item${activeClass}" href="${link.href}">${renderIcon(link.icon)}<span>${link.label}</span>${count}</a>`;
}

function renderNavGroup(group: NavGroup, active: NavKey, isFirst: boolean): string {
  const labelStyle = isFirst ? ' style="padding-top:0"' : "";
  const links = group.links.map((link) => renderNavLink(link, active)).join("");
  return `<div class="nav-label"${labelStyle}>${group.label}</div>${links}`;
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
    <div style="display:flex; flex-direction:column; min-width:0; gap:6px; width:100%;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="dot ${env.tone}"></span>
        <span style="color:var(--ink); font-size:12.5px; font-weight:500; text-transform:uppercase; letter-spacing:0.05em;">${envLabel}</span>
      </div>
      <span class="mono muted" style="font-size:11px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">mllp://${host}:${port}</span>
      <div style="display:flex; align-items:center; gap:6px; border-top:1px solid var(--line); padding-top:6px;" title="Aidbox status (checking...)" data-health-tooltip>
        <span data-health-dot></span>
        <span class="muted" style="font-size:11.5px;" data-health-label>Aidbox</span>
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
    ${renderEnvPill()}
  </aside>`;
}

export function renderShell(opts: ShellOptions): string {
  const sidebar = renderSidebar(opts.active, opts.navData);
  const googleFonts = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=JetBrains+Mono:wght@400;500&display=swap";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(opts.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${googleFonts}" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
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
