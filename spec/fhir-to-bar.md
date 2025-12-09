Below is a practical “what FHIR resources do I need to populate an outgoing BAR?” map. I’m assuming you’re generating BAR from a FHIR-side data model (R4/R5-ish). BAR is account-level financial info, so the required FHIR inputs are mostly **Patient + Account + Encounter + Coverage/Guarantor**; everything else is optional depending on your receiver profile. BAR purpose/segments are financial-account focused. ([interfaceware.com][1])

---

## Minimal FHIR resource set (covers BAR^P01 / P05 / P06)

### 1) `Patient`

Needed for **PID** (+ sometimes PD1/NK1-like contacts).

* **PID-3 Patient Identifier List** ← `Patient.identifier[]`
* **PID-5 Patient Name** ← `Patient.name[]`
* **PID-7 DOB** ← `Patient.birthDate`
* **PID-8 Sex** ← `Patient.gender`
* **PID-11 Address** ← `Patient.address[]`
* **PID-13 Phone** ← `Patient.telecom[]`
* **PID-18 Account Number** is *not* in Patient in FHIR; that comes from `Account` (see below).
  General V2↔FHIR segment mapping guidance is in the HL7 v2-to-FHIR IG. ([FHIR Build][2])

### 2) `Account`

This is the **core financial object** for BAR.

* **Account identifier / number** ← `Account.identifier`
  → map to **PID-18 Patient Account Number** (or PV1-19 if your site uses that as account key)
* **Account status** (open/closed) ← `Account.status`
* **Account type / class / service line** ← `Account.type`, `Account.servicePeriod`, `Account.coverage`
* **Account start/end times**

  * Start ← `Account.servicePeriod.start` → **EVN-2** for P01
  * End ← `Account.servicePeriod.end` → **EVN-2** for P06
    BAR event semantics tie EVN-2 to account start/end. ([FHIR Build][3])

### 3) `Encounter`

Feeds **PV1/PV2** (visit context tied to the account).

* **PV1-2 Patient Class** ← `Encounter.class`
* **PV1-3 Location** ← `Encounter.location[].location` (+ period/physicalType if needed)
* **PV1-7 Attending Doctor** ← `Encounter.participant` (type=ATND) → Practitioner/Role
* **PV1-19 Visit Number** ← `Encounter.identifier[]`
* **PV1-44 Admit DT** ← `Encounter.period.start`
* **PV1-45 Discharge DT** ← `Encounter.period.end`
* **PV1-20 Financial Class** ← usually a local extension or derived from Coverage/payer category.

### 4) `Coverage`

Feeds **IN1/IN2/IN3** (insurance groups).

* **IN1-1 Set ID** ← order of Coverage entries (primary=1, secondary=2…)
* **IN1-2/3 Plan/Company IDs** ← `Coverage.class`, `Coverage.payor.identifier`
* **IN1-5 Company Name** ← `Coverage.payor.display` / `Organization.name`
* **IN1-8 Policy/Member Number** ← `Coverage.subscriberId` or `Coverage.identifier`
* **IN1-9 Group Number** ← `Coverage.class` (group) or extension
* **IN1-15 Insurance Type** ← `Coverage.type` or `Coverage.class`
* **IN1-17 Name of Insured** ← `Coverage.subscriber` (Patient/RelatedPerson)
* **IN1-18 Relationship to Patient** ← `Coverage.relationship`
* **IN3 (auth/precert)** ← `Coverage.authorizationSupportingInformation` / extensions if you use them.

---

## Guarantor / responsible party (for GT1)

BAR often includes **GT1**. In FHIR, guarantor can be represented a few ways:

### 5) `RelatedPerson` **or** `Patient.contact`

* If guarantor is not the patient:
  **GT1** ← `RelatedPerson` linked to Patient

  * Name ← `RelatedPerson.name`
  * Address/telecom ← `RelatedPerson.address`, `RelatedPerson.telecom`
  * Relationship ← `RelatedPerson.relationship`
