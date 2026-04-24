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

For a classified action plan across all active errors (recommended when there are ≥3):

```sh
scripts/errors/triage.sh
```

Prints each error with a suggested class (auto-swap / fhir-422 / sender-missing / loinc-lookup / parsing-defer / aidbox-reject / other) and next command. Read-only — user still approves each fix.

Ask: **"Which error would you like me to investigate?"** Skip `deferred` rows unless the user explicitly asks.

## Step 2: Inspect one

```sh
scripts/errors/inspect-error.sh <id>
```

Emits: status, type, sender, full error, unmapped codes (if present), raw HL7v2 saved to `/tmp/hl7v2-<id>.hl7`, and an `hl7v2-inspect` overview for `parsing_error`/`conversion_error`. **You do not need to curl the resource yourself.**

For `HTTP 422` conversion errors the script also prints the **current values** of each candidate HL7v2 field, so you typically don't need an additional `hl7v2-inspect --field` call. For `per-1` (reversed period) it also emits a **ready-to-run** `wire-preprocessor.ts` command — just copy/run it. For `code_mapping_error` with any `observation-code-loinc` task, peer OBX rows are dumped automatically AND LOINC candidates are fetched via ValueSet/$expand on each localDisplay — you usually have everything needed to pick the right LOINC without another call.

Pick the playbook below by the `Status` line from Step 2.

## Step 3: Diagnose by status

### `parsing_error` — sender sent malformed HL7v2

1. From the inspect overview, identify what's wrong: missing MSH, invalid encoding chars (MSH-1/2), truncated segments, wrong line endings, embedded binary.
2. **No code/config fix.** Sender must correct the message format. Defer = resolved on our side — do it:
   ```sh
   scripts/errors/defer.sh <id>
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
     scripts/errors/defer.sh <id>
     ```
   - Workaround: add a preprocessor in `src/v2-to-fhir/preprocessor-registry.ts` + `config/hl7v2-to-fhir.json`
   - Last resort: relax config (make a segment optional) — warn about the tradeoff
3. If no clear fix (needs client decision, spec clarification) → defer as resolution (same command above).
4. **Wait for approval before implementing.** Then verify with `bun scripts/check-message-support.ts /tmp/hl7v2-<id>.hl7` before retrying.

#### Adding a preprocessor (recipe)

If the preprocessor **already exists** (check `scripts/errors/list-preprocessors.sh`), wire it in with one command — edits both config files atomically:

```sh
bun scripts/errors/wire-preprocessor.ts <msgType> <SEG> <FIELD> <preprocessorId> [paramsJson]

# Example:
bun scripts/errors/wire-preprocessor.ts ADT-A01 IN1 12 swap-if-reversed '{"a":12,"b":13}'
```

Idempotent — re-running with the same args is a no-op. The script adds the missing slot to `MessageTypeConfig.preprocess.<SEG>` in `src/v2-to-fhir/config.ts` and the JSON entry under the matching message type.

If a **new** preprocessor function is needed, write it manually first:

1. **`src/v2-to-fhir/preprocessor-registry.ts`** — add key + function to `SEGMENT_PREPROCESSORS`. Function receives the whole segment; the field key in config is only a trigger guard (preprocessor runs when that field is present, except `fallback-rxa3-from-msh7` which runs even when absent).
2. Then run `wire-preprocessor.ts` to wire it in.

### `code_mapping_error` — local code has no FHIR mapping

Inspect output lists each unmapped code with `localCode`, `localDisplay`, `localSystem`, `mappingType`, and `taskId`. Use the printed `taskId` for the resolve call.

1. For `observation-code-loinc`, `inspect-error.sh` already dumps LOINC candidates via ValueSet/$expand. For an ad-hoc search:
   ```sh
   scripts/errors/loinc-search.sh '<term>' [--count N]
   ```
   If no matches, the LOINC package isn't loaded — fall back to domain knowledge and cite the LOINC concept by name (e.g. peer OBX codes in the same message, unit of measure, and specimen type).
2. For `patient-class`, `obr-status`, `obx-status`, etc.: look up valid target values in `src/code-mapping/mapping-types.ts`.
3. Present suggestions with confidence: "High: `2823-3` → LOINC `2823-3` (Potassium)" vs "Needs review: `GLU` → `2345-7` (Glucose) — verify with lab".
4. If ambiguous / needs domain expertise → defer = park it out of active queue pending sender action:
   ```sh
   scripts/errors/defer.sh <id>
   ```
5. After approval, resolve via the app API. Message is auto-requeued.
   ```sh
   scripts/errors/resolve-mapping.sh <taskId> <resolvedCode> <resolvedDisplay>
   ```

### `sending_error` — Aidbox rejected the FHIR bundle

1. Check health: `curl -sf http://localhost:8080/health`
2. Read the error for rejection reason. If a `bundle` field is saved on the resource, inspect it for FHIR validation issues.
3. Common causes:
   - Aidbox was down → check now, offer retry
   - 422 validation → identify the failing resource + field, suggest fix (missing required, invalid code, terminology binding)
   - Timeout → usually transient, offer retry
4. If a structural fix is needed (init-bundle.json StructureDefinition, missing CodeSystem) — suggest it and wait for approval.

## Step 4: After a fix

One command chains verify → mark-for-retry → reprocess → status:

```sh
scripts/errors/verify-retry.sh <id>
```

Aborts if `check-message-support.ts` verdict is not `supported`. Status is printed via `scripts/errors/status.sh` (id/status/type/error/sender).

Use the individual commands below only when you need a partial step (e.g. verify without retrying):

```sh
bun scripts/check-message-support.ts /tmp/hl7v2-<id>.hl7
curl -sf -X POST 'http://localhost:3000/mark-for-retry/<id>'
curl -sf -X POST 'http://localhost:3000/process-incoming-messages'
scripts/errors/status.sh <id>
```

## Rules

- Summary first, then one error at a time.
- Never auto-fix without approval.
- Skip `deferred` rows in the summary unless the user asks about them.
- Don't hand-count pipes — the inspect script already ran `hl7v2-inspect.sh`. For deeper field lookup use `scripts/hl7v2-inspect.sh --field SEG.N`.
- Use the `hl7v2-info` skill to verify HL7v2 spec compliance when needed.

## Script reference

| Script | Purpose |
|---|---|
| `scripts/errors/list-errors.sh` | Active errors + deferred reminder (markdown table). |
| `scripts/errors/triage.sh` | Batch-classify all active errors → suggested action per row. Read-only. |
| `scripts/errors/inspect-error.sh <id>` | Full diagnosis: resource fields, saved raw file, hl7v2-inspect overview, 422 candidates w/ values + ready-to-run wire command for per-1, peer OBX + auto LOINC candidates for LOINC tasks. |
| `scripts/errors/status.sh <id>` | Concise `{id,status,type,error,sender}` for a single message. |
| `scripts/errors/verify-retry.sh <id>` | After a fix: verify → mark-for-retry → reprocess → status. Aborts if not supported. |
| `scripts/errors/defer.sh <id>` | Defer a message (park out of active queue) + print status. |
| `scripts/errors/loinc-search.sh <term>` | LOINC ValueSet/$expand wrapper. Prints `code — display` lines. |
| `scripts/errors/resolve-mapping.sh <taskId> <code> <display>` | Resolve a mapping task (form-urlencoded POST) + auto-requeue. |
| `scripts/errors/list-preprocessors.sh` | Available preprocessors w/ JSDoc summary. |
| `scripts/errors/wire-preprocessor.ts` | Wire a preprocessor into `config.ts` + `hl7v2-to-fhir.json` atomically. Idempotent. |
