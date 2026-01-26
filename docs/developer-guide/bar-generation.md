# BAR Generation

Generates HL7v2 BAR (Billing Account Record) messages from FHIR resources for transmission to billing systems. For conceptual background on HL7v2 messages and FHIR resources, see the [User Guide](../user-guide/concepts.md).

## Code Organization

The `src/bar/` module handles BAR message generation:

| File | Purpose |
|------|---------|
| `generator.ts` | Pure function that transforms FHIR resources into BAR message structure |
| `types.ts` | `BarMessageInput` type definition |
| `invoice-builder-service.ts` | Polling service that fetches Invoices and orchestrates generation |
| `sender-service.ts` | Polling service that delivers OutgoingBarMessage resources |
| `index.ts` | Module exports |

**Key entry points:**

- `generateBarMessage(input)` in `generator.ts` - Core generation logic, returns `HL7v2Message`
- `processNextInvoice()` in `invoice-builder-service.ts` - Polls and processes one Invoice
- `sendNextMessage()` in `sender-service.ts` - Polls and delivers one OutgoingBarMessage

## Implementation Walkthrough

### Invoice to BAR Message Flow

The Invoice BAR Builder service (`invoice-builder-service.ts`) orchestrates the full flow:

```
processNextInvoice()
    │
    ├─► pollPendingInvoice()         // Query: Invoice?processing-status=pending&_sort=_lastUpdated&_count=1
    │
    ├─► fetchRelatedResources()      // Fetch Patient, Account, Coverage[], Condition[], Procedure[]
    │
    ├─► buildBarFromInvoice()
    │       │
    │       └─► generateBarMessage() // Pure transformation in generator.ts
    │               │
    │               └─► BAR_P01Builder
    │                       .msh(buildMSH(input))
    │                       .evn(buildEVN(input))
    │                       .pid(buildPID(input))
    │                       .addVISIT(buildVisit(input))  // Contains PV1, DG1[], PR1[], GT1, IN1[]
    │                       .build()
    │
    ├─► createOutgoingBarMessage()   // POST /OutgoingBarMessage with status=pending
    │
    └─► updateInvoiceStatus()        // PATCH Invoice processing-status=completed
```

### Message Generation Detail

The `generateBarMessage()` function in `generator.ts` orchestrates message construction using the fluent `BAR_P01Builder`. It delegates to segment builders (`buildMSH`, `buildEVN`, `buildPID`) and the `buildVisit()` function which populates PV1, DG1, PR1, GT1, and IN1 segments from the FHIR input.

### Quick Example

```typescript
import { generateBarMessage } from "./bar";
import { formatMessage } from "@atomic-ehr/hl7v2/src/hl7v2/format";

const barMessage = generateBarMessage({
  patient,           // FHIR Patient resource
  account,           // FHIR Account resource
  encounter,         // FHIR Encounter resource (optional)
  coverages,         // FHIR Coverage[] (optional)
  conditions,        // FHIR Condition[] (optional)
  procedures,        // FHIR Procedure[] (optional)
  guarantor,         // RelatedPerson or Patient (optional)
  messageControlId: "MSG001",
  triggerEvent: "P01",
  sendingApplication: "HOSPITAL_FHIR",   // MSH-3: Your system name
  sendingFacility: "MAIN_CAMPUS",        // MSH-4: Your facility
  receivingApplication: "BILLING_SYS",   // MSH-5: Destination system
  receivingFacility: "BILLING_DEPT",     // MSH-6: Destination facility
});

console.log(formatMessage(barMessage));
```

### Segment Builder Pattern

Each segment has a dedicated builder function in `generator.ts` that:
1. Extracts data from FHIR resources
2. Maps values using helper functions (`formatHL7Date`, `mapGender`, etc.)
3. Returns a typed segment object using the `$N_fieldName` convention

See `buildPID()`, `buildPV1()`, and similar functions in `generator.ts` for implementations.

## Key Patterns

### Field Naming Convention

