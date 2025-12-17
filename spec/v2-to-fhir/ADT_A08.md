# ADT^A08 to FHIR Mapping

This document describes the mapping from HL7v2 ADT^A08 (Patient Information Update) messages to FHIR R4 resources.

## Overview

| Source | Target | Description |
|--------|--------|-------------|
| ADT^A08 Message | Transaction Bundle | Single PUT request for Patient upsert |
| MSH Segment | Patient.meta.tag | Message metadata (id, type, sender) |
| PID Segment | Patient Resource | Patient demographics |

## Bundle Structure

| FHIR Element | Value | Description |
|--------------|-------|-------------|
| Bundle.resourceType | `"Bundle"` | Fixed value |
| Bundle.type | `"transaction"` | Transaction bundle for atomic processing |
| Bundle.entry[0].request.method | `"PUT"` | Upsert operation |
| Bundle.entry[0].request.url | `/Patient/{id}` | Patient ID from PID-2 |
| Bundle.entry[0].resource | Patient | Converted Patient resource |

## MSH Segment Mapping

| HL7v2 Field | FHIR Path | Description |
|-------------|-----------|-------------|
| MSH-10 | Patient.meta.tag[].code | Message Control ID |
| | Patient.meta.tag[].system | `"urn:aidbox:hl7v2:message-id"` |
| MSH-9.1 + MSH-9.2 | Patient.meta.tag[].code | Message Type (e.g., `ADT_A08`) |
| | Patient.meta.tag[].system | `"urn:aidbox:hl7v2:message-type"` |

## PID Segment Mapping

### Patient Identification

| HL7v2 Field | FHIR Path | Transform | Description |
|-------------|-----------|-----------|-------------|
| PID-2.1 | Patient.id | Direct copy | Patient ID (PE identifier value) |
| PID-2 | Patient.identifier[] | CX → Identifier | PE (Person Enterprise) identifier |
| PID-3 | Patient.identifier[] | CX[] → Identifier[] | Patient identifier list (MR, PI, etc.) |
| PID-3.4.1 | Patient.meta.tag[].code | Lowercase | Sender system (from MR assigning authority) |
| | Patient.meta.tag[].system | | `"urn:aidbox:hl7v2:sender"` |
| PID-19 | Patient.identifier[] | String → Identifier | SSN (Social Security Number) |

### Patient Demographics

| HL7v2 Field | FHIR Path | Transform | Description |
|-------------|-----------|-----------|-------------|
| PID-5 | Patient.name[] | XPN[] → HumanName[] | Patient name(s) |
| PID-8 | Patient.gender | Code mapping | Administrative sex |
| PID-11 | Patient.address[] | XAD[] → Address[] | Patient address(es) |
| PID-13 | Patient.telecom[] | XTN[] → ContactPoint[] | Home phone number(s) |
| PID-15 | Patient.communication[] | CE → Communication | Primary language |
| PID-16 | Patient.maritalStatus | CE → CodeableConcept | Marital status |

## Datatype Mappings

### CX → Identifier

| HL7v2 Component | FHIR Element | Description |
|-----------------|--------------|-------------|
| CX.1 | Identifier.value | ID number |
| CX.4.1 | Identifier.assigner.identifier.value | Assigning authority namespace |
| CX.5 | Identifier.type.coding[].code | Identifier type code |
| | Identifier.system | Same as type code (MR, PE, etc.) |

**Identifier Type Coding:**

| CX.5 Value | FHIR Coding |
|------------|-------------|
| MR | `{code: "MR", display: "Medical record number", system: "http://terminology.hl7.org/CodeSystem/v2-0203"}` |
| PE | `{code: "PE", display: "Living Subject Enterprise Number", system: "http://terminology.hl7.org/CodeSystem/v2-0203"}` |
| SS | `{code: "SS", display: "Social Security number", system: "http://terminology.hl7.org/CodeSystem/v2-0203"}` |
| PI | `{code: "PI", display: "Patient internal identifier", system: "http://terminology.hl7.org/CodeSystem/v2-0203"}` |

### XPN → HumanName

| HL7v2 Component | FHIR Element | Transform |
|-----------------|--------------|-----------|
| XPN.1.1 | HumanName.family | Capitalize first letter |
| XPN.2 | HumanName.given[0] | Capitalize first letter |
| XPN.3 | HumanName.given[1] | Capitalize first letter (middle name) |
| (computed) | HumanName.text | `"{given} {middle} {family}"` |

### XAD → Address

| HL7v2 Component | FHIR Element | Description |
|-----------------|--------------|-------------|
| XAD.1.1 | Address.line[0] | Street address |
| XAD.3 | Address.city | City |
| XAD.4 | Address.state | State or province |
| XAD.5 | Address.postalCode | ZIP or postal code |
| XAD.6 | Address.country | Country |
| (computed) | Address.text | `"{line}, {city}, {state}, {postalCode}, {country}"` |

### XTN → ContactPoint

| HL7v2 Component | FHIR Element | Description |
|-----------------|--------------|-------------|
| XTN.1 | ContactPoint.value | Phone number |
| XTN.2 | ContactPoint.use | Telecommunication use code |
| XTN.3 | ContactPoint.system | Equipment type |

**XTN.2 (Use) Mapping:**

| HL7v2 Value | FHIR Value |
|-------------|------------|
| PRN | home |
| WPN | work |
| ORN | old |
| (default) | home |

**XTN.3 (System) Mapping:**

| HL7v2 Value | FHIR Value |
|-------------|------------|
| PH | phone |
| FX | fax |
| Internet | email |
| (default) | phone |

### CE → CodeableConcept (Language)

| HL7v2 Component | FHIR Element | Description |
|-----------------|--------------|-------------|
| CE.1 | CodeableConcept.coding[].code | Language code |
| CE.2 | CodeableConcept.coding[].display | Language text |
| | CodeableConcept.coding[].system | `"urn:ietf:bcp:47"` |
| CE.2 | CodeableConcept.text | Language text |

**Communication Structure:**

```json
{
  "language": {
    "coding": [{"code": "E", "system": "urn:ietf:bcp:47", "display": "ENGLISH"}],
    "text": "ENGLISH"
  },
  "preferred": true
}
```

## Code Mappings

### PID-8 Administrative Sex → Patient.gender

| HL7v2 Value | FHIR Value |
|-------------|------------|
| M | male |
| F | female |
| O | other |
| U | unknown |
| (other) | (omitted) |

### PID-16 Marital Status → Patient.maritalStatus

| HL7v2 Value | FHIR Coding |
|-------------|-------------|
| S | `{code: "S", system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"}` |
| M | `{code: "M", system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"}` |
| D | `{code: "D", system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"}` |
| W | `{code: "W", system: "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"}` |
| (direct) | Code passed through directly |
