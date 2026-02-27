/**
 * Wrappers for HL7v2 segment parsers.
 *
 * Includes fixes for auto-generated parsers (OBX) and manual parsers
 * for segments not in the generated types (RXO — ORM retired pre-v2.8.2).
 */

export { fromOBX } from "./obx";
export { fromRXO, type RXO } from "./rxo";
