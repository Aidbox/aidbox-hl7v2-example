/**
 * FHIR transaction bundle entry construction.
 */

import type { BundleEntry, Resource } from "../fhir/hl7-fhir-r4-core";

export function createBundleEntry(resource: Resource, method: "PUT" | "POST" = "PUT"): BundleEntry {
  const resourceType = resource.resourceType;
  const id = (resource as { id?: string }).id;

  return {
    resource,
    request: {
      method,
      url: id ? `${resourceType}/${id}` : `${resourceType}`,
    },
  };
}
