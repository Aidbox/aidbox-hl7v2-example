---
name: check-errors
description: Check recent HL7v2 processing errors in Aidbox, diagnose root causes, and suggest fixes. Use when asked to check errors, diagnose failures, or troubleshoot message processing.
---

# Check HL7v2 Processing Errors

Diagnose and help resolve IncomingHL7v2Message errors from the HL7v2→FHIR pipeline.

## Prerequisites

All Aidbox requests below follow the `aidbox-request` skill pattern. Extract the secret once at the start of the session and keep `$SECRET` in the shell:

```sh
SECRET=$(awk -F': ' '/^[[:space:]]*BOX_ROOT_CLIENT_SECRET:/ {print $2}' docker-compose.yaml)
```

If `$SECRET` is empty, stop and tell the developer: `BOX_ROOT_CLIENT_SECRET` is missing from `docker-compose.yaml`. Do not guess or hardcode a fallback.

Requests to the app (`http://localhost:3000`) are separate — no auth needed.

## Step 1: Query errors from Aidbox

Run this command to get a summary of recent errors:

```bash
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/IncomingHL7v2Message?status=parsing_error,conversion_error,code_mapping_error,sending_error&_sort=-_lastUpdated&_count=20&_elements=id,status,type,error,sendingApplication,sendingFacility,meta' | python -m json.tool
```

If the user asked about a specific error or message ID, query that directly:
```bash
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/IncomingHL7v2Message/<ID>' | python -m json.tool
```

## Step 2: Present a summary

Show the developer a table of errors grouped by status:

```
| # | Status | Type | Sender | Error (truncated) | ID |
```

Also query deferred messages to remind the developer:

```bash
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/IncomingHL7v2Message?status=deferred&_sort=-_lastUpdated&_count=20&_elements=id,status,type,error,sendingApplication,sendingFacility,meta' | python -m json.tool
```

If there are deferred messages, add a reminder line after the error table:

> **Deferred (N):** N messages are waiting on external input. Use `/check-errors deferred` to review them.

Don't investigate deferred messages unless the developer explicitly asks. They are reminders, not action items.

Then ask: **"Which error would you like me to investigate?"**

If there are no active errors but deferred messages exist, say: **"No active errors. N deferred message(s) awaiting external input."** and list them briefly.

Don't try to fix everything at once. Work iteratively — one error at a time.

## Step 3: Investigate the selected error

Fetch the full message including raw HL7v2 content:

```bash
curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/IncomingHL7v2Message/<ID>' | python -m json.tool
```

Then follow the diagnosis path based on error type:

---

### For `parsing_error`

The raw HL7v2 message is malformed.

1. Read the `message` field from the resource
2. Save it to a temp file and inspect with `scripts/hl7v2-inspect.sh`
3. Identify the exact problem:
   - Missing MSH segment
   - Invalid encoding characters (MSH-1, MSH-2)
   - Truncated message (incomplete segments)
   - Encoding issues (wrong line endings, embedded binary)
4. **Tell the developer:**
   - What exactly is wrong with the message
   - What the sender needs to fix
   - There is no config/code fix — the sender must correct the message format
5. **No code changes to suggest.** Offer to mark for retry only if the developer says the sender has fixed and will resend the same message ID.
6. **If the sender fix requires coordination**, propose deferring: "This needs the sender to fix their message format. Want me to defer it until that's resolved?"

---

### For `conversion_error`

The message parsed fine but is missing required data or has invalid values.

1. Read the `error` field to identify the failing check
2. Save the raw message to a temp file and inspect with `scripts/hl7v2-inspect.sh --values`
3. Identify what's missing or invalid — common cases:
   - **PV1-19 missing/empty**: Check if PID-18 has an account number that could serve as fallback
   - **PV1 segment required but absent**: Check config for this message type
   - **PV1-19 authority conflict**: Check CX.4/9/10 values
   - **PID segment missing**: Fundamental sender issue
   - **Unsupported message type**: Check MSH-9
4. **Suggest fixes ranked by preference:**
   - **Best:** "Sender should populate [field]" — explain what's needed
   - **Workaround:** "Add a preprocessor to [action]" — describe the preprocessor and offer to implement it
   - **Last resort:** "Make [segment] optional in config" — warn about the tradeoff (e.g., losing Encounter link) and offer to change config
