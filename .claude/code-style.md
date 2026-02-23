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

### File Creation

Before creating a file, ask yourself: does the amount of code justify a separate module? A small handler, helper, or type that has exactly one consumer belongs in the consumer's file (or in a shared file that already exists). Pattern-matching on directory conventions is not a reason to create a file — the code's size and reuse are.

## Avoid Cyclic Dependencies

Never create circular imports between modules. If module A imports from module B, then module B must not import from module A (directly or indirectly).

To avoid cycles:
- Place shared utilities, types, and constants in a dedicated `shared/` module
- Keep dependencies flowing in one direction (e.g., services -> utilities)
- If two modules need each other's functionality, extract the shared part into a third module

## Testing

- Never mock Aidbox behavior — if a test depends on Aidbox, make it an integration test against the real test instance
- Use shared helpers from `test/integration/helpers.ts` for creating test resources; local helpers are OK only when there's a single integration test file for that domain

## Type Integrity

Types must accurately represent the actual data flow. If there's a mismatch between what the types say and what the code does, fix the types or the code — never silence the compiler.

**Don't stub required fields with fallback defaults.** `value || ""` (or `|| 0`, `|| []`) to satisfy a required field means the types are lying. Either make the source type required (if the value is always present), handle the missing case explicitly (error, skip, early return), or make the target field optional (but critically review this decision. Often optional fields indicate bad data validation).

**If a field is always provided in practice, make it required in the type.**

**Don't use `as` casts to bypass type mismatches.** Refactor until the types align naturally. Acceptable uses: test code testing defensive runtime checks against malformed input.

**Don't use `!` (non-null assertion) without local proof.** If a value is proven non-null by a guard or check in the same scope, prefer narrowing (e.g., `if` check, early return) over `!`. If `!` is used, the proof must be obvious within a few lines.

## Usability over code purity

When designing configuration or system interfaces, prioritize the operation and maintenance experience — simplicity, single source of truth, hard to misconfigure. Internal code properties (function purity, testability, etc.) can almost always be achieved through implementation patterns without compromising the external interface. 

Example: if the choice is between "elegant internals with fragile config coupling" and "slightly mixed internals with robust single-source-of-truth config" — choose robust config.

## General Principles

- Don't add error handling, fallbacks, or validation for scenarios that can't happen
- Always use static imports at the top of the file. Never use dynamic `await import()` inside functions or route handlers
- Remove unused code immediately; do not keep dead code or commented-out code; do not keep code in src/ that is only used in tests

## Code Style

Don't leave `continue` or `return` statements on the same line with the `if` condition.
