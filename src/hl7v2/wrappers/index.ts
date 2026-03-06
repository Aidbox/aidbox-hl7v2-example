/**
 * Wrappers for HL7v2 segment parsers.
 *
 * Includes fixes for auto-generated parsers (OBX).
 */

export { fromOBX } from "./obx";
export type { WrappedOBX } from "./obx";
export { groupVXUOrders, extractPersonObservations } from "./vxu-v04";
export type { VXUOrderGroup } from "./vxu-v04";
