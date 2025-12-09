/**
 * BAR Message Generation Module
 *
 * Generates HL7v2 BAR (Billing Account Record) messages from FHIR resources.
 *
 * @example
 * ```ts
 * import { generateBarMessage, formatMessage } from "./bar";
 *
 * const barMessage = generateBarMessage({
 *   patient,
 *   account,
 *   encounter,
 *   coverages,
 *   messageControlId: "MSG001",
 *   triggerEvent: "P01",
 * });
 *
 * const hl7String = formatMessage(barMessage);
 * ```
 */

export { generateBarMessage } from "./generator";
export type { BarMessageInput } from "./generator";
export type {
  Patient,
  Account,
  Encounter,
  Coverage,
  RelatedPerson,
  Organization,
  Practitioner,
  Condition,
  Procedure,
} from "./types";
export {
  createBarMessageSenderService,
  pollPendingMessage,
  sendAsIncomingMessage,
  markAsSent,
  processNextMessage,
} from "./sender-service";
export type { OutgoingBarMessage, IncomingHL7v2Message } from "./sender-service";
export {
  createInvoiceBarBuilderService,
  pollDraftInvoice,
  buildBarFromInvoice,
  processNextInvoice,
} from "./invoice-builder-service";
