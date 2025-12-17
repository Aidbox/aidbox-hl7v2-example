import type { CWE } from "../../hl7v2/generated/fields";
import type { Identifier } from "../../fhir/hl7-fhir-r4-core";

export interface DeviceName {
  name: string;
  type: "udi-label-name" | "user-friendly-name" | "patient-reported-name" | "manufacturer-name" | "model-name" | "other";
}

export interface Device {
  identifier?: Identifier[];
  deviceName?: DeviceName[];
}

export function convertCWEToDevice(cwe: CWE | undefined): Device | undefined {
  if (!cwe) return undefined;

  const identifiers: Identifier[] = [];
  const deviceNames: DeviceName[] = [];

  if (cwe.$1_code) {
    identifiers.push({
      value: cwe.$1_code,
      ...(cwe.$3_system && { system: cwe.$3_system }),
    });
  }

  if (cwe.$2_text) {
    deviceNames.push({
      name: cwe.$2_text,
      type: "user-friendly-name",
    });
  }

  if (cwe.$4_altCode) {
    identifiers.push({
      value: cwe.$4_altCode,
      ...(cwe.$6_altSystem && { system: cwe.$6_altSystem }),
    });
  }

  if (cwe.$5_altDisplay) {
    deviceNames.push({
      name: cwe.$5_altDisplay,
      type: "user-friendly-name",
    });
  }

  if (cwe.$9_originalText) {
    deviceNames.push({
      name: cwe.$9_originalText,
      type: "other",
    });
  }

  if (identifiers.length === 0 && deviceNames.length === 0) return undefined;

  return {
    ...(identifiers.length > 0 && { identifier: identifiers }),
    ...(deviceNames.length > 0 && { deviceName: deviceNames }),
  };
}
