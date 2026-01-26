# Plan: Fix Invoice Status Handling

## Overview

Update the invoice BAR builder to set the FHIR `Invoice.status` to `"issued"` when BAR message generation completes, in addition to the existing `processing-status` extension. This aligns with FHIR semantics where `"issued"` indicates the invoice has been formally sent. Also fix documentation inconsistencies.

## Context

- **Files to modify:**
  - `src/bar/invoice-builder-service.ts` - Add Invoice.status update
  - `test/bar/invoice-builder-service.test.ts` - Add test for status update
  - `docs/developer-guide/architecture.md` - Fix incorrect documentation
  - `docs/user-guide/overview.md` - Clarify status handling
  - `CLAUDE.md` - Update for accuracy

- **Current behavior:**
  - `Invoice.status` (FHIR standard): unchanged, stays "draft"
  - `processing-status` (custom extension): changes `pending` → `completed`

- **Target behavior:**
  - `Invoice.status`: changes `draft` → `issued`
  - `processing-status`: changes `pending` → `completed` (unchanged)

- **Related code:**
  - `updateInvoiceStatus()` at `invoice-builder-service.ts:226` - uses FHIRPath PATCH to update extension
  - `processNextInvoice()` at `invoice-builder-service.ts:314` - orchestrates the flow

## Development Approach
- **Testing approach**: TDD - write tests first
- Complete each task fully before moving to the next
- Make small, focused changes
- **CRITICAL: every task MUST include new/updated tests**
- **CRITICAL: all tests must pass before starting next task**
- **CRITICAL: update this plan file when scope changes**

## Validation Commands
- `bun test test/bar/invoice-builder-service.test.ts` - Run invoice builder tests
- `bun test` - Run all tests
- `bun run typecheck` - Type checking

---

### Task 1: Update `updateInvoiceStatus()` to also set Invoice.status

- [x] In `src/bar/invoice-builder-service.ts`, modify `updateInvoiceStatus()` function
- [x] Add a new FHIRPath PATCH operation to set `Invoice.status` to `"issued"` when processing-status is `"completed"`
- [x] Keep existing processing-status extension update unchanged
- [x] Only set Invoice.status to "issued" when status param is "completed" (not for "error" or "failed")
- [x] Write test: verify Invoice.status PATCH operation is included when status is "completed"
- [x] Write test: verify Invoice.status PATCH is NOT included when status is "error"
- [x] Run `bun test test/bar/invoice-builder-service.test.ts` - must pass before next task

### Task 2: Update documentation in architecture.md

- [ ] In `docs/developer-guide/architecture.md`, find line ~95 "Update `Invoice` to `status=issued`"
- [ ] Change to accurately describe both updates: Invoice.status → "issued" AND processing-status → "completed"
- [ ] Update the sequence diagram at line ~178 to show: "PATCH /Invoice (status=issued, processing-status=completed)"
- [ ] Run `bun test` - must pass before next task

### Task 3: Update documentation in overview.md

- [ ] In `docs/user-guide/overview.md`, find line ~110 "Marks the invoice as `completed`"
- [ ] Clarify that both Invoice.status changes to "issued" and processing-status changes to "completed"
- [ ] Add a brief note explaining the distinction between FHIR Invoice.status and processing-status extension
- [ ] Run `bun test` - must pass before next task

### Task 4: Update CLAUDE.md

- [ ] In `CLAUDE.md`, find the Invoice BAR Builder Service section (around line 128)
- [ ] Update "Invoice.status remains 'draft'" to "Invoice.status changes to 'issued'"
- [ ] Keep the processing-status description accurate
- [ ] Run `bun test` - must pass before next task

### Task 5: [Final] Verify and clean up

- [ ] Run `bun test` to verify all tests pass
- [ ] Run `bun run typecheck` to verify no type errors
- [ ] Move this plan to `tasks/plans/completed/`

## Technical Details

### PATCH Operation Structure

The `updateInvoiceStatus()` function uses FHIRPath PATCH. Add a new operation when status is "completed":

```typescript
// Add this operation when status === "completed"
{
  "name": "operation",
  "part": [
    { "name": "type", "valueCode": "replace" },
    { "name": "path", "valueString": "Invoice.status" },
    { "name": "value", "valueCode": "issued" },
  ]
}
```

### FHIR Invoice.status Values

| Value | Meaning |
|-------|---------|
| `draft` | Preliminary form, not finalized |
| `issued` | Formally sent/posted |
| `balanced` | Fully paid/settled |
| `cancelled` | Voided |
| `entered-in-error` | Created in error |

## Edge Cases and Error Handling

- **Invoice already "issued"**: The PATCH will succeed (idempotent replace)
- **Invoice in "cancelled" state**: The PATCH will override to "issued" - this is acceptable as the system should not process cancelled invoices (they shouldn't have processing-status=pending)
- **Error during processing**: Invoice.status should NOT change; only processing-status changes to "error"

## Post-Completion Verification

1. Start the system: `docker compose up -d && bun run dev`
2. Create a test invoice via UI or API with status "draft"
3. Trigger BAR generation via `/build-bar`
4. Verify Invoice.status changed to "issued" in Aidbox Console
5. Verify processing-status extension changed to "completed"
