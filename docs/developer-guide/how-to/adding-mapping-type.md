# Adding a New Mapping Type

This guide explains how to add support for a new HL7v2 field mapping type to the code mapping system.

## Background

The code mapping system handles HL7v2 fields that cannot be automatically converted to valid FHIR values. When an unmapped code is encountered during message processing. Each mapping type defines how a specific HL7v2 field maps to a FHIR target field. See more details in the [Code Mapping](../code-mapping.md).

## Steps

### 1. Register the type in the mapping types registry

The mapping types registry is the single source of truth for all mapping type configuration.

Edit `src/code-mapping/mapping-types.ts`:

```typescript
export const MAPPING_TYPES = {
  // ... existing types
  "new-type": {
    source: { segment: "XXX", field: N },       // HL7v2 segment and field position
    target: { resource: "Resource", field: "field" }, // FHIR resource and field path
    targetSystem: "http://hl7.org/fhir/...",    // FHIR code system URI
  },
};
```

Display labels are derived automatically from structured metadata:
- Source label (e.g., `"XXX-N"`) via `sourceLabel(config)`
- Target label (e.g., `"Resource.field"`) via `targetLabel(config)`

The mapping type name (key) is used to generate the ConceptMap ID:
`hl7v2-{sendingApplication}-{sendingFacility}-{mappingType}`

### 2. Add valid values in the options registry

If your mapping type has a fixed set of valid values, add them to `src/code-mapping/mapping-type-options.ts`:

```typescript
const VALID_VALUES: Partial<Record<MappingTypeName, Record<string, string>>> = {
  // ... existing types
  "new-type": {
    code1: "Display Name 1",
    code2: "Display Name 2",
    // ...
  },
};
```

For types with free-form input (like LOINC), omit the entry - any non-empty code will be accepted.

### 3. Update the converter to detect mapping errors

In the relevant segment converter (e.g., `src/v2-to-fhir/segments/xxx.ts`):

- Detect when a code cannot be mapped automatically
- Return a `MappingError` with the local code info and mapping type
- Collect errors using `buildMappingErrorResult()` from `mapping-errors.ts`

Example:

```typescript
import { type MappingError } from "../../code-mapping/mapping-errors";

function convertField(value: string): string | MappingError {
  const mapped = MAP[value];
  if (!mapped) {
    return {
      localCode: value,
      localDisplay: `XXX-N: ${value}`,  // Optional — shown in mapping task UI
      localSystem: "http://terminology.hl7.org/CodeSystem/v2-xxxx",
      mappingType: "new-type",
    };
  }
  return mapped;
}
```

### 4. Update UI (if needed)

The filter tabs update automatically from the registry. However, you may need to:

- Add type-specific input controls in the task resolution form
- Update dropdown styling or layout for new value sets

## Fail-Fast Behavior

The system uses fail-fast validation throughout the mapping pipeline:

1. **Type Name Lookup**: `getMappingTypeOrFail(typeName)` throws if the type name is not in the registry
2. **Mapping Task Creation**: `createMappingTask()` throws if `localSystem` is missing
3. **Task ID Generation**: `generateMappingTaskId()` throws if `localSystem` or `localCode` is empty

This ensures that:
- Configuration errors are caught immediately during development
- Missing or invalid mapping types fail loudly instead of silently corrupting data
- New mapping types must be properly configured before use

If you add a new mapping type but forget to add it to the registry, you'll get a clear error like:
```
Unknown mapping type: new-type. Valid types: observation-code-loinc, patient-class, obr-status, obx-status
```

## See Also

- [Code Mapping](../code-mapping.md) - Overview of the code mapping system
- [ORU Processing](../oru-processing.md) - How ORU messages trigger code mapping
