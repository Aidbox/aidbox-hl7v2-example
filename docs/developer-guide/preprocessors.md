# Preprocessors

Preprocessors are the first stage of the HL7v2 -> FHIR pipeline. They run on parsed HL7 segments before message
conversion and normalize sender data into shapes the converter can safely consume.

Source files:
- `src/v2-to-fhir/preprocessor.ts`
- `src/v2-to-fhir/preprocessor-registry.ts`
- `config/hl7v2-to-fhir.json`

## Architecture

### What a preprocessor is

A preprocessor is a function with this contract:

```ts
(context: PreprocessorContext, segment: HL7v2Segment) => void
```

- Input is the parsed message context and one segment.
- Output is in-place mutation of that segment (or no-op).
- Preprocessors are registered by ID in `SEGMENT_PREPROCESSORS`.

### How preprocessing is configured

Configuration is message-type-specific and field-scoped:

```json
{
  "messages": {
    "VXU-V04": {
      "preprocess": {
        "RXA": { "6": ["normalize-rxa6-dose"], "9": ["normalize-rxa9-nip001"] }
      }
    }
  }
}
```

- `messages.<TYPE>.preprocess.<SEGMENT>.<FIELD>` is a list of preprocessor IDs.
- IDs are validated at config load (`hl7v2ToFhirConfig`).
- Unknown IDs fail fast at startup.

## How To Add A New Preprocessor

1. Implement function in `src/v2-to-fhir/preprocessor-registry.ts`.
2. Register ID in `SEGMENT_PREPROCESSORS`.
3. If using a new segment/field key, extend `MessageTypeConfig.preprocess` typing in
   `src/v2-to-fhir/config.ts`.
4. Add config entry in `config/hl7v2-to-fhir.json` (or sender-specific config).
5. Add unit tests in `test/unit/v2-to-fhir/preprocessor.test.ts`.
6. Add config validation tests in `test/unit/v2-to-fhir/config.test.ts` if config behavior changes.
7. Run `bun test:all` and `bun run typecheck`.

## Architectural Principle: Preprocessors Normalize, Converter Stays Honest

Primary boundary:
- Preprocessors should normalize representation of data the sender actually sent.
- Preprocessors should not silently fabricate clinical meaning.

Explicit exception:
- `fallback-rxa3-from-msh7` crosses the boundary by fabricating administration datetime from message send time.
- It exists as a pragmatic escape hatch for non-compliant senders.

# Preprocessor Catalog

### `move-pid2-into-pid3`
- Scope: `PID.2`
- Purpose: Migrate identifier from deprecated/legacy PID-2 into PID-3 repeats.
- Behavior:
  - If PID-2 has non-empty `CX.1`, append PID-2 to PID-3.
  - Clears PID-2 afterward.
  - No-op if PID-2 empty.
- Config:

```json
"PID": { "2": ["move-pid2-into-pid3"] }
```

### `inject-authority-from-msh`
- Scope: `PID.3`
- Purpose: Fill missing assigning authority for PID-3 identifiers.
- Behavior:
  - For each PID-3 CX repeat with `CX.1` and no authority (`CX.4/9/10`), inject namespace from `MSH-3/4` into
    `CX.4.1`.
  - Never overrides existing authority.
  - No-op if MSH namespace unavailable.
- Config:

```json
"PID": { "3": ["inject-authority-from-msh"] }
```

### `fix-pv1-authority-with-msh`
- Scope: `PV1.19`
- Purpose: Ensure Encounter identifier authority exists for PV1 visit number.
- Behavior:
  - If PV1-19 has value but missing authority (`CX.4/9/10`), inject `CX.4.1` namespace from `MSH-3/4`.
  - Never overrides existing authority.
  - No-op when PV1-19 empty or namespace unavailable.
- Config:

```json
"PV1": { "19": ["fix-pv1-authority-with-msh"] }
```

### `inject-authority-into-orc3`
- Scope: `ORC.3`
- Purpose: Prevent cross-sender collisions for ORC filler order identifiers used in deterministic Immunization IDs.
- Behavior:
  - If ORC-3 EI has `EI.1` but empty authority (`EI.2` and `EI.3`), inject namespace into `EI.2`.
  - Never overrides existing namespace/universal ID.
- Config:

```json
"ORC": { "3": ["inject-authority-into-orc3"] }
```

### `normalize-rxa6-dose`
- Scope: `RXA.6`
- Purpose: Normalize administered dose amount.
- Behavior:
  - `"999"` sentinel -> clear RXA-6.
  - Numeric strings (including `"0"`) stay unchanged.
  - Embedded unit format like `"0.3 mL"` -> RXA-6 becomes numeric part, RXA-7 gets unit when RXA-7 is empty.
  - Unparseable values are cleared with warning.
- Config:

```json
"RXA": { "6": ["normalize-rxa6-dose"] }
```

### `normalize-rxa9-nip001`
- Scope: `RXA.9`
- Purpose: Repair missing coding system for CDC IIS NIP001 administration notes.
- Behavior:
  - For each RXA-9 repeat with code `00` or `01` and empty `CWE.3`, inject `NIP001`.
  - Does not modify other codes or entries with existing coding system.
- Config:

```json
"RXA": { "9": ["normalize-rxa9-nip001"] }
```

### `fallback-rxa3-from-msh7`
- Scope: `RXA.3`
- Purpose: Escape hatch for broken senders that omit required administration datetime.
- Behavior:
  - If RXA-3 is empty and MSH-7 exists, copy MSH-7 into RXA-3.
  - Logs warning: this fallback is clinically incorrect.
  - If MSH-7 missing, no-op (converter still errors naturally).
- Config:

```json
"RXA": { "3": ["fallback-rxa3-from-msh7"] }
```

Recommendation:
- Keep `fallback-rxa3-from-msh7` disabled by default.
- Enable only for specific senders that cannot be fixed upstream.
