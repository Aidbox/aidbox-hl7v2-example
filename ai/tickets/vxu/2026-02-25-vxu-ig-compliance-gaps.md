---
status: description
parent-ticket: 2026-02-23-vxu-design-final.md
scope: Additional IG compliance items not in the core VXU design
---

# VXU V2-to-FHIR IG Compliance Gaps

## Origin

During comparison of the VXU design (`2026-02-23-vxu-design-final.md`) against the V2-to-FHIR IG mapping CSVs, several IG-specified mappings were identified that are not covered by the core VXU ticket. These are additive — they don't change the core design but extend it for fuller IG compliance.

## Items

### 1. ORC-4 → Two Additional Identifiers (Placer Group Number)

**IG source:** `ORC[Immunization] - ORC.csv`, rows for ORC-4

ORC-4 is typed as `EIP` (Entity Identifier Pair) and maps to **two** `Immunization.identifier` entries:
- `identifier[3]` via `EIP[Identifier-FillerAssignedIdentifier]`
- `identifier[4]` via `EIP[Identifier-PlacerAssignedIdentifier]`

The core VXU design only maps ORC-2 (PLAC) and ORC-3 (FILL). ORC-4 adds a placer group number, which some senders use to correlate multiple orders.

**Impact:** Low-medium. Adds two more identifier entries to Immunization. Safe to add — identifiers are additive.

### 2. ORC-28 → `Immunization.meta.security` (Confidentiality Code)

**IG source:** `ORC[Immunization] - ORC.csv`, row for ORC-28

ORC-28 (Confidentiality Code, CWE) maps to `Immunization.meta.security` as a `Coding`, using the `ConfidentialityCode` vocabulary mapping.

**Impact:** Low. Most immunization senders don't populate ORC-28, but when present it controls access policy metadata.

### 3. RXA-27/28 → `Immunization.location` (v2.7+ Location Fields)

**IG source:** `RXA[Immunization] - RXA.csv`, rows for RXA-27 and RXA-28

- RXA-27 (`PL` datatype) → `location[1](Location)` via `PL[Location]`
- RXA-28 (`XAD` datatype) → `location[1](Location.address)` via `XAD[Address]`

These replace the v2.5 `RXA-11` (LA2 datatype) for communicating where the vaccine was administered. Our codebase targets v2.8.2, so we should support these fields.

**Impact:** Medium. Requires `PL[Location]` and `XAD[Address]` datatype converters. Creates a Location resource referenced by `Immunization.location`.

**Dependencies:** May need new datatype converters (`PL → Location`, `XAD → Address`) if they don't already exist.

### 4. RXR-1 Route Vocabulary Translation (RouteOfAdministration)

**IG source:** `RXR[Immunization] - RXR.csv`, row for RXR-1; `RouteOfAdministration - Sheet1.csv`

The IG specifies a vocabulary mapping from HL7v2 table 0162 codes to FHIR codes. Most codes map 1:1 with the same code and stay in the `v2-0162` system, but **6 immunization-relevant codes** change both code and system:

| v2 Code | v2 Text | FHIR Code | FHIR System |
|---------|---------|-----------|-------------|
| ID | Intradermal | IDINJ | `v3-RouteOfAdministration` |
| IM | Intramuscular | IM | `v3-RouteOfAdministration` |
| IV | Intravenous | IVINJ | `v3-RouteOfAdministration` |
| PO | Oral | PO | `v3-RouteOfAdministration` |
| SC | Subcutaneous | SQ | `v3-RouteOfAdministration` |
| TD | Transdermal | TRNSDERM | `v3-RouteOfAdministration` |

The core VXU design passes `RXR-1` through as-is via `CWE[CodeableConcept]`. The IG expects code translation for certain values.

**Impact:** Medium. The most common immunization routes (IM, SC, ID) are in the translation list. Without this, FHIR consumers expecting `v3-RouteOfAdministration` system codes won't match.

