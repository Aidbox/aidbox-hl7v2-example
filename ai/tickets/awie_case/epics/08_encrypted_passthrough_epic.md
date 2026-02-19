# Epic 8: Encrypted Data Pass-Through

**Priority**: P4 (Infrastructure)
**Status**: Design needed
**Depends on**: Epic 7 (code mapping — encrypted codes must not trigger mapping tasks)
**Blocks**: Nothing directly

## Problem

The Awie Case description states that HL7v2 segment data may be encrypted (e.g., `John Doe` → `IpnTiApq`). Encrypted data decrypts on the UI side — FHIR resources must carry it faithfully. Current converters may reject or mishandle encrypted content through validation, date parsing, or code mapping.

## What's Encrypted

Evidence in data:
- Patient names: `VvlPikj5^GQW`, `Rzswuouwsz^Frcwr^Anti-Xa`, `KCZUGWFDV^IEPSXLM`
- DOB masking: `****0517`, `****0427` (partial masking)
- Addresses: `2048 Dplclufc Mw^^Zywbhl^HU^50719`
- In some sender variants, ADT questionnaire OBX also uses non-standard datatypes/statuses (`IF`, `SW`, status `D`)

## Implications for Converter

1. **Do NOT validate field content** — encrypted names/addresses won't pass format checks
2. **Do NOT parse dates** for age calculation — masked DOBs like `****0517` aren't valid dates
3. **Do NOT reject on gender code validation** — encrypted gender field may not be M/F/O/U
4. **DO preserve all content as-is** — encrypted data decrypts on the UI side
5. **DO still use identifiers** for resource IDs — identifiers (MRN, visit number) appear to NOT be encrypted

## Pitfalls

1. **Encrypted codes triggering mapping tasks**: If an encrypted gender code reaches the code mapping validator, it creates a mapping task with encrypted display text — confusing for the user resolving it. Need sender-specific config to skip validation for known-encrypted fields.

2. **Date parsing failures**: Masked DOBs (`****0517`) will crash `new Date()` or similar parsing. Need graceful pass-through for non-parseable dates.

3. **Scope of encryption**: Not clear which fields are encrypted per sender. May vary by message type, patient consent, or configuration. Need a flexible per-sender, per-field config.

4. **Mixed encrypted/clear data**: Some fields encrypted, others not, within the same message. Can't just "skip all validation for encrypted senders."

5. **Handle encrypted/non-standard OBX**: Encrypted datatype/status combinations from encrypted questionnaire feeds will pollute mapping Task queue with non-standard values. Need to investigate: are these fields non-standard and should be mapped or they're encrypted and shouldn't (what will we do then for their conversion if we need those fields?).

## User Feedback

- Validation/parsing should be **configurable per-sender**. Some clients want it, some don't.
- Need **both** a per-sender validation toggle and a flag to skip mapping tasks for encrypted fields.

## Decisions Needed

- [ ] Per-sender config format: which fields to skip validation for?
- [ ] Date handling: store masked dates as strings, or use a special extension?
- [ ] Mapping task suppression: per-sender flag, per-field flag, or detect-encrypted heuristic?
- [ ] Handling of non-standard OBX datatype/status (e.g., `IF`/`SW`, status `D`): explicit allowlist, pass-through, or normalization rule?
- [ ] Scope: apply to ADT only, or all message types?

## Relevant Files

- `src/v2-to-fhir/config.ts` — config loader (extend for per-sender validation settings)
- `config/hl7v2-to-fhir.json` — per-message-type config (extend for per-sender)
- `src/v2-to-fhir/segments/pid-patient.ts` — date parsing, gender validation
- `src/code-mapping/mapping-errors.ts` — mapping error creation (add suppression check)
