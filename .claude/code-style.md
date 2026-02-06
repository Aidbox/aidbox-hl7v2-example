# Code Style Guide

Project-specific coding standards and best practices.

## Readable Code

### Prefer readable variable names over comments

```typescript
/* BAD */

// Check if this group maps to LOINC
if (group.target !== "http://loinc.org") continue;

// If a source system is specified in the group, check if it matches
if (group.source !== localSystem) {
  // Also try with normalized system
  if (normalizeSystem(localSystem) !== group.source) {
    continue;
  }
}


/* GOOD */

const mapsToLoinc = mappingSystem.target === "http://loinc.org";
const matchingSystem = mappingSystem.source === localSystem || mappingSystem.source === normalizeSystem(localSystem);

if (!mapsToLoinc || !matchingSystem) {
  continue;
}
```

Don't add comments that restate what names and types already convey. 
Comments should explain WHY or document non-obvious contracts/requirements, not describe WHAT the code does.
If the name is descriptive, a comment is redundant. Delete it.

### Prefer functions over big commented blocks

```typescript
/* BAD */

// =========================================================================
// OBX Parsing
// =========================================================================

// ... a lot of code

// =========================================================================
// SPM Parsing
// =========================================================================

// ... a lot of code


/* GOOD */

function parseOBX() {
  // ... a lot of code
}

function parseSPM() {
  // ... a lot of code
}

const obx = parseOBX();
const spm = parseSPM();
```

IMPORTANT: if a function is bigger than 100 lines, critically review it – probably, it will be more readable if you extract some of the work to functions.

## Separation of Concerns

Each module should own one primary responsibility. Before adding new logic, check if a module already owns that responsibility; if yes, extend or reuse it instead of duplicating code.

If new logic overlaps with another module's responsibility:
- Consider moving shared logic into a single module and call it from both places.
- Prefer refactoring when the overlap is more than small glue code.

If ownership is unclear or refactoring is risky:
- Keep the duplication for now.
- Add a short comment explaining why and where the related code lives, so it can be consolidated later.

### Minimal public interface

Modules should export only what consumers actually need. Keep implementation details private.

```typescript
// GOOD: Export only the interface consumers need
export async function processInvoice(invoiceId: string): Promise<Result>

// BAD: Export implementation details that force consumers to orchestrate
export function fetchInvoice(id: string)        // Internal step - keep private
export function saveInvoice(invoice: any)       // Internal step - keep private
export interface InvoiceInternal { ... }        // Internal type - keep private
```

This ensures:
- Consumers depend only on the public contract, not internal structure
- Internal implementation can change without breaking consumers
- Each module owns its logic; consumers don't orchestrate it

## Avoid Cyclic Dependencies

Never create circular imports between modules. If module A imports from module B, then module B must not import from module A (directly or indirectly).

To avoid cycles:
- Place shared utilities, types, and constants in a dedicated `shared/` module
- Keep dependencies flowing in one direction (e.g., services -> utilities)
- If two modules need each other's functionality, extract the shared part into a third module

## Testing

- Never mock Aidbox behavior — if a test depends on Aidbox, make it an integration test against the real test instance
- Use shared helpers from `test/integration/helpers.ts` for creating test resources; local helpers are OK only when there's a single integration test file for that domain

## General Principles

- Don't add error handling, fallbacks, or validation for scenarios that can't happen
- Always use static imports at the top of the file. Never use dynamic `await import()` inside functions or route handlers
- Remove unused code immediately; do not keep dead code or commented-out code; do not keep code in src/ that is only used in tests