**Implementation approach options:**
- A) Static lookup table in the RXR converter (simple, covers the fixed IG vocabulary)
- B) ConceptMap-based resolution via existing mapping infrastructure (more complex, supports sender-specific overrides)
- C) Both: static lookup as default, ConceptMap as override layer

**Note:** Real-world senders (especially IIS) may already send NCIT codes rather than table 0162 codes. The translation should only apply when the source system is `HL70162`.

### 5. RXR-2 Site Vocabulary Translation (BodyParts)

**IG source:** `RXR[Immunization] - RXR.csv`, row for RXR-2; `BodyParts - Sheet1.csv`

The IG specifies a vocabulary mapping for administration site (table 0550 → `v2-0550` system). Unlike route, the BodyParts mapping is almost entirely 1:1 (same code, same system `http://terminology.hl7.org/CodeSystem/v2-0550`), with two additional FHIR-only entries:
- `LA` → Left arm (`v3-ActSite`)
- `RA` → Right arm (`v3-ActSite`)

**Impact:** Low. The codes don't change — the main value is system URI normalization and the LA/RA additions. For immunizations, the common sites (deltoid, thigh) are in the standard list.

### 6. Cross-Cutting Resources from VXU_V04 Message Mapping

**IG source:** `VXU_V04 - Sheet1.csv`

The VXU message-level mapping specifies several resource types beyond what the core VXU ticket covers:

#### 6a. MessageHeader (from MSH)
`MSH[MessageHeader]` — standard message header resource. Our converter doesn't produce MessageHeader for any message type currently. This is a cross-cutting concern that affects ORU and ADT too.

#### 6b. Provenance (from MSH, PID, SFT)
Multiple Provenance resources:
- `MSH[Provenance-Source]` — source system provenance
- `MSH[Provenance-Transformation]` — transformation provenance
- `PID[Provenance-Patient]` — patient update provenance (conditional on PID-33/34)
- `SFT[Device]` → `Provenance.entity.what(Device)` — software device

Cross-cutting concern — applies to all message types.

#### 6c. ServiceRequest (from ORC)
`ORC[ServiceRequest]` — the order that led to the immunization event. Conditional: "Only if the system wants to know about the order."

This is optional per the IG and adds complexity. The core VXU design intentionally focuses on Immunization as the primary output.

#### 6d. Coverage (from PV1-20)
`PV1[Coverage]` — insurance coverage from patient visit. Conditional on PV1-20 being valued.

Cross-cutting concern — applies to any message with PV1.

#### 6e. RelatedPerson / Patient.contact (from NK1)
`NK1[RelatedPerson]` and `NK1[Patient]` — next of kin. Cross-cutting concern.

## Affected Messages / Resources (Cross-Cutting)

Several items above are not VXU-specific and would benefit all message types:

| Item | Affected Messages | New FHIR Resources |
|------|-------------------|-------------------|
| MessageHeader | VXU, ORU, ADT | MessageHeader |
| Provenance | VXU, ORU, ADT | Provenance, Device |
| Coverage from PV1 | VXU, ORU, ADT | Coverage |
| NK1 handling | VXU, ADT | RelatedPerson |
| Route vocabulary | VXU (+ any future RXR use) | — (vocabulary only) |
| Body parts vocabulary | VXU (+ any future RXR use) | — (vocabulary only) |

## Prioritization Suggestion

**Tier 1 — Immunization-specific, low risk:**
- ORC-4 identifiers
- ORC-28 meta.security
- Route vocabulary translation (item 4)

**Tier 2 — Requires new datatype converters:**
- RXA-27/28 location
- Body parts vocabulary (item 5)

**Tier 3 — Cross-cutting, separate design needed:**
- MessageHeader, Provenance, ServiceRequest, Coverage, RelatedPerson

Tier 3 items likely warrant their own design tickets since they affect the converter architecture broadly.

## Relationship to Core VXU Ticket

These items are **additive** to the core VXU design (`2026-02-23-vxu-design-final.md`). The core ticket can be implemented first and these items layered on afterward. No changes to the core ticket's design are needed.
