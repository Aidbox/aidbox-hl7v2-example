# HL7v2 BAR Message Specification

## Overview

BAR (Billing Account Record) messages communicate the state and demographics of a billing account from an ADT/registration/EHR source to a patient accounting/billing/AR system. BAR is account-level (who the patient is, what encounter/account this is, who pays). Line-item charges and payments are sent in DFT messages with FT1 segments.

## Trigger Events

| Event | Name | Purpose |
|-------|------|---------|
| `BAR^P01` | Add Patient Account | Create a new billing account. EVN-2 = account start date. |
| `BAR^P05` | Update Patient Account | Update existing account (insurance, guarantor, visit, coded data). |
| `BAR^P06` | End Patient Account | Close account. EVN-2 = account end date. No new charges should accrue. |
| `BAR^P02` | Purge Patient Account | Delete/purge account (rare). |
| `BAR^P12` | Update Diagnosis/Procedure | Explicit DG1/PR1 update after coding finalization (v2.5.1+). |

## Message Structure

```
MSH         Message Header (required)
EVN         Event Type (required)
PID         Patient Identification (required)
[PD1]       Patient Demographics
[PV1]       Patient Visit (usually required in practice)
[PV2]       Patient Visit - Additional Info
{DG1}       Diagnosis (repeating)
{PR1}       Procedure (repeating)
[DRG]       Diagnosis Related Group
{GT1}       Guarantor (repeating)
{NK1}       Next of Kin
{IN1        Insurance (repeating group)
  [IN2]     Insurance Additional
  {IN3}     Insurance Certification
}
[ACC]       Accident
[UB1]       UB82 Data
[UB2]       UB92 Data
```

## FHIR to BAR Segment Mapping

| BAR Segment | FHIR Resource | Purpose |
|-------------|---------------|---------|
| MSH | - | Message header (routing config) |
| EVN | Account.servicePeriod | Event timestamp |
| PID | Patient + Account | Patient identification |
| PV1/PV2 | Encounter + Practitioner + Location | Visit context |
| GT1 | Account.guarantor / RelatedPerson | Guarantor |
| IN1/IN2/IN3 | Coverage + Organization | Insurance |
| DG1 | Condition | Diagnosis codes |
| PR1 | Procedure | Procedure codes |

---

## Segment Details

### MSH - Message Header

| Field | Name | Source |
|-------|------|--------|
| MSH-1 | Field Separator | `\|` |
| MSH-2 | Encoding Characters | `^~\&` |
| MSH-3 | Sending Application | Config |
| MSH-4 | Sending Facility | Config |
| MSH-5 | Receiving Application | Config |
| MSH-6 | Receiving Facility | Config |
| MSH-7 | Date/Time of Message | Current timestamp |
| MSH-9 | Message Type | `BAR^P01` / `BAR^P05` / `BAR^P06` |
| MSH-10 | Message Control ID | Unique ID for ACK correlation |
| MSH-11 | Processing ID | `P` (production) / `T` (test) |
| MSH-12 | Version ID | `2.5.1` |

### EVN - Event Type

| Field | Name | Source |
|-------|------|--------|
| EVN-1 | Event Type Code | P01/P05/P06 |
| EVN-2 | Recorded Date/Time | P01: account start, P06: account end |
| EVN-6 | Event Occurred | Event timestamp |

### PID - Patient Identification

| Field | Name | FHIR Source |
|-------|------|-------------|
| PID-3 | Patient Identifier List | `Patient.identifier[]` |
| PID-5 | Patient Name | `Patient.name[]` |
| PID-7 | Date of Birth | `Patient.birthDate` |
| PID-8 | Administrative Sex | `Patient.gender` |
| PID-11 | Patient Address | `Patient.address[]` |
| PID-13 | Phone Number - Home | `Patient.telecom[]` |
| PID-18 | Patient Account Number | `Account.identifier` (billing account key) |

### PV1 - Patient Visit

| Field | Name | FHIR Source |
|-------|------|-------------|
| PV1-2 | Patient Class | `Encounter.class` (I/O/E) |
| PV1-3 | Assigned Patient Location | `Encounter.location[].location` |
| PV1-7 | Attending Doctor | `Encounter.participant` (type=ATND) → Practitioner |
| PV1-8 | Referring Doctor | `Encounter.participant` (type=REF) → Practitioner |
| PV1-19 | Visit Number | `Encounter.identifier[]` |
| PV1-20 | Financial Class | Coverage/payer category or extension |
| PV1-44 | Admit Date/Time | `Encounter.period.start` |
| PV1-45 | Discharge Date/Time | `Encounter.period.end` |

### GT1 - Guarantor

