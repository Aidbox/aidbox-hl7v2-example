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
2. **No code/config fix.** Sender must correct the message format.
3. Offer to defer if it needs sender coordination: `POST http://localhost:3000/defer/<id>`.
4. Only mark for retry if the sender has already fixed and will resend with the same ID.

### `conversion_error` — parsed OK, missing/invalid data for FHIR

1. Read the error field. Common cases:
   - **PV1-19 missing/empty:** check if PID-18 (account number) can be a fallback
   - **PV1 required but absent:** check config for this message type
   - **PV1-19 authority conflict:** check CX.4/9/10 values
   - **PID missing:** sender issue
   - **Unsupported message type:** check MSH-9
2. Suggest fixes in this order:
   - Best: sender populates the missing field — explain what's needed
   - Workaround: add a preprocessor in `src/v2-to-fhir/preprocessor-registry.ts` + `config/hl7v2-to-fhir.json`
   - Last resort: relax config (make a segment optional) — warn about the tradeoff
3. If no clear fix (needs sender coordination, client decision, spec clarification) → offer to defer.
4. **Wait for approval before implementing.** Then verify with `bun scripts/check-message-support.ts /tmp/hl7v2-<id>.hl7` before retrying.

### `code_mapping_error` — local code has no FHIR mapping

Inspect output lists each unmapped code with `mappingType`.

1. For `observation-code-loinc`, search LOINC by display text:
   ```sh
   SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' docker-compose.yaml)
   curl -sf -u "root:$SECRET" 'http://localhost:8080/api/terminology/loinc?q=<term>'
   ```
2. For `patient-class`, `obr-status`, `obx-status`, etc.: look up valid target values in `src/code-mapping/mapping-types.ts`.
3. Present suggestions with confidence: "High: `2823-3` → LOINC `2823-3` (Potassium)" vs "Needs review: `GLU` → `2345-7` (Glucose) — verify with lab".
4. If ambiguous / needs domain expertise → offer to defer.
5. After approval, resolve via the app API:
   ```sh
   curl -sf -X POST 'http://localhost:3000/api/mapping/tasks/<taskId>/resolve' \
     -H 'Content-Type: application/json' \
     -d '{"code":"<target>","display":"<target display>"}'
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
- Skip `deferred` unless the user asks about them.
- To defer: `curl -sf -X POST 'http://localhost:3000/defer/<id>'`.
- Don't hand-count pipes — the inspect script already ran `hl7v2-inspect.sh`. For deeper field lookup use `scripts/hl7v2-inspect.sh --field SEG.N`.
- Use the `hl7v2-info` skill to verify HL7v2 spec compliance when needed.
