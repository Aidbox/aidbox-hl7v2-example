# Cross-EHR Patient & Encounter Identity — Design Decisions

**Referenced from:** [Epic 0: Foundation Decisions](00_foundation_decisions_epic.md) (D1a, D1b)
**Blocks:** Epic 1 (Cross-EHR Patient Identity), all message converters

---

## Data Analysis (1,558 messages across all senders)

### Identifier landscape

9 unique authorities found across all senders:

| Authority | Used by | Field | Type code | Scope |
|-----------|---------|-------|-----------|-------|
| `UNIPAT` | ST01 (ASTRA/Cerberus), REG (MEDTEX), IST | PID-2 (ST01) or PID-3 (REG/IST) | `PE` | **Cross-EHR MPI** |
| `ST01W` | ST01\|W (ASTRA) | PID-3 | `MR` | Facility W medical record |
| `ST01L` | ST01\|L (ASTRA) | PID-3 | `MR` | Facility L medical record |
| `ST01F` | ST01\|F (ASTRA) | PID-3 | `MR` | Facility F medical record |
| `ST01` | ST01 (ASTRA) | PID-3 | `PI` | Cross-facility ASTRA patient ID |
| `CERBERUS` | ST01\|W (Cerberus) | PID-3 | `PI`, `MR` | Cerberus-specific |
| `&&ISO` | MEDTEX LAB, MEDTEX PTH | PID-3 | `MR`, `PI`, `AN`, `XX` | Lab systems (ISO namespace) |
| `Saint-Louis` | Legacy | PID-3 | — | Legacy system |
| `MIE&1.2.840.114398.1.100&ISO` | ORM senders | PID-3 | — | OID-based authority |

### UNIPAT distribution

UNIPAT is the shared MPI — it appears across both EHR systems but in **different PID fields**:

| Sender                    | UNIPAT in PID-2 | UNIPAT in PID-3 | No UNIPAT |
|---------------------------|:---------------:|:---------------:|:---------:|
| **ST01 (ASTRA/Cerberus)** |   **136/137**   |        1        |     0     |
| **REG\|BMH (MEDTEX)**     |        0        |   **25/1390**   |   1,365   |
| **IST\|BMH**              |        0        |       4/6       |     2     |
| **Lab/others**            |        0        |        0        |    20     |

Key: ASTRA/Cerberus almost always has UNIPAT (in PID-2). MEDTEX rarely has it (~2%, in PID-3).

### Sample PID patterns

```
# Cerberus (ST01|W) — UNIPAT in PID-2, CERBERUS in PID-3:
PID|1|19624139^^^UNIPAT^PE|04384788^^^CERBERUS^PI||...

# MEDTEX (REG|BMH) — empty PID-2, UNIPAT in PID-3:
PID|1||11216032^^^UNIPAT^PE^BMH||...

# ASTRA (ST01|W) — UNIPAT in PID-2, multiple facility MRs + global PI in PID-3:
PID|1|11195429^^^UNIPAT^PE|645541^^^ST01W^MR~451912^^^ST01L^MR~00999388^^^ST01^PI||...

# MEDTEX without UNIPAT — only local identifier:
PID|1||11220762^^^BMH^PE||...

# Xpan Lab — ISO-based identifiers:
PID|1||M000000721^^^&&ISO^MR~T0-B20250417095542346^^^&&ISO^PI~T00000736^^^&&ISO^XX~CH0000002747^^^&&ISO^AN||...
```

### HL7v2 spec: PID-2 vs PID-3

| Field | v2.5 | v2.8.2 |
|-------|------|--------|
| PID-2 (Patient ID) | **[B]** Backward compatible (deprecated since v2.4) | **Removed** |
| PID-3 (Patient Identifier List) | **[R]** Required, repeating CX | **[R]** Required, repeating CX |

Within each CX identifier:
- CX.1 (Value): **[R]** Required
- CX.4 (Assigning Authority): **[C]** Conditionally required (must have CX.4, CX.9, or CX.10)
- CX.5 (Identifier Type Code): **[R]** Required (HL7 Table 0203)

### HL7v2 identifier type codes (Table 0203, relevant subset)

| Code | Description | Meaning |
|------|-------------|---------|
| **PE** | Living Subject Enterprise Number | Cross-enterprise patient ID — the standard MPI/enterprise type |
| **MR** | Medical record number | Facility-specific chart number |
| **PI** | Patient internal identifier | System-assigned internal ID |
| **PT** | Patient external identifier | Cross-system (older, less common than PE) |
| **AN** | Account number | Billing/financial — NOT a patient identifier |
| **VN** | Visit number | Encounter identifier, not patient |
| **XX** | Organization identifier | Not a patient ID (widely misused for persons) |

---

## Decision D1a: Patient ID — Priority-list identifier selection