| Field | Name | FHIR Source |
|-------|------|-------------|
| GT1-1 | Set ID | Sequence number |
| GT1-2 | Guarantor Number | `RelatedPerson.identifier` or `Patient.identifier` |
| GT1-3 | Guarantor Name | `RelatedPerson.name` or `Patient.name` |
| GT1-5 | Guarantor Address | `RelatedPerson.address` or `Patient.address` |
| GT1-6 | Guarantor Phone | `RelatedPerson.telecom` or `Patient.telecom` |
| GT1-11 | Guarantor Relationship | `RelatedPerson.relationship` (SELF if patient) |

### IN1 - Insurance

| Field | Name | FHIR Source |
|-------|------|-------------|
| IN1-1 | Set ID | Order of Coverage (1=primary, 2=secondary) |
| IN1-2 | Insurance Plan ID | `Coverage.class` (plan) |
| IN1-3 | Insurance Company ID | `Coverage.payor.identifier` |
| IN1-4 | Insurance Company Name | `Organization.name` (from Coverage.payor) |
| IN1-8 | Group Number | `Coverage.class` (group) |
| IN1-12 | Plan Effective Date | `Coverage.period.start` |
| IN1-13 | Plan Expiration Date | `Coverage.period.end` |
| IN1-15 | Plan Type | `Coverage.type` |
| IN1-16 | Name of Insured | `Coverage.subscriber` → Patient/RelatedPerson name |
| IN1-17 | Insured's Relationship | `Coverage.relationship` |
| IN1-36 | Policy Number | `Coverage.subscriberId` or `Coverage.identifier` |

### DG1 - Diagnosis

| Field | Name | FHIR Source |
|-------|------|-------------|
| DG1-1 | Set ID | Sequence number |
| DG1-2 | Diagnosis Coding Method | `ICD-10-CM` |
| DG1-3 | Diagnosis Code | `Condition.code` |
| DG1-4 | Diagnosis Description | `Condition.code.text` |
| DG1-5 | Diagnosis Date/Time | `Condition.onsetDateTime` or `recordedDate` |
| DG1-6 | Diagnosis Type | `Condition.category` (A=Admitting, F=Final, W=Working) |
| DG1-15 | Diagnosis Priority | `Condition.extension` (1=primary) |

### PR1 - Procedure

| Field | Name | FHIR Source |
|-------|------|-------------|
| PR1-1 | Set ID | Sequence number |
| PR1-2 | Procedure Coding Method | `CPT` / `ICD-10-PCS` |
| PR1-3 | Procedure Code | `Procedure.code` |
| PR1-4 | Procedure Description | `Procedure.code.text` |
| PR1-5 | Procedure Date/Time | `Procedure.performedDateTime` |
| PR1-11 | Surgeon | `Procedure.performer.actor` → Practitioner |
| PR1-14 | Procedure Priority | Extension (1=primary) |

---

## FHIR Resources Required

### Minimal Set (for BAR^P01/P05/P06)

| Resource | Purpose | Required |
|----------|---------|----------|
| Patient | PID segment | Yes |
| Account | Account number (PID-18), service period | Yes |
| Encounter | PV1/PV2 segments | Usually |
| Coverage | IN1/IN2/IN3 segments | Usually |

### Optional Resources

| Resource | Purpose |
|----------|---------|
| RelatedPerson | Guarantor (GT1) if not patient |
| Condition | Diagnosis codes (DG1) |
| Procedure | Procedure codes (PR1) |
| Practitioner | Providers in PV1, PR1 |
| Organization | Insurance companies, facilities |

---

## Implementation Rules

1. **Account Key Consistency** - Use PID-18 as billing account number. Keep it constant across P01 → P05 → P06.

2. **Event Lifecycle**
   - Open account → `BAR^P01`
   - Update account → `BAR^P05`
   - Close account → `BAR^P06`

3. **Full Snapshot Updates** - P05 should send complete current state. HL7v2 doesn't support partial updates well.

4. **Code Mapping** - Map all local codes (financial class, plan IDs, location codes) to receiver vocabulary.

5. **Coded Elements** - Always include code + text + coding system (ICD-10, CPT).

6. **Message Ordering** - Ensure P01 arrives before P05s, and P06 last.

7. **ACK Handling** - Unique MSH-10 per message. Parse ACK, alert on AE/AR, retry or queue.

---

## Minimal Content by Trigger

### BAR^P01 (Add Account)
- MSH, EVN (start date), PID (with account)
- PV1, GT1, IN1

### BAR^P05 (Update Account)
- Same as P01 plus DG1/PR1/coverage changes
- Send full current state

### BAR^P06 (End Account)
- MSH, EVN (end date), PID
- PV1 (with discharge date)
- May omit insurance unless required
