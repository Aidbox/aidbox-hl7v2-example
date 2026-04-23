/**
 * HL7 highlight helper used by page bodies that render the raw message.
 *
 * Historically this file also held the Tailwind `renderLayout` / `renderNav`
 * scaffolding. Those were replaced by `./shell` and deleted in Task 3c; only
 * the highlight helper remains.
 */

import { highlightHL7Message } from "@atomic-ehr/hl7v2/src/hl7v2/highlight";

export function highlightHL7WithDataTooltip(
  message: string | undefined,
): string {
  const html = highlightHL7Message(message);
  return html.replace(/\btitle="/g, 'data-tooltip="');
}
