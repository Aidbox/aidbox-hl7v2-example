/**
 * Public entry for Terminology API (LOINC search + validation).
 *
 * The real implementation lives in `./terminology-api-impl`. This file
 * is a thin re-export so tests that stub this module (via `mock.module`
 * — process-wide in Bun) don't also stub the implementation behind it:
 * `test/unit/code-mapping/terminology-api.test.ts` imports the
 * implementation directly (`./terminology-api-impl`) to sidestep that
 * stub. Everything else in the codebase imports from here.
 */
export {
  searchLoincCodes,
  validateLoincCode,
  type LoincSearchResult,
  type LoincValidationResult,
} from "./terminology-api-impl";
