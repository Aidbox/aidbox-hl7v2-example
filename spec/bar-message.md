## HL7 v2 BAR (Billing Account Record) — detailed summary for outgoing integration

### 1) What BAR messages are and when to use them

* **BAR messages communicate the state and demographics of a *billing account***, typically from an ADT/registration/EHR source to a **patient accounting / billing / AR system**. ([interfaceware.com][1])
* They are used to **add, update, close, or (rarely) purge** accounts, and to keep billing aligned with clinical/registration events. ([interfaceware.com][1])
* BAR is **account-level** (who the patient is, what encounter/account this is, who pays).
  **Line-item charges and payments are not BAR’s job**—those are usually sent in **DFT messages with FT1 segments** if you also need transactions. ([interfaceware.com][1])
* BAR sits in HL7 v2 Chapter 6 (Financial Management). In v2.5.1, HL7 notes PID/PV1 are included mainly to identify the account/patient/visit. ([hl7.eu][2])

---

### 2) Core trigger events (and correct semantics)

You’ll see BAR messages as `BAR^Pxx` in MSH-9.

**Most used**

* **BAR^P01 — Add Patient Account**

  * Create a *new* billing account/AR record.
  * Since v2.3+, **P01 should only be used for adds, not updates**. ([hl7.eu][3])
  * **EVN-2 must contain the *account start* date/time**. ([hl7.eu][3])

* **BAR^P05 — Update Patient Account** *(introduced v2.4)*

  * Update an existing account (insurance, guarantor, visit class/location, coded data, etc.).
  * Use this **instead of re-sending P01** for changes. ([hl7.eu][3])

* **BAR^P06 — End Patient Account** *(introduced v2.4)*

  * Close/end an account (often tied to discharge).
  * **EVN-2 is the account end timestamp**. ([hl7.eu][3])
  * Means *no new charges should accrue to that account*; not “paid in full.”

**Less common / situational**

* **BAR^P02 — Purge Patient Account**

  * Delete/purge an account; rare and often disabled in billing systems.
* **BAR^P10 — Transmit APC Grouping**

  * Outpatient APC grouping results (US-centric workflow).
* **BAR^P12 — Update Diagnosis/Procedure** *(v2.5.1+)*

  * Explicit update for DG1/PR1 after coding finalization (if your receiver supports it).

**Version compatibility rule:** only send triggers your receiver understands; e.g., if they’re on v2.3, they may expect **P01 for both add + update** even though later standards split updates into P05/P06. ([hl7.eu][3])

---

### 3) Message structure & segment ordering

BAR has a flexible structure with many optionals. A typical **BAR^P01/P05** looks like:

1. **MSH** (required)
2. **EVN** (required)
3. **PID** (required)
4. Optional patient-related / visit / financial groups:

   * **[PD1] [ROL] [PV1] [PV2]**
   * **{DG1} {PR1} [DRG]** (coding context)
   * **{GT1}** (guarantors)
   * **{NK1}** (contacts, rarely needed for billing)
   * **Insurance group:** **{IN1 [IN2] {IN3} [ROL]}**
   * **[ACC] [UB1] [UB2]**
5. Optional custom **Z-segments** (only by agreement)

Segment order should follow the HL7 structure for your version; receivers often validate ordering.

---

### 4) Critical segments & fields (what to populate carefully)

#### MSH — Message Header (always)

* **MSH-1/2** delimiters (usually `|^~\&`)
* **MSH-3/4** sending app/facility
* **MSH-5/6** receiving app/facility
* **MSH-7** message timestamp
* **MSH-9** `BAR^P01|P05|P06` (+ message structure component in v2.4+)
* **MSH-10** unique control ID (for ACK correlation)
* **MSH-11** processing ID (`P`/`T`)
* **MSH-12** HL7 version (match receiver)

#### EVN — Event Type (always)

* **EVN-2 Recorded Date/Time is semantically important**:

  * P01 → account start
  * P06 → account end
  * P05 → time of update
    ([hl7.eu][3])

#### PID — Patient Identification (always)

Key fields:

* **PID-3 Patient Identifier List (CX)**

  * Put MRN + assigning authority + ID type (e.g., `MR`).
* **PID-5 Patient Name (XPN)**
* **PID-7 DOB (TS), PID-8 Sex (Table 0001)**
* **PID-18 Patient Account Number (CX)**

  * Often the **primary account key** for billing.
  * Must be stable across P01 → P05 → P06.

**Implementation tip:** if your environment uses PV1-19 as the “account/visit number,” decide *one* canonical key (PID-18 vs PV1-19) and keep it consistent.

#### PV1 / PV2 — Visit context (usually)

* PV1 is optional in spec but practically expected.
  Key PV1 fields:
* **PV1-2 Patient Class** (I/O/E)
* **PV1-3 Assigned Location**
* **PV1-7/8/9 Providers** (Attending/Referring/Consulting)
* **PV1-19 Visit Number (CX)**
* **PV1-44 Admit Date/Time**, **PV1-45 Discharge Date/Time**
* **PV1-20 Financial Class** (payer category/self-pay etc.)

PV2 adds visit extras (optional; use only if required).

