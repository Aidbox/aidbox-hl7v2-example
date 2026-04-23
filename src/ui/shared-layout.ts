/**
 * Shared layout components for UI pages (legacy Tailwind layout).
 *
 * This file is scheduled for removal once every page body migrates to the
 * warm-paper shell in `src/ui/shell.ts`. Keep new work pointed at the shell;
 * only edit here to keep legacy pages functional until their migration lands.
 */

import { highlightHL7Message } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";
import {
  LEGACY_STYLES,
  HEALTH_CHECK_SCRIPT,
  HL7_TOOLTIP_SCRIPT,
  LOINC_AUTOCOMPLETE_SCRIPT,
} from "./legacy-assets";
import type { NavData } from "./shared";

export type { NavData };

export function highlightHL7WithDataTooltip(
  message: string | undefined,
): string {
  const html = highlightHL7Message(message);
  return html.replace(/\btitle="/g, 'data-tooltip="');
}

/** @deprecated Use NavKey from `./shell`. Deleted in Task 3c. */
export type NavTab =
  | "accounts"
  | "outgoing"
  | "incoming"
  | "mllp-client"
  | "mapping-tasks"
  | "code-mappings";

interface NavTabDef {
  id: NavTab;
  href: string;
  label: string;
  badge?: number;
}

function getEnvLabel(): string {
  return process.env.ENV || "dev";
}

function renderTab(tab: NavTabDef, active: NavTab): string {
  const isActive = active === tab.id;
  const classes = isActive
    ? "border-blue-500 text-blue-600 font-semibold"
    : "border-transparent text-gray-600 hover:text-gray-800";
  const badge =
    tab.badge && tab.badge > 0
      ? `<span class="px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">${tab.badge}</span>`
      : "";
  return `<a href="${tab.href}" class="py-4 px-3 border-b-2 flex items-center gap-2 ${classes}">${tab.label}${badge}</a>`;
}

/** @deprecated Use `renderShell` from `./shell`. Deleted in Task 3c. */
export function renderNav(active: NavTab, navData: NavData): string {
  // Order by demo flow: inbound pipeline first (messages arrive → simulator →
  // remediation), then outbound (accounts → BAR messages), then reference.
  // The "data direction" story lives in the dashboard pipeline diagram, not
  // here — nav is just navigation.
  const tabs: NavTabDef[] = [
    { id: "incoming", href: "/incoming-messages", label: "Inbound Messages" },
    { id: "mllp-client", href: "/simulate-sender", label: "Simulate Sender" },
    {
      id: "mapping-tasks",
      href: "/unmapped-codes",
      label: "Unmapped Codes",
      badge: navData.pendingMappingTasksCount,
    },
    { id: "accounts", href: "/accounts", label: "Accounts" },
    { id: "outgoing", href: "/outgoing-messages", label: "Outgoing Messages" },
    { id: "code-mappings", href: "/terminology", label: "Terminology Map" },
  ];

  const tabsHtml = tabs.map((tab) => renderTab(tab, active)).join("");

  const env = getEnvLabel();
  const envClass =
    env === "prod" || env === "production"
      ? "bg-red-100 text-red-700"
      : env === "staging" || env === "test"
        ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-600";

  const statusCluster = `
    <div class="flex items-center gap-3 text-xs">
      <span class="px-2 py-0.5 rounded font-medium uppercase tracking-wide ${envClass}">${env}</span>
      <span class="flex items-center gap-1.5 text-gray-500" title="Aidbox status (checking...)" data-health-tooltip>
        <span data-health-dot></span>
        <span data-health-label>Aidbox</span>
      </span>
    </div>`;

  return `
  <nav class="bg-white shadow mb-6">
    <div class="container mx-auto px-4 flex items-center">
      <div class="flex items-center flex-1 min-w-0 overflow-x-auto">
        ${tabsHtml}
      </div>
      ${statusCluster}
    </div>
  </nav>`;
}

/** @deprecated Use `renderShell` from `./shell`. Deleted in Task 3c. */
export function renderLayout(
  title: string,
  nav: string,
  content: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${LEGACY_STYLES}</style>
</head>
<body class="bg-gray-100 min-h-screen">
  ${nav}
  <div class="container mx-auto px-4 pb-8">
    ${content}
  </div>
  <script>
    ${HEALTH_CHECK_SCRIPT}
    ${HL7_TOOLTIP_SCRIPT}
    ${LOINC_AUTOCOMPLETE_SCRIPT}
  </script>
</body>
</html>`;
}