* If guarantor *is* patient (self-pay):
  you can either omit GT1 or copy Patient data as GT1 with relationship SELF (per receiver rules).

> Some implementations put guarantor on `Account.guarantor.party` (R4) referencing Patient/RelatedPerson; that’s the cleanest source if present.

---

## Providers and organizations (for PV1, IN1)

### 6) `Practitioner` / `PractitionerRole`

* **PV1 doctors** (attending/referring/etc.)
  ← `Encounter.participant.individual` (Practitioner)
  ← with role taken from `Encounter.participant.type` or `PractitionerRole.code`.

### 7) `Organization`

* **Sending/receiving facilities** (mostly MSH routing metadata for your interface engine)
* **Payers** referenced by Coverage (`Coverage.payor`).

---

## Clinical coding (optional BAR content)

Only include these if your receiver wants Dx/Procedures on the account (common at P05/P06, or P12 if supported).

### 8) `Condition`

Feeds **DG1**.

* DG1 code ← `Condition.code`
* Type/priority ← `Condition.category` / extension
* Onset/recorded date ← `Condition.onsetDateTime` / `recordedDate`

### 9) `Procedure`

Feeds **PR1**.

* PR1 code ← `Procedure.code`
* Procedure datetime ← `Procedure.performed[x]`
* Performer/provider ← `Procedure.performer.actor` → Practitioner/Role

### 10) `EpisodeOfCare` (sometimes)

If your account spans multiple encounters, `EpisodeOfCare` can help derive account grouping, but it’s not required for BAR.

---

## What **not** to pull into BAR (unless spec says so)

* **Line-item charges/transactions**: prefer **DFT + FT1**, sourced from:

  * `ChargeItem`, `Claim`, `ClaimResponse`, `ExplanationOfBenefit`, `Invoice`
* Don’t mix these into BAR unless your receiver explicitly expects FT1 inside BAR (non-standard). ([interfaceware.com][1])

---

## Quick mapping cheat sheet (FHIR → BAR segment)

| BAR segment | Main FHIR sources                                                    |
| ----------- | -------------------------------------------------------------------- |
| MSH         | Messaging wrapper / routing config (not clinical FHIR)               |
| EVN         | `Account.servicePeriod`, event timestamp in your workflow            |
| PID         | `Patient` (+ `Account.identifier` for PID-18)                        |
| PV1/PV2     | `Encounter` (+ `Practitioner/Role`, `Location`)                      |
| GT1         | `Account.guarantor` or `RelatedPerson` / `Patient.contact`           |
| IN1/IN2/IN3 | `Coverage` (+ `Organization`, `RelatedPerson/Patient` as subscriber) |
| DG1         | `Condition`                                                          |
| PR1         | `Procedure`                                                          |
| DRG/GP1     | derived grouper output; often extensions or local resources          |

---

## Minimal bundle you’d typically need to build a BAR

For a clean outgoing generator, expect to have (or query):

1. `Patient`
2. `Account`
3. `Encounter` (linked to Account or Patient)
4. `Coverage`(s) (linked to Patient/Account)
5. Optional: `RelatedPerson` (guarantor), `Practitioner/Role`, `Organization`
6. Optional: `Condition`, `Procedure`

If you want, tell me your exact BAR profile (which segments/fields receiver requires, and whether PID-18 or PV1-19 is the canonical account key). I’ll produce a field-by-field mapping table and a transform sketch from those FHIR resources.

[1]: https://www.interfaceware.com/hl7-bar?utm_source=chatgpt.com "HL7 - BAR Message - iNTERFACEWARE"
[2]: https://build.fhir.org/ig/HL7/v2-to-fhir/segment_maps.html?utm_source=chatgpt.com "Segment Maps - HL7 Version 2 to FHIR v1.0.0"
[3]: https://build.fhir.org/ig/HL7/v2-to-fhir/?utm_source=chatgpt.com "V2 to FHIR - HL7 Version 2 to FHIR v1.0.0"