5. **If no clear fix exists** (e.g., requires sender coordination, client decision, or spec clarification), **propose deferring** the message: "This needs external input. Want me to defer it for now?"
6. **Wait for developer approval** before making any changes
7. If approved, implement the fix:
   - Config change: edit `config/hl7v2-to-fhir.json`
   - New preprocessor: edit `src/v2-to-fhir/preprocessor-registry.ts` and update config
   - Then offer to mark the message for retry

---

### For `code_mapping_error`

A code in the message has no FHIR mapping.

1. Read the `unmappedCodes` array from the message
2. For each unmapped code, show:
   - Local code and system
   - Mapping type (observation-code-loinc, patient-class, obr-status, obx-status, etc.)
   - Sending application and facility
3. **For observation-code-loinc mappings:** Search LOINC for likely matches:
   ```bash
   curl -sf -u "root:$SECRET" 'http://localhost:8080/api/terminology/loinc?q=<search term>'
   ```
   Use the local code display text as the search term.
4. **For patient-class, obr-status, obx-status mappings:** Look up valid FHIR target values from the mapping type registry (`src/code-mapping/mapping-types.ts`) and suggest the best match.
5. **Present suggestions** to the developer with confidence level:
   - "High confidence: local code `2823-3` → LOINC `2823-3` (Potassium)"
   - "Needs review: local code `GLU` → LOINC `2345-7` (Glucose) — verify with lab"
6. **If no confident match exists** (local code is ambiguous, multiple LOINC candidates, needs domain expertise), propose deferring: "I can't confidently map this code. Want me to defer it until you consult with the lab/client?"
7. **Wait for developer approval** before resolving
8. If approved, resolve the mapping task:
   ```bash
   curl -sf -u "root:$SECRET" -X POST 'http://localhost:8080/api/mapping/tasks/<taskId>/resolve' \
     -H 'Content-Type: application/json' \
     -d '{"code": "<target_code>", "display": "<target_display>"}'
   ```
   The message will be automatically requeued for reprocessing.

---

### For `sending_error`

The FHIR bundle was built but Aidbox rejected it.

1. Check Aidbox health:
   ```bash
   curl -sf -u "root:$SECRET" 'http://localhost:8080/health'
   ```
2. Read the `error` field for the rejection reason
3. If the message has a saved `bundle` field, inspect it for FHIR validation issues
4. **Common causes and fixes:**
   - **Aidbox was down:** Check if it's healthy now → offer to mark for retry
   - **FHIR validation error (422):** Read the error details, identify which resource failed validation, suggest a fix (missing required field, invalid code, terminology binding failure)
   - **Timeout:** Likely transient → offer to mark for retry
5. **If structural fix needed:** Identify what needs to change (init-bundle.json StructureDefinition, missing CodeSystem, etc.) and suggest the fix
6. **Wait for developer approval** before making changes

---

## Step 4: After fixing

After implementing a fix:
1. Offer to mark the message for retry (this is an app endpoint, NOT Aidbox):
   ```bash
   curl -sf -X POST 'http://localhost:3000/mark-for-retry/<messageId>'
   ```
2. Offer to trigger reprocessing:
   ```bash
   curl -sf -X POST 'http://localhost:3000/process-incoming-messages'
   ```
3. Then re-query the message to verify the fix worked:
   ```bash
   curl -sf -u "root:$SECRET" 'http://localhost:8080/fhir/IncomingHL7v2Message/<ID>?_elements=id,status,error' | python -m json.tool
   ```
4. Report the result to the developer

## Important rules

- **Always work iteratively.** Show the summary first, then investigate one error at a time.
- **Never auto-fix without approval.** Always present the diagnosis and suggested fix, then wait for the developer to approve.
- **Skip `deferred` messages.** These have been investigated and are awaiting external input. Do not include them in error summaries unless the developer explicitly asks about deferred messages.
- **Offer to defer.** When the developer decides an error needs external input (e.g., waiting on client feedback), offer to defer it:
  ```bash
  curl -sf -X POST 'http://localhost:3000/defer/<messageId>'
  ```
- **Use hl7v2-inspect.sh for field analysis.** Don't manually count pipes in HL7v2 messages.
- **Read CLAUDE.md** for project architecture context if needed.
- **Use the hl7v2-info skill** if you need to verify HL7v2 spec compliance for a field.