### Config shape (per deployment)

```json
{
  "identifierPriority": [
    { "authority": "UNIPAT" },
    { "type": "PE" },
    { "authority": "ST01" },
    { "type": "MR" }
  ]
}
```

Each rule can specify `authority` (match CX.4.1), `type` (match CX.5), or both. Rules are tried in order; first match wins.

### Algorithm

1. **Pool** all CX identifiers from PID-3 (after preprocessing merges PID-2 into PID-3). Skip entries with no CX.1 value.
2. **For each rule** in `identifierPriority` order:
   - `{authority: X}` — match first CX where CX.4.1 = X
   - `{type: T}` — match first CX where CX.5 = T
   - `{authority: X, type: T}` — match first CX where both match
3. **First rule match wins** → Patient.id = `{matched-CX-authority}-{id}`
4. **No match → error.** Message fails, forcing operator to fix preprocessing config or priority rules.

### Preprocessing boundary

The core converter is strict — assumes PID-3 contains properly formed CX identifiers (value + authority + type). Normalization is a preprocessor responsibility:

| Messy input | Preprocessor action |
|---|---|
| PID-2 populated (v2.2 messages) | Move/merge PID-2 into PID-3 repeats |
| CX with no authority (e.g., `12345^^^^MR`) | Inject authority from MSH or sender config |
| CX with no type | Inject type from sender config or context |
| PID-3 empty | Error — nothing to preprocess, message cannot be converted |

### Rationale

- **Rules mix authority and type freely.** Authority-only rules (`{authority: "UNIPAT"}`) target a specific namespace. Type-only rules (`{type: "PE"}`) act as spec-driven fallbacks — PE means "enterprise identifier" per HL7. Combined rules (`{authority: "ST01", type: "MR"}`) are maximally specific.
- **ID uses matched identifier's own authority, not the rule's.** The rule selects WHICH identifier; the identifier provides the authority for the ID. E.g., rule `{type: "MR"}` matching `645541^^^ST01W^MR` → ID is `ST01W-645541`.
- **No silent fallback in converter.** If no rule matches, the error surfaces immediately. This prevents data from silently flowing with wrong patient linkage.
- **Preprocessor is the normalization layer.** Missing authorities, deprecated PID-2, bare values — all fixed before the converter sees the data.

### Example walkthrough

Config: `[{authority: "UNIPAT"}, {type: "PE"}, {authority: "ST01"}, {type: "MR"}]`

| Message | Pool (after preprocessing) | Matched rule | Patient.id |
|---------|--------------------------|-------------|------------|
| ASTRA with UNIPAT | UNIPAT/PE, ST01W/MR, ST01L/MR, ST01/PI | Rule 1: authority UNIPAT | `UNIPAT-11195429` |
| MEDTEX with UNIPAT | UNIPAT/PE | Rule 1: authority UNIPAT | `UNIPAT-11216032` |
| MEDTEX without UNIPAT | BMH/PE | Rule 2: type PE | `BMH-11220762` |
| Xpan lab | &&ISO/MR, &&ISO/PI, &&ISO/AN | Rule 4: type MR | `&&ISO-M000000721` |
| Hypothetical: no match | FOO/XX | No match | **Error** |

---

## Decision D1b: Encounter ID

Encounter.id = `{authority}-{visit-number}` from PV1-19 directly.

- PV1-19 is a single CX (not repeating) — no priority list needed.
- Authority is required after preprocessing. Existing preprocessor rule `fix-authority-with-msh` already injects authority from MSH when PV1-19 lacks one.
- If PV1-19 is missing or has no value → error (for message types requiring PV1) or skip Encounter (for types where PV1 is optional, like ORU_R01).
- Visits don't cross EHR boundaries, so cross-system linking isn't needed.

**Shared pattern with Patient ID:** both require authority on every CX after preprocessing. Patient ID adds a priority list to choose WHICH CX from a pool; Encounter ID has only one CX, so it's used directly.

---

## Impact on existing code

| File | Change needed |
|------|--------------|
| `src/v2-to-fhir/id-generation.ts` | Add Patient ID priority-list algorithm; keep existing Encounter ID logic (already uses CX authority) |
| `src/v2-to-fhir/segments/pid-patient.ts` | Patient.id assignment must use priority-list result instead of raw PID-2/PID-3[0] |
| `src/v2-to-fhir/messages/adt-a01.ts` | Replace ad-hoc Patient.id logic (lines 330-334) with priority-list call |
| `src/v2-to-fhir/messages/oru-r01.ts` | Replace `extractPatientId()` (lines 121-129) with priority-list call |
| `src/v2-to-fhir/preprocessor.ts` | Add PID-2→PID-3 merge rule; add authority injection rule |
| `config/hl7v2-to-fhir.json` | Add `identifierPriority` deployment-level config |
