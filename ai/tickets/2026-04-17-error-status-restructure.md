# Plan: Restructure IncomingHL7v2Message Error Statuses

## Overview

Replace the current catch-all `error` and `mapping_error` statuses with four distinct error types: `parsing_error`, `conversion_error`, `sending_error`, and `code_mapping_error`. Also add a `deferred` operator status for messages that have been triaged but can't be resolved yet (waiting on sender fix, business decision, etc.). This gives operators immediate visibility into what failed and whether/how it can be resolved. Sending errors auto-retry up to 3 times before becoming permanent.

## Context

**Current state:** IncomingHL7v2Message has 5 statuses: `received`, `processed`, `warning`, `error`, `mapping_error`. The `error` status conflates three distinct failure modes (parse failure, conversion/validation failure, Aidbox submission failure), making triage difficult.

**Target state:** 8 statuses: `received`, `processed`, `warning`, `parsing_error`, `conversion_error`, `sending_error`, `code_mapping_error`, `deferred`.

### Files involved

| File | Change |
|------|--------|
| `init-bundle.json` | StructureDefinition status field — update `short` and `definition` |
| `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts` | Regenerate (or hand-edit) status union type |
| `src/v2-to-fhir/processor-service.ts` | Split try-catch: parse errors → `parsing_error`, submission errors → `sending_error`, add auto-retry for sending |
| `src/v2-to-fhir/converter.ts` | No change needed (ConversionResult type stays the same) |
| `src/v2-to-fhir/messages/adt-a01.ts` | Replace `status: "error"` with `status: "conversion_error"` |
| `src/v2-to-fhir/messages/adt-a08.ts` | Same |
| `src/v2-to-fhir/messages/oru-r01.ts` | Same |
| `src/v2-to-fhir/messages/orm-o01.ts` | Same |
| `src/v2-to-fhir/messages/vxu-v04.ts` | Same |
| `src/code-mapping/mapping-errors.ts` | Change `"mapping_error"` → `"code_mapping_error"` |
| `src/ui/pages/messages.ts` | Update badge colors, status filter, retry eligibility, add `deferred` badge and label |
| `src/index.ts` | Update mark-for-retry, process-incoming-messages, add `POST /defer/:id` route |
| `src/mllp/mllp-server.ts` | No change (still creates `received`) |
| `docs/developer-guide/error-statuses.md` | New file — detailed error type docs |
| `CLAUDE.md` | Add error status summary |
| `.claude/skills/check-errors/SKILL.md` | New skill — operator triage workflow for error statuses including `deferred` |
| Tests (unit + integration) | Update all status assertions |

### Error Type Definitions

| Status | Pipeline step | Cause | Retryable? | Resolution |
|--------|--------------|-------|-----------|------------|
| `parsing_error` | Step 2 (parseMessage) | Malformed HL7v2, bad encoding, truncated message | Manual retry possible but pointless unless message is corrected at sender | Fix at sender, resend |
| `conversion_error` | Step 5 (converter) | Missing required fields (PV1-19), invalid data, unsupported message type | Manual retry (user clicks Mark for Retry) | Fix at sender or adjust config (e.g., make PV1 optional), then retry |
| `code_mapping_error` | Step 5 (converter) | Code exists but no FHIR mapping | Manual retry via Task resolution workflow | Resolve mapping Task → message auto-requeued |
| `sending_error` | Step 6 (submitBundle) | Aidbox unreachable, FHIR validation rejected, timeout | Auto-retry up to 3 times, then permanent `sending_error` | If transient: auto-recovers. If persistent: fix Aidbox config or data, manual retry |
| `deferred` | Manual (operator) | Operator has triaged the message but can't resolve it now (waiting on sender fix, business decision, external team) | Manual retry when unblocked | Operator clicks Mark for Retry once the blocker is resolved; until then it stays out of the active error list |

### Error Resolution Flows

