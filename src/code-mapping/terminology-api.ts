/**
 * Public entry for Terminology API (LOINC search + validation).
 *
 * The real implementation lives in `./loinc-terminology`. Keeping the
 * implementation under a dissimilar filename lets test code import the
 * impl directly without colliding with any `mock.module` that stubs the
 * public `terminology-api` path. The impl also exposes an optional
 * `fetchFn` parameter on each function for tests that want to bypass
 * module-level mocking entirely — see the docs in
 * `src/code-mapping/loinc-terminology.ts` and
 * `test/unit/code-mapping/terminology-api.test.ts`.
 */
export {
  searchLoincCodes,
  validateLoincCode,
  type LoincSearchResult,
  type LoincValidationResult,
} from "./loinc-terminology";
