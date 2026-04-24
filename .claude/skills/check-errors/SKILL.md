---
name: check-errors
description: Check recent HL7v2 processing errors in Aidbox, diagnose root causes, suggest fixes. Use when asked to check errors, diagnose failures, or troubleshoot message processing.
---

# Check HL7v2 Processing Errors

Diagnose and help resolve `IncomingHL7v2Message` errors from the HL7v2→FHIR pipeline. Work iteratively — summary first, one error at a time, never auto-fix without approval.

## Step 1: Summary

```sh
scripts/errors/list-errors.sh
```

Emits a markdown table of active errors plus a deferred-count reminder. If output is `No active errors. No deferred messages.`, stop — say so and exit.

If the user asked specifically about deferred messages, use `scripts/errors/list-errors.sh --deferred`.

Ask: **"Which error would you like me to investigate?"** Skip `deferred` rows unless the user explicitly asks.

## Step 2: Inspect one

```sh
scripts/errors/inspect-error.sh <id>
```

Emits: status, type, sender, full error, unmapped codes (if present), raw HL7v2 saved to `/tmp/hl7v2-<id>.hl7`, and an `hl7v2-inspect` overview for `parsing_error`/`conversion_error`. **You do not need to curl the resource yourself.**

Pick the playbook below by the `Status` line from Step 2.

## Step 3: Diagnose by status

### `parsing_error` — sender sent malformed HL7v2

1. From the inspect overview, identify what's wrong: missing MSH, invalid encoding chars (MSH-1/2), truncated segments, wrong line endings, embedded binary.
2. **No code/config fix.** Sender must correct the message format. Defer = resolved on our side — do it:
   ```sh
   curl -sf -X POST 'http://localhost:3000/defer/<id>'
   ```
3. Only mark for retry if the sender has already fixed and will resend with the same ID.

### `conversion_error` — parsed OK, missing/invalid data for FHIR

1. Read the error field. Common cases:
   - **`HTTP 422` prefix:** Aidbox rejected the FHIR bundle — treat as an Aidbox validation failure (see sub-case below).
   - **PV1-19 missing/empty:** check if PID-18 (account number) can be a fallback
   - **PV1 required but absent:** check config for this message type
   - **PV1-19 authority conflict:** check CX.4/9/10 values
   - **PID missing:** sender issue
   - **Unsupported message type:** check MSH-9

#### Sub-case: `conversion_error` with `HTTP 422` (Aidbox FHIR validation rejection)

Do **not** run `hl7v2-inspect --values` unless the mapping is ambiguous. Diagnose from the OperationOutcome alone:

1. Parse `expression` → FHIR resource + field (e.g. `Coverage.period` → `per-1`).
2. Look up the V2-to-FHIR IG mapping CSV in `specs/v2-to-fhir/mappings/segments/` → identify the HL7v2 source segment/field (e.g. `Coverage.period.start` ← IN1-12, `.end` ← IN1-13).
3. State the fix directly from the constraint + field identity. Only run `hl7v2-inspect --values` when multiple HL7v2 fields feed the same FHIR field and the specific trigger is unclear.

2. Suggest fixes in this order:
   - Best: sender populates the missing field — explain what's needed; defer = park it out of active queue pending sender action:
     ```sh
     curl -sf -X POST 'http://localhost:3000/defer/<id>'
     ```
   - Workaround: add a preprocessor in `src/v2-to-fhir/preprocessor-registry.ts` + `config/hl7v2-to-fhir.json`
   - Last resort: relax config (make a segment optional) — warn about the tradeoff
3. If no clear fix (needs client decision, spec clarification) → defer as resolution (same command above).
4. **Wait for approval before implementing.** Then verify with `bun scripts/check-message-support.ts /tmp/hl7v2-<id>.hl7` before retrying.

#### Adding a preprocessor (recipe)

Three files, in order:

