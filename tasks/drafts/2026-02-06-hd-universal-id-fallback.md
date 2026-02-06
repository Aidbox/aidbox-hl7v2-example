---
status: draft
---

# Draft: HD Universal ID Fallback for Missing Namespaces

## Problem Statement

The HD (Hierarchic Designator) datatype in HL7v2 allows two identification mechanisms:
1. **Namespace ID (HD.1)** - Local identifier, e.g., `LAB`
2. **Universal ID + Type (HD.2+HD.3)** - Globally unique OID/URI, e.g., `^2.16.840.1.113883.19^ISO`

Per the HL7 spec, namespace (HD.1) is optional if Universal ID is present. Valid HD values include:
- `LAB` - namespace only
- `^2.16.840.1.113883.19^ISO` - universal ID only (no namespace)
- `LAB^2.16.840.1.113883.19^ISO` - both

Currently, the codebase assumes namespaces are always present:

1. **SenderContext** (in `src/code-mapping/concept-map/service.ts`):
   ```ts
   const sendingApplication = msh.$3_sendingApplication?.$1_namespace;
   const sendingFacility = msh.$4_sendingFacility?.$1_namespace;
   if (!sendingApplication || !sendingFacility) {
     throw new Error("MSH-3 and MSH-4 are required");
   }
   ```

2. **Preprocessor** (in `src/v2-to-fhir/preprocessor-registry.ts`):
   ```ts
   const namespace = namespaceParts.length > 0 ? namespaceParts.join("-") : undefined;
   if (!namespace) {
     return segment; // Silently skips - should fallback to Universal ID
   }
   ```

## Affected Components

| File | Issue |
|------|-------|
| `src/code-mapping/concept-map/service.ts` | `SenderContext` requires namespace, throws if missing |
| `src/v2-to-fhir/messages/adt-a01.ts` | Extracts only `$1_namespace`, fails if missing |
| `src/v2-to-fhir/messages/oru-r01.ts` | Extracts only `$1_namespace`, fails if missing |
| `src/v2-to-fhir/preprocessor-registry.ts` | Silently skips if namespace missing |

## Proposed Solution

1. Create a helper function to extract identifier from HD, with fallback:
   ```ts
   function extractHdIdentifier(hd: HD | undefined): string | undefined {
     // Prefer namespace (human-readable)
     if (hd?.$1_namespace) return hd.$1_namespace;
     // Fallback to Universal ID
     if (hd?.$2_system) return hd.$2_system;
     return undefined;
   }
   ```

2. Update all places that extract MSH-3/MSH-4 to use this helper.

3. For ConceptMap IDs, decide whether to use the raw Universal ID or format it differently (OIDs contain dots which may need encoding).

## Open Questions

- Should the ConceptMap ID format change when using Universal ID vs namespace?
- How to handle mixed cases (MSH-3 has namespace, MSH-4 has only Universal ID)?
- Should we warn/log when falling back to Universal ID?

## References

- [HD datatype specification](https://www.hl7.eu/refactored/dtHD.html)
- [MSH segment definition](https://hl7.eu/refactored/segMSH.html)