#### GT1 — Guarantor (usually if not self-pay)

* Repeating segment. Key fields:

  * **GT1-2 Guarantor Number**
  * **GT1-3/4 Name (XPN)**
  * **GT1-5 Address, GT1-6 Phone**
  * **GT1-8 Relationship** (Table 0063 e.g., SELF, SPO, PAR)

If patient is self-guarantor, GT1 can mirror PID fields with relationship SELF.

#### IN1 / IN2 / IN3 — Insurance (usually)

* **IN1 is the core coverage segment** and repeats for multiple coverages.
  Key IN1 fields:

* **IN1-1 Set ID** (1=primary, 2=secondary…)

* **IN1-2/3 Plan ID / Company ID** (use receiver’s codes)

* **IN1-5 Company Name**

* **IN1-8 Policy Number / Member ID**

* **IN1-9 Group Number**

* **IN1-15 Insurance Type**

* **IN1-17 Name of Insured**

* **IN1-18 Relationship to Patient**

* **IN1-36 Coordination of Benefits Priority** (if used)

* **IN2** adds subscriber/employer/Medicare-style details.

* **IN3** carries cert/pre-auth details.

**Self-pay representation:** some receivers want no IN1; others want a “self-pay plan” IN1 + PV1-20 financial class.

#### DG1 / PR1 / DRG / GP1 (situational)

* **DG1** repeating diagnoses for billing; include:

  * DG1-2 coding method (e.g., ICD-10)
  * DG1-3 code (CE/CWE)
  * DG1-6 type (primary/admitting/final)
* **PR1** repeating procedures with correct coding system (CPT/ICD-10-PCS).
* **DRG** inpatient grouping.
* **GP1** APC outpatient grouping if doing P10.

#### FT1 (usually **not** in BAR)

* FT1 is for **transactions/charges** and belongs in **DFT**, not BAR, unless your interface spec explicitly mixes them. ([interfaceware.com][1])

---

### 5) Outgoing implementation rules & best practices

1. **Agree on HL7 version + profile first.**
   Use the receiver’s supported version; don’t send P05/P06 if they only know P01/P02. ([hl7.eu][3])

2. **Choose and enforce your account key.**

   * Prefer **PID-18** as billing account number.
   * If using PV1-19, mirror it into PID-18 or document why not.
   * Keep constant across the account lifecycle messages.

3. **Event flow should mirror lifecycle:**

   * Open → **P01**
   * Changes → **P05**
   * Close → **P06**
   * Purge only by explicit billing approval.

4. **P05 should be a full snapshot unless receiver supports partials.**
   HL7 v2 doesn’t have strong patch semantics; omission may be interpreted differently by systems. Safer to resend all relevant account/coverage/guarantor data.

5. **Map all local codes to receiver vocab.**

   * Financial class, plan IDs, insurer IDs, location codes, provider IDs.
   * Mismatched codes are the #1 cause of AE/AR ACKs.

6. **Populate coded elements with systems.**
   Always send code + text + coding system (ICD-10, CPT, etc.) to avoid ambiguity.

7. **Strict formatting & escaping.**

   * Carriage return between segments.
   * Escape delimiter characters inside text fields.
   * TS dates in valid HL7 precision (YYYYMMDD[HHMMSS[+ZZZZ]]).

8. **ACK handling is mandatory.**

   * Unique **MSH-10** every send.
   * Parse ACK (MSA + optional ERR).
   * Alert on AE/AR; retry or queue.

9. **Ordering matters.**
   Ensure P01 reaches billing before P05s, and P06 last.

10. **Avoid Z-segments unless necessary.**
    If used, agree on spec and place consistently.

---

### 6) Minimal “must-have” content by trigger

**BAR^P01 (Add)**

* MSH / EVN (EVN-2 start dt) / PID (IDs + account)
* Usually PV1, GT1, IN1.

**BAR^P05 (Update)**

* Same as P01 plus any DG1/PR1/coverage changes.
* Prefer sending full current state.

**BAR^P06 (End)**

* MSH / EVN (EVN-2 end dt) / PID / PV1 (with PV1-45 discharge or end dt).
* May omit insurance unless policy says otherwise.

---

### 7) Quick mental model

* **BAR = “account header feed.”**
* **DFT = “charge/transaction feed.”**
* The billing system should be able to reconstruct:

  * **Who is being billed** (PID)
  * **Which account/encounter** (PID-18 / PV1-19)
  * **Account status** (P01/P05/P06 + EVN-2)
  * **Who pays** (GT1 + IN1 groups)
  * **Why/what was done** (DG1/PR1/DRG/GP1 if used)

If you want, I can draft a concrete outgoing BAR profile (required/optional fields) and a mapping table based on your sender data model and the receiver’s expectations.

[1]: https://www.interfaceware.com/hl7-bar?utm_source=chatgpt.com "HL7 - BAR Message - iNTERFACEWARE"
[2]: https://www.hl7.eu/HL7v2x/v251/std251/ch06.html?utm_source=chatgpt.com "HL7 v2.5.1 Chapter 6"
[3]: https://hl7.eu/refactored/msgBAR_P01.html?utm_source=chatgpt.com "HL7 - REFACTORED"