1. **`src/v2-to-fhir/preprocessor-registry.ts`** — add key + function to `SEGMENT_PREPROCESSORS`. Function receives the whole segment; the field key in config is only a trigger guard (preprocessor runs when that field is present, except `fallback-rxa3-from-msh7` which runs even when absent).
2. **`src/v2-to-fhir/config.ts`** — add the field slot to `MessageTypeConfig.preprocess.<SEG>` (e.g. `IN1?: { "12"?: SegmentPreprocessorId[] }`).
3. **`config/hl7v2-to-fhir.json`** — add the entry under the relevant message type. Use the `Read` tool for this file — `bun -e` and `python3` fail on JSONC comments.

### `code_mapping_error` — local code has no FHIR mapping

Inspect output lists each unmapped code with `localCode`, `localDisplay`, `localSystem`, `mappingType`, and `taskId`. Use the printed `taskId` for the resolve call.

1. For `observation-code-loinc`, search LOINC via Aidbox's ValueSet/$expand (the `/api/terminology/*` path does not exist):
   ```sh
   SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' docker-compose.yaml)
   TERM=$(printf '%s' '<term>' | jq -sRr @uri)
   curl -sf -u "root:$SECRET" "http://localhost:8080/fhir/ValueSet/\$expand?url=http://loinc.org/vs&filter=${TERM}&count=10" \
     | jq '.expansion.contains[] | {code, display}'
   ```
   If the LOINC package is not loaded locally, `.expansion.contains` will be empty — fall back to domain knowledge and cite the LOINC concept by name (e.g. peer OBX codes in the same message, unit of measure, and specimen type).
2. For `patient-class`, `obr-status`, `obx-status`, etc.: look up valid target values in `src/code-mapping/mapping-types.ts`.
3. Present suggestions with confidence: "High: `2823-3` → LOINC `2823-3` (Potassium)" vs "Needs review: `GLU` → `2345-7` (Glucose) — verify with lab".
4. If ambiguous / needs domain expertise → defer = park it out of active queue pending sender action:
   ```sh
   curl -sf -X POST 'http://localhost:3000/defer/<id>'
   ```
5. After approval, resolve via the app API. Endpoint expects **form-urlencoded** body with `resolvedCode` and `resolvedDisplay` (not JSON). A `302` redirect to `/unmapped-codes?saved=...&replayed=N` signals success:
   ```sh
   curl -s -X POST 'http://localhost:3000/api/mapping/tasks/<taskId>/resolve' \
     --data-urlencode 'resolvedCode=<target>' \
     --data-urlencode 'resolvedDisplay=<target display>' \
     -D - -o /dev/null
   ```
   Message is auto-requeued.

### `sending_error` — Aidbox rejected the FHIR bundle

1. Check health: `curl -sf http://localhost:8080/health`
2. Read the error for rejection reason. If a `bundle` field is saved on the resource, inspect it for FHIR validation issues.
3. Common causes:
   - Aidbox was down → check now, offer retry
   - 422 validation → identify the failing resource + field, suggest fix (missing required, invalid code, terminology binding)
   - Timeout → usually transient, offer retry
4. If a structural fix is needed (init-bundle.json StructureDefinition, missing CodeSystem) — suggest it and wait for approval.

## Step 4: After a fix

1. Verify locally:
   ```sh
   bun scripts/check-message-support.ts /tmp/hl7v2-<id>.hl7
   ```
   Only proceed when verdict is `supported` or `supported with caveats`.
2. Mark for retry (app endpoint, not Aidbox):
   ```sh
   curl -sf -X POST 'http://localhost:3000/mark-for-retry/<id>'
   ```
3. Trigger reprocessing:
   ```sh
   curl -sf -X POST 'http://localhost:3000/process-incoming-messages'
   ```
4. Re-check status:
   ```sh
   SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' docker-compose.yaml)
   curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/IncomingHL7v2Message/<id>?_elements=id,status,error' | jq
   ```
5. Report result.

## Rules

- Summary first, then one error at a time.
- Never auto-fix without approval.
- Skip `deferred` rows in the summary unless the user asks about them.
- Don't hand-count pipes — the inspect script already ran `hl7v2-inspect.sh`. For deeper field lookup use `scripts/hl7v2-inspect.sh --field SEG.N`.
- Use the `hl7v2-info` skill to verify HL7v2 spec compliance when needed.
