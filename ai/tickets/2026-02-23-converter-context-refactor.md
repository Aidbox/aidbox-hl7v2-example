---
status: explored
reviewer-iterations: 0
prototype-files: []
---

# Design: Compose Converter Dependencies into ConverterContext

## Problem Statement

## Proposed Approach

## Key Decisions

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|

## Trade-offs

## Affected Components

| File | Change Type | Description |
|------|-------------|-------------|

## Technical Details

## Edge Cases and Error Handling

## Test Cases

| Test Case | Type | Description |
|-----------|------|-------------|

# Context

## Exploration Findings

### Current Converter Signatures

```typescript
// adt-a01.ts:289-292
export async function convertADT_A01(
  parsed: HL7v2Message,
  resolvePatientId: PatientIdResolver,
): Promise<ConversionResult>

// adt-a08.ts:87-90
export async function convertADT_A08(
  parsed: HL7v2Message,
  resolvePatientId: PatientIdResolver,
): Promise<ConversionResult>

// oru-r01.ts:911-916
export async function convertORU_R01(
  parsed: HL7v2Message,
  lookupPatient: PatientLookupFn = defaultPatientLookup,
  lookupEncounter: EncounterLookupFn = defaultEncounterLookup,
  resolvePatientId: PatientIdResolver,
): Promise<ConversionResult>
```

### Type Locations (Pre-Refactor)

- `PatientIdResolver` — `src/v2-to-fhir/identity-system/patient-id.ts:26-27`
- `PatientLookupFn` — `src/v2-to-fhir/messages/oru-r01.ts:70`
- `EncounterLookupFn` — `src/v2-to-fhir/messages/oru-r01.ts:94`
- `MpiClient` — `src/v2-to-fhir/identity-system/mpi-lookup.ts:17-39`
- `Hl7v2ToFhirConfig` — `src/v2-to-fhir/config.ts:24-29`

### Config Loading Pattern (Pre-Refactor)

Config is loaded **inside each converter** via `hl7v2ToFhirConfig()` (cached at process level). Not passed as a parameter currently.

### Call Sites in converter.ts

```typescript
// converter.ts ~line 95-102
switch (messageType) {
  case "ADT_A01": return await convertADT_A01(parsed, resolvePatientId);
  case "ADT_A08": return await convertADT_A08(parsed, resolvePatientId);
  case "ORU_R01": return await convertORU_R01(parsed, undefined, undefined, resolvePatientId);
}
```
`resolvePatientId` is created once via `defaultPatientIdResolver()`. ORU's lookup params passed as `undefined` (relying on defaults).

### Test Impact

**Unit tests with direct converter calls:**
- `test/unit/v2-to-fhir/messages/adt-a01.test.ts` — 3 calls: `convertADT_A01(parsed, defaultPatientIdResolver())`
- `test/unit/v2-to-fhir/messages/oru-r01.test.ts` — 4 calls: `convertORU_R01(parsed, noExistingPatient, noExistingEncounter, defaultPatientIdResolver())`

**Integration tests:** Not directly affected (go through processor-service).

### Directory Structure

```
src/v2-to-fhir/
├── converter.ts               (main router)
├── config.ts                  (config loader & types)
├── processor-service.ts       (polling service)
├── preprocessor.ts
├── preprocessor-registry.ts
├── identity-system/
│   ├── patient-id.ts          (PatientIdResolver, defaultPatientIdResolver)
│   ├── mpi-lookup.ts          (MpiClient)
│   └── encounter-id.ts
├── messages/
│   ├── adt-a01.ts
│   ├── adt-a08.ts
│   └── oru-r01.ts             (also contains PatientLookupFn, EncounterLookupFn)
├── segments/
└── datatypes/
```

## User Requirements & Answers

**Source:** `ai/tickets/awie_case/epics/00_03_converter_context_refactor.md`

**Feature:** Compose all converter runtime dependencies into a `ConverterContext` object so converters receive `(parsed, context)` instead of N individual parameters.

**Agreed decisions:**
- Include `config: Hl7v2ToFhirConfig` in ConverterContext (converters stop calling `hl7v2ToFhirConfig()` internally)
- Move `PatientLookupFn` and `EncounterLookupFn` type definitions to `converter-context.ts`
- New file: `src/v2-to-fhir/converter-context.ts` for the interface
- `lookupPatient` and `lookupEncounter` are required fields (not optional) — ADT converters simply won't destructure them

## AI Review Notes

## User Feedback