```
PARSING ERROR FLOW:
  Message arrives → parseMessage() throws → status=parsing_error
  Resolution: Sender fixes message → resends → new message created as received
  (Mark for Retry available but will fail again with same data)

CONVERSION ERROR FLOW:
  Message parses OK → converter returns status=conversion_error (missing PV1-19, etc.)
  Resolution options:
    1. Sender fixes data and resends
    2. Admin adjusts config (e.g., PV1.required=false) → Mark for Retry
    3. Admin adds preprocessor rule → Mark for Retry

CODE MAPPING ERROR FLOW (existing, renamed):
  Message parses OK → converter finds unmapped code → status=code_mapping_error + Tasks created
  Resolution: User resolves Task in /mapping/tasks → message auto-requeued as received
  (Same workflow as current mapping_error, just renamed)

SENDING ERROR FLOW:
  Message converts OK → submitBundle() fails → auto-retry up to 3 times
  If all retries fail → status=sending_error (permanent)
  Resolution options:
    1. Fix Aidbox (if it was down) → Mark for Retry
    2. Fix FHIR validation issue → Mark for Retry

DEFERRED FLOW (operator action, no auto-transitions):
  Any error status → operator hits POST /defer/:id → status=deferred
  Deferred messages are excluded from the default error triage list
  but remain retry-eligible.
  Resolution: operator clicks Mark for Retry once the blocker is
  resolved → status=received → pipeline reruns.
```

### Dependencies
- No new external libraries needed
- Regenerating TypeScript types from init-bundle.json uses `bun run regenerate-fhir`

## Development Approach
- **Testing approach**: Update existing tests to use new status values, add new tests for parsing/sending error paths
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes**

## Validation Commands
- `bun test:all` — Run all tests (unit + integration)
- `bun run typecheck` — TypeScript type checking

---

### Task 1: Update schema and types

Update the StructureDefinition and TypeScript type to support the new status values.

- [ ] Update `init-bundle.json`: change the `IncomingHL7v2Message.status` element's `short` field to `"received | processed | warning | parsing_error | conversion_error | code_mapping_error | sending_error | deferred"`
- [ ] Update `init-bundle.json`: update the `definition` field to describe all 8 statuses
- [ ] Update `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts`: change the status union type to `"received" | "processed" | "warning" | "parsing_error" | "conversion_error" | "code_mapping_error" | "sending_error" | "deferred"`
- [ ] Run `bun run typecheck` — expect compilation errors in files still using `"error"` and `"mapping_error"` (this is expected and will be fixed in subsequent tasks)

### Task 2: Update converters — rename `mapping_error` to `code_mapping_error`

Minimal rename of the existing mapping error status.

- [ ] In `src/code-mapping/mapping-errors.ts`: change `status: "mapping_error"` to `status: "code_mapping_error"` (line 91)
- [ ] In `src/ui/pages/messages.ts`: update `getStatusBadgeClass` — rename `"mapping_error"` case to `"code_mapping_error"` (keep yellow color)
- [ ] In `src/ui/pages/messages.ts`: update retry eligibility check — replace `"mapping_error"` with `"code_mapping_error"`
- [ ] In `src/ui/pages/messages.ts`: update status filter array — replace `"mapping_error"` with `"code_mapping_error"`
- [ ] In `src/ui/pages/messages.ts`: update unmapped codes display condition — replace `"mapping_error"` with `"code_mapping_error"`
- [ ] Update unit test `test/unit/code-mapping/mapping-errors.test.ts`: change all `"mapping_error"` assertions to `"code_mapping_error"`
- [ ] Update unit test `test/unit/code-mapping/mapping-task-service.test.ts`: change `"mapping_error"` references to `"code_mapping_error"`
- [ ] Update integration tests that assert `"mapping_error"`: `test/integration/v2-to-fhir/adt.integration.test.ts`, `test/integration/v2-to-fhir/orm-o01.integration.test.ts`, `test/integration/v2-to-fhir/oru-r01.integration.test.ts`, `test/integration/v2-to-fhir/vxu-v04.integration.test.ts`, `test/integration/ui/mapping-tasks-queue.integration.test.ts`
- [ ] Run `bun test:all` — must pass before next task

### Task 3: Update converters — rename `error` to `conversion_error`

Replace all `status: "error"` returned by message converters with `status: "conversion_error"`.

