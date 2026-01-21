# Concepts

This page explains key terminology and standards you'll encounter when working with the system.

## HL7v2 and FHIR

**HL7v2** is a messaging standard widely used in healthcare for exchanging clinical data between systems. Messages are pipe-delimited text with segments like `PID` (patient), `OBR` (order), and `OBX` (observation result).

**FHIR** (Fast Healthcare Interoperability Resources) is a modern healthcare data standard using JSON/XML resources like Patient, Encounter, and Observation.

This system bridges both worlds: it receives HL7v2 messages and converts them to FHIR resources, and generates HL7v2 messages from FHIR resources.

## Supported Message Types

### ADT (Admit/Discharge/Transfer)

Patient administrative events:
- **ADT^A01** - Patient admission (creates Patient and Encounter)
- **ADT^A08** - Patient information update

### ORU (Observation Result)

Laboratory results:
- **ORU^R01** - Lab results (creates DiagnosticReport, Observation, Specimen)

### BAR (Billing Account Record)

Billing information:
- **BAR^P01** - Add patient account (generated from FHIR Invoice)
- **BAR^P05** - Update patient account
- **BAR^P06** - End patient account

## HL7v2 Message Structure

An HL7v2 message consists of segments, each starting with a 3-letter code:

```
MSH|^~\&|SENDING_APP|SENDING_FAC|RECEIVING_APP|RECEIVING_FAC|...
PID|||12345^^^HOSPITAL||Smith^John||19800101|M|||...
PV1||I|ICU^101^A||||DRSMITH^Smith^Jane|||...
```

**Common segments:**
- **MSH** - Message header (sender, receiver, message type, timestamp)
- **PID** - Patient identification (name, DOB, identifiers)
- **PV1** - Patient visit (encounter type, location, attending physician)
- **OBR** - Observation request (order information)
- **OBX** - Observation result (individual test result)
- **DG1** - Diagnosis
- **PR1** - Procedure
- **IN1** - Insurance
- **GT1** - Guarantor

**Field notation:** `PID-3` means "segment PID, field 3" (patient identifier). `MSH-9` is the message type field.

## MLLP (Minimal Lower Layer Protocol)

MLLP is a simple TCP protocol for transmitting HL7v2 messages. Each message is wrapped with special characters:
- Start block: `0x0B` (vertical tab character)
- End block: `0x1C 0x0D` (file separator + carriage return)

This framing allows the receiver to know where each message begins and ends over a continuous TCP stream.

## LOINC

**LOINC** (Logical Observation Identifiers Names and Codes) is the standard coding system for laboratory tests and clinical observations. When labs send results, they should use LOINC codes so receiving systems know exactly which test was performed.

For example:
- `2823-3` = Potassium [Moles/volume] in Serum or Plasma
- `1558-6` = Fasting glucose [Mass/volume] in Serum or Plasma
- `4548-4` = Hemoglobin A1c/Hemoglobin.total in Blood

The problem is that many labs use their own local codes instead of LOINC. This system provides a code mapping workflow to translate local codes to LOINC.

## ConceptMap

A FHIR ConceptMap resource stores code translations. In this system:
- One ConceptMap per sending system (identified by the sender information in message headers)
- Maps local codes → LOINC codes
- Used automatically during lab result processing

When a message arrives with an unmapped code, the system creates a task for you to resolve. Once you specify the LOINC equivalent, it's saved to the ConceptMap for future messages.

## FHIR Resources

Common FHIR resources used in this system:

| Resource | Purpose |
|----------|---------|
| **Patient** | Demographics, identifiers |
| **Encounter** | A patient visit or admission |
| **Observation** | A single measurement or test result |
| **DiagnosticReport** | A collection of observations from a lab order |
| **Specimen** | The sample that was tested |
| **Condition** | A diagnosis |
| **Procedure** | A medical procedure performed |
| **Coverage** | Insurance information |
| **Invoice** | A billing invoice |

## Aidbox

[Aidbox](https://www.health-samurai.io/aidbox) is a FHIR server that serves as the central data store for this system. All FHIR resources are stored in Aidbox, and the system communicates with it via the standard FHIR REST API.

Aidbox also allows defining custom resources. This system uses two custom resources:
- **IncomingHL7v2Message** - Stores received HL7v2 messages and their processing status
- **OutgoingBarMessage** - Stores generated BAR messages waiting to be sent
