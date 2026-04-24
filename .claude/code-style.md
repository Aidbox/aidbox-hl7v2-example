# Code Style Guide

Project-specific coding standards. **Mechanical rules are enforced by ESLint** (`bun run lint`, `bun run lint:fix`). This doc covers the judgment calls lint can't catch.

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

Comments are useful when they tell you something you can't quickly see from the code:
- WHY something is done (business reason, non-obvious constraint, workaround)
- Contracts (`@param`/`@returns` with semantic context beyond the type signature — e.g., "HL7v2 coding system identifier", "returns original value if no mapping exists")
- Edge case behavior that would surprise a reader
- References to external specs, tickets, or standards

Comments are redundant (delete them) when they restate what names and types already convey:
- `@param id - the id` (pure type restatement)
- `// Check if patient exists` before `if (patientExists)`
- `// Loop through items` before `for (const item of items)`
- Lists of specific values that will go stale as the code evolves

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

ESLint warns on functions over 100 lines (`max-lines-per-function`). Fix by extraction, not by silencing the warning.

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

## Type Integrity

Types must accurately represent the actual data flow. If there's a mismatch between what the types say and what the code does, fix the types or the code — never silence the compiler.

**Don't stub required fields with fallback defaults.** `value || ""` (or `|| 0`, `|| []`) to satisfy a required field means the types are lying. Either make the source type required (if the value is always present), handle the missing case explicitly (error, skip, early return), or make the target field optional (but critically review this decision. Often optional fields indicate bad data validation).

**If a field is always provided in practice, make it required in the type.**

ESLint enforces:
- `@typescript-eslint/no-explicit-any` — no `as any`.
- `@typescript-eslint/no-non-null-assertion` — no `!` (warn in tests, error in src).

Double casts like `as unknown as X` bypass the first rule. Don't do them. Refactor the source type until the cast is unnecessary. Acceptable: test code testing defensive runtime checks against malformed input.

## Usability over code purity

When designing configuration or system interfaces, prioritize the operation and maintenance experience — simplicity, single source of truth, hard to misconfigure. Internal code properties (function purity, testability, etc.) can almost always be achieved through implementation patterns without compromising the external interface.

Example: if the choice is between "elegant internals with fragile config coupling" and "slightly mixed internals with robust single-source-of-truth config" — choose robust config.

## Naming

Use semantic variable names. Avoid short abbreviations (`fv`, `val`, `res`) and generic names (`obj`, `data`, `item`, `result`) that don't convey the variable's meaning. Name variables after what they represent in the domain.

```typescript
/* GOOD */
const rawFillerOrder = segment.fields[3];
const eiComponents = rawFillerOrder as Record<number, FieldValue>;
const entityIdentifier = eiComponents[1];
```

## Testing

- Never mock Aidbox behavior — if a test depends on Aidbox, make it an integration test against the real test instance
- Use shared helpers from `test/integration/helpers.ts` for creating test resources; local helpers are OK only when there's a single integration test file for that domain

## Prefer immutable handlers over in-place mutation

When a function transforms data, return new values instead of mutating the input. This makes data flow explicit and avoids partially-mutated state on error paths.

```typescript
/* BAD — mutates input, error leaves object half-modified */
function applyUpdate(resource: Immunization, data: Data): string | undefined {
  resource.field1 = data.a;
  if (badCondition) return "error";
  resource.field2 = data.b;
  return undefined;
}

/* GOOD — returns new fields or a typed error, caller merges */
type UpdateResult = { fields: Partial<Immunization> } | { error: string };

function applyUpdate(data: Data): UpdateResult {
  if (badCondition) return { error: "error" };
  return { fields: { field1: data.a, field2: data.b } };
}

const result = applyUpdate(data);
if ("error" in result) { /* handle error */ }
const updated = { ...original, ...result.fields };
```

## General Principles

- Don't add error handling, fallbacks, or validation for scenarios that can't happen.
- Remove unused code immediately; do not keep dead code or commented-out code; do not keep code in src/ that is only used in tests.

# Refactoring

When you touch a file for a task and notice low-risk issues related to your code, fix them in the same change:
- Local function that duplicates a shared export → replace with the import
- Unused imports → remove
- Dead code → remove

"Low-risk" means: identical behavior (you must verify it), no new test coverage needed, verifiable by existing tests.