- [ ] In `src/v2-to-fhir/messages/adt-a01.ts`: replace all `status: "error"` with `status: "conversion_error"` (lines ~261, ~302, ~322)
- [ ] In `src/v2-to-fhir/messages/adt-a08.ts`: replace `status: "error"` with `status: "conversion_error"` (line ~111)
- [ ] In `src/v2-to-fhir/messages/oru-r01.ts`: replace all `status: "error"` with `status: "conversion_error"` (lines ~491, ~511)
- [ ] In `src/v2-to-fhir/messages/orm-o01.ts`: replace all `status: "error"` with `status: "conversion_error"` (lines ~634, ~651, ~674, ~691, ~729)
- [ ] In `src/v2-to-fhir/messages/vxu-v04.ts`: replace all `status: "error"` with `status: "conversion_error"` (lines ~283, ~294, ~310, ~326)
- [ ] In `src/ui/pages/messages.ts`: update `getStatusBadgeClass` — rename `"error"` case to `"conversion_error"` (keep red color)
- [ ] In `src/ui/pages/messages.ts`: update retry eligibility — replace `"error"` with `"conversion_error"`
- [ ] In `src/ui/pages/messages.ts`: update status filter array — replace `"error"` with the new statuses: `["received", "processed", "warning", "parsing_error", "conversion_error", "code_mapping_error", "sending_error"]`
- [ ] Update unit tests: change `"error"` status assertions to `"conversion_error"` in `test/unit/v2-to-fhir/messages/adt-a01.test.ts` and other converter tests
- [ ] Update integration tests: change `"error"` status assertions to `"conversion_error"` in `test/integration/v2-to-fhir/adt.integration.test.ts`, `test/integration/v2-to-fhir/converter-pipeline.integration.test.ts`, `test/integration/v2-to-fhir/vxu-v04.integration.test.ts`
- [ ] Run `bun test:all` — must pass before next task

### Task 4: Split processor-service error handling — parsing and sending

Restructure `processor-service.ts` to distinguish parsing errors from sending errors, and add auto-retry for sending failures.

- [ ] In `processor-service.ts`, refactor `convertMessage()` to wrap `parseMessage()` in its own try-catch. On parse failure, return a ConversionResult with `status: "parsing_error"` and the parse error message. Let conversion errors flow through normally via ConversionResult.
- [ ] In `processor-service.ts`, refactor `processNextMessage()` and the service factory `poll()`: wrap `submitBundle()` in its own try-catch. On submission failure, set `status: "sending_error"`.
- [ ] Add auto-retry logic for sending errors: before marking as permanent `sending_error`, check a retry count. If < 3, set status back to `received` and increment a retry counter (use the `error` field to track context like `"Sending failed (attempt 2/3): <original error>"`). If >= 3, set permanent `status: "sending_error"`.
- [ ] Add `"parsing_error"` and `"sending_error"` badge colors in `src/ui/pages/messages.ts`: `parsing_error` = red (same as conversion_error), `sending_error` = orange/amber (distinguishable, retryable feel)
- [ ] Add `"parsing_error"` and `"sending_error"` to retry eligibility in UI
- [ ] Write unit test: verify that a malformed HL7v2 string passed to `convertMessage()` returns `status: "parsing_error"` (not `"conversion_error"`)
- [ ] Write unit test: verify that a valid message with conversion failure returns `status: "conversion_error"`
- [ ] Write integration test: submit a malformed HL7v2 message via the pipeline and verify it gets `status: "parsing_error"`
- [ ] Write integration test: verify sending error auto-retry behavior (may need to mock/force a submission failure)
- [ ] Run `bun test:all` — must pass before next task

### Task 5: Update mark-for-retry and related routes

Update the HTTP routes that handle retry/reprocessing to work with new status values.

- [ ] In `src/index.ts` `/mark-for-retry/:id`: no functional change needed (already resets to `received`), but verify it works with all new statuses
- [ ] In `src/index.ts` `/process-incoming-messages`: no functional change needed, verify it processes retried messages correctly
- [ ] Write integration test: mark a `conversion_error` for retry and verify it reprocesses
- [ ] Write integration test: mark a `parsing_error` for retry and verify it re-enters the pipeline (and fails again with `parsing_error`)
- [ ] Write integration test: mark a `sending_error` for retry and verify it reprocesses
- [ ] Run `bun test:all` — must pass before next task