HL7v2 fields use the `$N_fieldName` pattern. See [HL7v2 Module](hl7v2-module.md#field-naming-convention) for details and examples.

### Helper Functions

Common transformations are extracted to helper functions at the top of `generator.ts`:

- `formatHL7Date(dateStr)` - Converts ISO date to HL7v2 format (YYYYMMDDHHMMSS)
- `mapGender(gender)` - Maps FHIR gender codes to HL7v2 administrative sex
- `mapPatientClass(encounterClass)` - Maps FHIR encounter class to PV1-2
- `getCode(concept)` - Extracts code/display/system from CodeableConcept
- `mapCodingSystem(system)` - Maps FHIR system URIs to HL7v2 coding system codes

### Set ID Pattern

Repeating segments (DG1, PR1, IN1) require a Set ID field incrementing from 1:

```typescript
conditions?.forEach((condition, idx) => {
  visit.addDG1(buildDG1(condition, idx + 1));  // idx+1 gives 1-based Set ID
});
```

### Trigger Events

| Event | Name | When to Use |
|-------|------|-------------|
| `BAR^P01` | Add Patient Account | New billing account. EVN-2 = account start date. |
| `BAR^P05` | Update Patient Account | Update existing account. Send full current state. |
| `BAR^P06` | End Patient Account | Close account. EVN-2 = account end date. |

The trigger event affects EVN-2 timestamp:

```typescript
const eventDateTime = input.triggerEvent === "P01"
  ? formatHL7Date(account.servicePeriod?.start) || nowHL7()
  : input.triggerEvent === "P06"
    ? formatHL7Date(account.servicePeriod?.end) || nowHL7()
    : nowHL7();
```

## Error Handling

### Invoice Retry Mechanism

Invoices that fail BAR generation are marked with `processing-status=error`. The Web UI provides a "Reprocess Errors" button that:

1. Fetches all invoices with `processing-status=error`
2. Checks retry count (stored in `invoice-processing-retry-count` extension)
3. If retry count < 3: increments retry count and sets status to `pending`
4. If retry count >= 3: marks as `failed` (terminal state)

**Extensions used:**
- `http://example.org/invoice-processing-status` - processing status (pending/completed/error/failed)
- `http://example.org/invoice-processing-error-reason` - error message from last failure
- `http://example.org/invoice-processing-retry-count` - number of retry attempts

## Extension Points

### Adding a New Field

To add a new FHIR→HL7v2 field mapping:

1. Find the segment builder function in `generator.ts` (e.g., `buildPID()`)
2. Add the field property using `$N_fieldName` pattern
3. Check field type in `src/hl7v2/generated/fields.ts` for the expected structure

See [How-To: Extending Outgoing Fields](how-to/extending-outgoing-fields.md) for a complete example.

### Supporting New Trigger Events

To add P02 (Purge) or P12 (Update Diagnosis/Procedure):

1. Update `BarMessageInput.triggerEvent` type in `types.ts`
2. Add timestamp logic in `buildEVN()` for the new event
3. The same `BAR_P01Builder` works for all BAR events (structure is identical)

## Reference

### Message Structure

```
MSH         Message Header (required)
EVN         Event Type (required)
PID         Patient Identification (required)
[PV1]       Patient Visit
{DG1}       Diagnosis (repeating)
{PR1}       Procedure (repeating)
{GT1}       Guarantor (repeating)
{IN1}       Insurance (repeating)
```

### FHIR to Segment Mapping

| BAR Segment | FHIR Resource | Purpose |
|-------------|---------------|---------|
| MSH | - | Message header (routing config) |
| EVN | Account.servicePeriod | Event timestamp |
| PID | Patient + Account | Patient identification |
| PV1 | Encounter | Visit context |
| GT1 | RelatedPerson or Patient | Guarantor |
| IN1 | Coverage + Organization | Insurance |
| DG1 | Condition | Diagnosis codes |
| PR1 | Procedure | Procedure codes |

### Field Mapping Tables

For complete field mappings, see `buildPID()`, `buildPV1()`, etc. in `src/bar/generator.ts`.

<details>
<summary>MSH - Message Header</summary>

| Field | Name | Source |
|-------|------|--------|
| MSH-1 | Field Separator | `\|` |
| MSH-2 | Encoding Characters | `^~\&` |
| MSH-3 | Sending Application | Config (env: `FHIR_APP`) |
| MSH-4 | Sending Facility | Config (env: `FHIR_FAC`) |
| MSH-5 | Receiving Application | Config (env: `BILLING_APP`) |
| MSH-6 | Receiving Facility | Config (env: `BILLING_FAC`) |
| MSH-7 | Date/Time of Message | Current timestamp |
| MSH-9 | Message Type | `BAR^P01` / `BAR^P05` / `BAR^P06` |
| MSH-10 | Message Control ID | Unique ID for ACK correlation |
| MSH-11 | Processing ID | `P` (production) |
| MSH-12 | Version ID | `2.5.1` |

</details>

<details>
<summary>PID - Patient Identification</summary>

| Field | Name | FHIR Source |
|-------|------|-------------|
| PID-3 | Patient Identifier List | `Patient.identifier[]` |
| PID-5 | Patient Name | `Patient.name[]` |
| PID-7 | Date of Birth | `Patient.birthDate` |
| PID-8 | Administrative Sex | `Patient.gender` |
| PID-11 | Patient Address | `Patient.address[]` |
| PID-13 | Phone Number - Home | `Patient.telecom[]` |
| PID-18 | Patient Account Number | `Account.identifier` |

</details>

<details>
<summary>PV1 - Patient Visit</summary>

| Field | Name | FHIR Source |
|-------|------|-------------|
| PV1-2 | Patient Class | `Encounter.class` (I/O/E) |
| PV1-3 | Assigned Patient Location | `Encounter.location[].location` |
| PV1-19 | Visit Number | `Encounter.identifier[]` |
| PV1-44 | Admit Date/Time | `Encounter.period.start` |
| PV1-45 | Discharge Date/Time | `Encounter.period.end` |

</details>

<details>
<summary>GT1 - Guarantor</summary>

| Field | Name | FHIR Source |
|-------|------|-------------|
| GT1-1 | Set ID | Sequence number |
| GT1-2 | Guarantor Number | `RelatedPerson.identifier` or `Patient.identifier` |
| GT1-3 | Guarantor Name | `RelatedPerson.name` or `Patient.name` |
| GT1-5 | Guarantor Address | `RelatedPerson.address` or `Patient.address` |
| GT1-6 | Guarantor Phone | `RelatedPerson.telecom` or `Patient.telecom` |
| GT1-10 | Guarantor Type | `RelatedPerson.relationship` (SE if patient) |

</details>

<details>
<summary>IN1 - Insurance</summary>

| Field | Name | FHIR Source |
|-------|------|-------------|
| IN1-1 | Set ID | Order of Coverage (1=primary) |
| IN1-2 | Insurance Plan ID | `Coverage.type` |
| IN1-3 | Insurance Company ID | `Coverage.payor.identifier` |
| IN1-4 | Insurance Company Name | `Organization.name` (from Coverage.payor) |
| IN1-8 | Group Number | `Coverage.class` (group) |
| IN1-12 | Plan Effective Date | `Coverage.period.start` |
| IN1-13 | Plan Expiration Date | `Coverage.period.end` |
| IN1-17 | Insured's Relationship | `Coverage.relationship` |
| IN1-36 | Policy Number | `Coverage.subscriberId` |

</details>

<details>
<summary>DG1 - Diagnosis</summary>

| Field | Name | FHIR Source |
|-------|------|-------------|
| DG1-1 | Set ID | Sequence number |
| DG1-2 | Diagnosis Coding Method | `ICD-10-CM` |
| DG1-3 | Diagnosis Code | `Condition.code` |
| DG1-5 | Diagnosis Date/Time | `Condition.recordedDate` |
| DG1-6 | Diagnosis Type | `Condition.category` |
| DG1-15 | Diagnosis Priority | Set ID (1=primary) |

</details>

<details>
<summary>PR1 - Procedure</summary>

| Field | Name | FHIR Source |
|-------|------|-------------|
| PR1-1 | Set ID | Sequence number |
| PR1-2 | Procedure Coding Method | `CPT` / `ICD-10-PCS` |
| PR1-3 | Procedure Code | `Procedure.code` |
| PR1-5 | Procedure Date/Time | `Procedure.performedDateTime` |

</details>

## See Also

- [Architecture](architecture.md) - System overview and polling pattern
- [HL7v2 Module](hl7v2-module.md) - Segment builders and message construction
- [How-To: Extending Outgoing Fields](how-to/extending-outgoing-fields.md) - Adding new FHIR→HL7v2 mappings
