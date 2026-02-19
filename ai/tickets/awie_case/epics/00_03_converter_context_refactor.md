# Refactoring: Compose Converter Dependencies into ConverterContext

**Discovered during:** Epic 0.1 (Cross-EHR Patient & Encounter Identity) design

---

## Problem

Each converter function (`convertADT_A01`, `convertADT_A08`, `convertORU_R01`) receives a growing set of injected dependencies as individual parameters:

```typescript
// oru-r01.ts — already has 4 parameters
convertORU_R01(
  parsed: ParsedMessage,
  config: Hl7v2ToFhirConfig,
  patientLookup: PatientLookupFn,
  encounterLookup: EncounterLookupFn,
  mpiClient: MpiClient,  // added by 0.1
): Promise<ConversionResult>
```

This will only grow. Upcoming features add:
- `PatientIdResolver` (from 0.1)
- Potentially code mapping clients, terminology resolvers, etc.

Passing 5–7 individual parameters to every converter is fragile (parameter order matters, easy to miss a parameter, hard to add new dependencies without updating all call sites).

## Proposed Solution

Compose all runtime dependencies into a `ConverterContext` object:

```typescript
interface ConverterContext {
  config: Hl7v2ToFhirConfig;
  resolvePatientId: PatientIdResolver;
  lookupPatient: PatientLookupFn;
  lookupEncounter: EncounterLookupFn;
  // future: resolveLoincCode, resolveConditionCode, etc.
}
```

All converters receive `(parsed: ParsedMessage, context: ConverterContext)`.

`converter.ts` constructs `ConverterContext` once per `convertToFHIR()` call and passes it to all converter functions. Adding a new dependency only requires:
1. Adding to `ConverterContext` interface
2. Constructing it in `converter.ts`
3. No changes to individual converter call sites

## Scope

- Define `ConverterContext` interface in a new file (e.g., `src/v2-to-fhir/converter-context.ts`)
- Migrate `convertADT_A01`, `convertADT_A08`, `convertORU_R01` to accept `context: ConverterContext`
- Update `converter.ts` to construct context and pass it
- Update all tests that call converters directly (mock context instead of individual params)

## Dependencies

- Epic 0.1 must be implemented first (adds `PatientIdResolver` to the param list — good time to consolidate)

## Benefits

- Adding new dependencies is a single-point change (interface + constructor in `converter.ts`)
- Test setup is cleaner (one mock object instead of N parameters)
- Parameter order errors become impossible