### Task 6: Documentation

Document the error types, resolution flows, and pipeline architecture.

- [ ] Create `docs/developer-guide/error-statuses.md` with:
  - Error type definitions table (status, pipeline step, cause, retryable, resolution)
  - Resolution flow diagrams for each error type (text-based, as in Context section above)
  - Sending auto-retry behavior documentation
  - Examples of each error type (what message/condition triggers it)
- [ ] Update `CLAUDE.md` section "### Custom FHIR Resources" → "IncomingHL7v2Message":
  - Change `status` line to: `` `status`: `received` → `processed` | `warning` | `parsing_error` | `conversion_error` | `code_mapping_error` | `sending_error` ``
  - Add brief description of each error type (1 line each)
- [ ] Update `CLAUDE.md` section "### Data Flow" → "Incoming" to mention error classification
- [ ] Update `docs/developer-guide/README.md` to add link to new error-statuses.md
- [ ] Update `CLAUDE.md` documentation table to add link to error-statuses.md
- [ ] Run `bun test:all` — final validation, must pass

### Task 7: Add `deferred` operator status and `/defer/:id` route

Introduce an explicit "triaged, waiting on external input" bucket so operators can park messages they can't resolve immediately without them cluttering the active error list.

- [ ] Update `init-bundle.json` `short` and `definition` on `IncomingHL7v2Message.status` to include `deferred`
- [ ] Update status union type in `src/fhir/aidbox-hl7v2-custom/IncomingHl7v2message.ts`
- [ ] Add `POST /defer/:id` route in `src/index.ts` that sets `status: "deferred"` on the target message and redirects to `/incoming-messages` (no change to `error`/`bundle` fields — preserve context for when it's picked back up)
- [ ] Add `deferred` badge (`bg-gray-100 text-gray-600`) and label (`"Deferred"`) in `src/ui/pages/messages.ts`
- [ ] Include `deferred` in retry-eligibility (Mark for Retry must work on deferred messages)
- [ ] Include `deferred` in the status filter list
- [ ] Exclude `deferred` from default "active errors" triage queries in the `check-errors` skill; query it separately as a reminder
- [ ] Run `bun test:all`

### Task 8: Add `check-errors` skill

Provide a one-command operator workflow for triaging errors against a running Aidbox.

- [ ] Create `.claude/skills/check-errors/SKILL.md` with:
  - Query command for the four error statuses (`parsing_error`, `conversion_error`, `code_mapping_error`, `sending_error`) sorted by `_lastUpdated`
  - Separate query for `deferred` messages, surfaced as a reminder line under the main error table
  - Per-status diagnosis guidance (what to inspect, what to fix, when to defer vs retry vs ask sender)
  - Direct-lookup flow for a specific message ID
- [ ] Verify skill auto-appears under `.agents/skills/check-errors/` via the existing top-level symlink (no sync step needed)

## Technical Details

### Status Union Type (after change)

```typescript
status?: "received" | "processed" | "warning" | "parsing_error" | "conversion_error" | "code_mapping_error" | "sending_error" | "deferred";
```

### Processor Service Error Handling (pseudocode)

```typescript
async function convertMessage(message: IncomingHL7v2Message): Promise<ConversionResult> {
  let parsed: HL7v2Message;
  try {
    parsed = parseMessage(message.message);
  } catch (error) {
    return {
      messageUpdate: {
        status: "parsing_error",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const config = hl7v2ToFhirConfig();
  const preprocessed = preprocessMessage(parsed, config);
  return await convertToFHIR(preprocessed);
}

async function processNextMessage(): Promise<boolean> {
  const message = await pollReceivedMessage();
  if (!message) return false;

  try {
    const { bundle, messageUpdate } = await convertMessage(message);

    if (bundle) {
      try {
        await submitBundle(bundle);
      } catch (sendError) {
        // Auto-retry logic for sending errors
        const attempt = parseSendingAttempt(message.error);
        if (attempt < 3) {
          await applyMessageUpdate(message, {
            status: "received",
            error: `Sending failed (attempt ${attempt + 1}/3): ${sendError.message}`,
          });
        } else {
          await applyMessageUpdate(message, {
            status: "sending_error",
            error: sendError.message,
          }, bundle);
        }
        return true;
      }
    }

    await applyMessageUpdate(message, messageUpdate, bundle);
    return true;
  } catch (error) {
    // Unexpected errors (should be rare — most are caught above)
    await applyMessageUpdate(message, {
      status: "conversion_error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
```

### Sending Auto-Retry

- Track attempt count by parsing the `error` field prefix pattern `"Sending failed (attempt N/3): ..."`
- When attempt < 3: reset to `received` (re-enters queue), store attempt context in `error`
- When attempt >= 3: set permanent `status: "sending_error"` with the last error message
- The `bundle` field is saved on permanent sending error so the user can inspect what was attempted

### UI Badge Colors

```typescript
const getStatusBadgeClass = (status: string | undefined) => {
  switch (status) {
    case "processed":        return "bg-green-100 text-green-800";
    case "warning":          return "bg-amber-100 text-amber-800";
    case "parsing_error":    return "bg-red-100 text-red-800";
    case "conversion_error": return "bg-red-100 text-red-800";
    case "code_mapping_error": return "bg-yellow-100 text-yellow-800";
    case "sending_error":    return "bg-orange-100 text-orange-800";
    case "deferred":         return "bg-gray-100 text-gray-600";
    default:                 return "bg-blue-100 text-blue-800"; // "received"
  }
};
```

## Edge Cases and Error Handling

### Parsing Edge Cases
- **Empty message string**: `parseMessage("")` throws → `parsing_error` status
- **Partial message (truncated in transit)**: parseMessage throws → `parsing_error` status
- **Valid HL7v2 but unsupported message type**: This is caught in `convertToFHIR()` switch default → `conversion_error` status (not parsing_error, because the message parsed successfully)

### Conversion Edge Cases
- **Converter throws unexpected exception** (not a returned ConversionResult): The outer catch in processNextMessage sets `status: "conversion_error"` — this is the fallback for any unhandled error after parsing succeeds
- **Multiple mapping errors in one message**: Still returns `code_mapping_error` with all unmapped codes (unchanged behavior)

### Sending Edge Cases
- **Aidbox returns 422 (validation error)**: This is a permanent sending error — auto-retry won't help, but we still retry 3 times in case it's a transient schema loading issue
- **Aidbox timeout**: Transient — auto-retry should recover
- **Network error**: Transient — auto-retry should recover
- **Bundle is undefined (no resources to submit)**: submitBundle is skipped entirely, so no sending error possible
- **Retry count tracking via error field**: If someone manually edits the error field, the attempt counter resets to 0. This is acceptable — worst case is 3 extra retries.

### Migration Edge Cases
- **Existing messages with `status: "error"`**: These will not match the new type union. They won't appear in filtered queries for new statuses. Operator should manually review and either mark for retry or delete.
- **Existing messages with `status: "mapping_error"`**: Same issue. These should be marked for retry so they reprocess with the new status system.

## Post-Completion Verification

1. Run `bun test:all` — all tests pass
2. Run `bun run typecheck` — no type errors
3. Start the server (`bun --hot src/index.ts`) and verify:
   - Send a malformed HL7v2 message via MLLP → verify `parsing_error` status in UI
   - Send a valid ADT^A01 with missing PV1-19 → verify `conversion_error` status in UI
   - Send a valid message with unknown patient class → verify `code_mapping_error` status in UI
   - Status filter dropdown shows all 8 statuses (including `deferred`)
   - Mark for Retry works on each error type and on `deferred`
   - `POST /defer/:id` on any error message flips it to `deferred`; Mark for Retry from `deferred` puts it back to `received` and reprocesses
4. Verify documentation is consistent between CLAUDE.md and docs/developer-guide/error-statuses.md
5. Verify the `check-errors` skill works end-to-end against a running Aidbox (lists active errors + deferred reminder)
