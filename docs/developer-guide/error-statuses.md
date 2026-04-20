# Error Statuses

IncomingHL7v2Message uses distinct error statuses to classify failures at each pipeline step. This makes triage immediate: the status tells you what failed and how to fix it.

## Status Overview

| Status | Pipeline Step | Cause | Resolution |
|--------|--------------|-------|------------|
| `received` | - | Awaiting processing | Automatic |
| `processed` | - | Successfully converted and submitted | Done |
| `warning` | Step 5 (Convert) | Converted with non-fatal issues (e.g., optional PV1 missing) | Review recommended |
| `parsing_error` | Step 2 (Parse) | Malformed HL7v2, bad encoding, truncated message | Fix at sender, resend |
| `conversion_error` | Step 5 (Convert) | Valid HL7v2 but missing/invalid data for FHIR conversion | Fix sender data or adjust config, then retry |
| `code_mapping_error` | Step 5 (Convert) | Code exists but no FHIR mapping available | Resolve mapping Task, message auto-requeued |
| `sending_error` | Step 6 (Submit) | Aidbox rejected the bundle or was unreachable | Auto-retried 3 times; if persistent, fix Aidbox or data |

## Pipeline Steps

```
MLLP receive
    |
    v
IncomingHL7v2Message { status: "received" }
    |
    v
Step 2: parseMessage()          -- failure --> parsing_error
    |
    v
Step 3: preprocessMessage()
    |
    v
Step 5: convertToFHIR()         -- failure --> conversion_error
    |                            -- unmapped code --> code_mapping_error
    v
Step 6: submitBundle()           -- failure --> sending_error (auto-retry x3)
    |
    v
status: "processed" | "warning"
```

## Error Resolution Flows

### Parsing Error

```
Message arrives --> parseMessage() throws --> status = parsing_error
```

**Cause:** The raw HL7v2 string is malformed and cannot be parsed into segments/fields.

**Resolution:** The sender must fix the message format and resend. Mark for Retry is available but will fail again with the same data.

**Examples:**
- Empty message body
- Truncated message (incomplete segments)
- Invalid encoding characters

### Conversion Error

```
Message parses OK --> converter returns status = conversion_error
```

**Cause:** The message parsed successfully but is missing required data or contains invalid values for FHIR conversion.

**Resolution options:**
1. Sender fixes the data and resends
2. Admin adjusts config (e.g., set `PV1.required = false`) then clicks Mark for Retry
3. Admin adds a preprocessor rule to fix the data, then clicks Mark for Retry

**Examples:**
- PV1-19 (Visit Number) required but missing
- PID segment missing
- PV1-19 authority conflict (CX.4/9/10)
- Unsupported message type

### Code Mapping Error

```
Message parses OK --> converter finds unmapped code --> status = code_mapping_error
                                                   --> Task resources created
```

**Cause:** A code in the message (e.g., patient class, OBX observation code, OBR status) has no mapping to a valid FHIR value. A FHIR Task is created for each unmapped code.

**Resolution:** User resolves the mapping Task via `/mapping/tasks` UI. When all Tasks for a message are resolved, the message is automatically requeued as `received` for reprocessing.

**Examples:**
- Non-standard PV1-2 Patient Class code
- OBX-3 code not in LOINC and no ConceptMap entry
- Unknown OBR-25 or OBX-11 status code

### Sending Error

```
Message converts OK --> submitBundle() fails --> auto-retry (up to 3 attempts)
                                             --> if all fail: status = sending_error
```

**Cause:** The FHIR transaction bundle was built successfully but Aidbox rejected it or was unreachable.

**Auto-retry behavior:**
- On first failure: message is reset to `received` with error context `"Sending failed (attempt 1/3): <error>"`
- On second failure: same, with `"Sending failed (attempt 2/3): <error>"`
- On third failure: status set to permanent `sending_error`; the built bundle is saved for inspection

**Resolution options:**
1. If Aidbox was temporarily down: it auto-recovers via retry
2. If persistent (e.g., FHIR validation error): fix Aidbox config or investigate the bundle, then Mark for Retry

**Examples:**
- Aidbox unreachable (network error, container down)
- Request timeout
- 422 Unprocessable Entity (FHIR validation failure)
