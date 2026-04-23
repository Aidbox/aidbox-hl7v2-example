/**
 * HL7 highlight helper used by page bodies that render the raw message.
 *
 * Converts the `@atomic-ehr/hl7v2` highlighter's default `title="…"` segment
 * tooltips into `data-tooltip="…"` attributes so the design system can wire up
 * a styled hover tooltip without triggering the browser's native tooltip.
 *
 * This module is the only remaining piece of the old Tailwind-era layout file
 * `src/ui/shared-layout.ts` (renamed 2026-04-23, Task 13).
 */

import { highlightHL7Message } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";

export function highlightHL7WithDataTooltip(
  message: string | undefined,
): string {
  const html = highlightHL7Message(message);
  return html.replace(/\btitle="/g, 'data-tooltip="');
}
