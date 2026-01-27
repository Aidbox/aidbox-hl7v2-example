# Overview

This document explains what the system does, how the different pieces fit together, and how to operate it day-to-day.

## What This System Does

This system is a bridge between [HL7v2 and FHIR](concepts.md#hl7v2-and-fhir) — it receives HL7v2 messages and converts them to FHIR resources, and generates HL7v2 messages from FHIR data.

The system handles two main flows:

1. **Inbound:** Receive HL7v2 messages from external systems (labs, other hospitals) and convert them into FHIR resources stored in Aidbox
2. **Outbound:** Take billing data from Aidbox and generate HL7v2 BAR messages for external billing systems

## System Architecture

```
┌─────────────────────┐                                     ┌─────────────────────┐
│  External Systems   │                                     │       Aidbox        │
│  (Labs, Hospitals,  │                                     │   (FHIR Server)     │
│   Billing Systems)  │                                     │                     │
└──────────┬──────────┘                                     └──────────┬──────────┘
           │                                                           │
           │ HL7v2 (MLLP)                                     FHIR API │
           │                                                           │
           │            ┌───────────────────────────────┐              │
           │            │        This System            │              │
           └───────────►│                               │◄─────────────┘
           ^            │  • MLLP Server                │              ^
           └────────────│  • Message Processor          │──────────────┘
                        │  • BAR Generator              │
                        │  • Web UI                     │
                        └───────────────────────────────┘
```

The system sits between external HL7v2 systems and your FHIR server. It speaks HL7v2 (via MLLP) on one side and FHIR (via REST API) on the other.

Aidbox is the central data store. It holds all FHIR resources (patients, encounters, observations) as well as the message queues (incoming messages waiting to be processed, outgoing messages waiting to be sent).

## Inbound Flow: Receiving HL7v2 Messages

When external systems send HL7v2 messages to your organization, this is how they're processed:

### Step 1: Message Arrives via MLLP

External systems connect to the [MLLP](concepts.md#mllp-minimal-lower-layer-protocol) server and send HL7v2 messages.

When a message arrives:
1. The MLLP server parses the message and extracts key information (message type, sender, timestamp)
2. The message is stored in Aidbox as an `IncomingHL7v2Message` resource with status `received`
3. An acknowledgment (ACK) is sent back to the sender

At this point, the message is safely stored but not yet processed.

**Web UI:** Open [Incoming Messages Page](/incoming-messages) and filter by status "Received" to see messages waiting to be processed.

### Step 2: Message Processing

Processing converts the HL7v2 message into FHIR resources. What gets created depends on the message type:

| Message Type          | What It Creates                          |
|-----------------------|------------------------------------------|
| ADT^A01 (Admission)   | Patient, Encounter                       |
| ADT^A08 (Update)      | Updates to existing Patient              |
| ORU^R01 (Lab Results) | DiagnosticReport, Observations, Specimen |

Processing can happen two ways:
- **On-demand:** Click "Process Messages" on the [Incoming Messages Page](/incoming-messages) page
- **Background:** [Run the processor service](getting-started.md#starting-background-services) for continuous processing

After successful processing, the message status changes to `processed`. You can see the status change on [Incoming Messages](/incoming-messages) and find the created FHIR resources in the [Aidbox Console](http://localhost:8080).

### Step 3: Handling Unmapped Codes (Lab Results)

Lab results (ORU^R01 messages) contain codes that identify each test. Many labs use local codes instead of standard [LOINC](concepts.md#loinc) codes, which need to be mapped before the message can be processed.

When the system encounters a code it doesn't recognize:
1. The message gets status `mapping_error` on [Incoming Messages Page](/incoming-messages)
2. A mapping task is created for each unmapped code on [Mapping Tasks Page](/mapping/tasks)
3. You resolve the task by selecting the corresponding LOINC code
4. The mapping is saved to a [ConceptMap](concepts.md#conceptmap) (visible on [Code Mappings Page](/mapping/table))
5. The message returns to `received` status and can be processed

## Outbound Flow: Generating BAR Messages

When your organization needs to send billing information to external systems, this flow generates HL7v2 BAR (Billing/Accounts Receivable) messages from FHIR data.

### Step 1: Invoice Creation

Invoices are created in Aidbox, either:
- Through the web UI (for testing)
- By your EHR or billing system via the FHIR API

Each invoice references a patient and includes encounters, procedures, and other billable items. New invoices start with processing status `pending`.

**Web UI:** The [Invoices](/invoices) page shows all invoices and their processing status. Use the status filter to find pending, completed, or failed invoices.

### Step 2: BAR Message Generation

The BAR builder takes a pending invoice and:
1. Fetches the patient and all related resources (encounters, conditions, procedures, coverage, guarantor)
2. Maps each FHIR resource to the corresponding HL7v2 segment:
   - Patient → PID (patient identification)
   - Encounter → PV1 (patient visit)
   - Condition → DG1 (diagnosis)
   - Procedure → PR1 (procedure)
   - Coverage → IN1 (insurance)
   - RelatedPerson → GT1 (guarantor)
3. Assembles the complete BAR message
4. Stores it as an `OutgoingBarMessage` with status `pending`
5. Updates the invoice: sets `Invoice.status` to `issued` and `processing-status` to `completed`

Note: The system tracks two separate statuses for invoices. `Invoice.status` is the standard FHIR field indicating the invoice lifecycle (`draft` → `issued`). The `processing-status` extension tracks the BAR generation workflow (`pending` → `completed` or `error`).

Generation can happen two ways:
- **On-demand:** Click "Build BAR" on the [Invoices](/invoices) page
- **Background:** [Run the builder service](getting-started.md#starting-background-services) for continuous processing

**Web UI:** After generation, the invoice status changes to "Completed" on [Invoices](/invoices). The generated BAR message appears on [Outgoing Messages](/outgoing-messages) with status "Pending".

### Step 3: Message Transmission

The sender service takes pending outgoing messages and transmits them to the destination system.

Currently, the system simulates transmission by posting to its own incoming queue (for demonstration). In production, you would modify the sender to transmit via MLLP to your actual billing system.

Transmission can happen two ways:
- **On-demand:** Click "Send Messages" on the [Outgoing Messages](/outgoing-messages) page
- **Background:** [Run the sender service](getting-started.md#starting-background-services) for continuous transmission

**Web UI:** After transmission, the message status changes to "Sent" on [Outgoing Messages](/outgoing-messages). In demo mode, the message also appears on [Incoming Messages](/incoming-messages).

## On-Demand vs Background Processing

The system uses a pull-based architecture where services poll Aidbox for work. This means if a service restarts, no work is lost—unprocessed items remain in the queue. For technical details, see [Architecture](../developer-guide/architecture.md).

You can trigger processing two ways:

- **On-demand:** Use action buttons in the web UI (useful for testing and debugging)
- **Background:** Run services continuously for automatic processing (recommended for production)

See [Starting Background Services](getting-started.md#starting-background-services) for setup instructions.

## Error Handling and Retries

### Incoming Messages

When message processing fails:
- Status changes to `error` (visible on [Incoming Messages Page](/incoming-messages))
- The error message is shown on the message card
- Click "Mark for Retry" to reset to `received` and try again

### Invoices

When BAR generation fails:
- Status changes to `error` (visible on [Invoices Page](/invoices))
- Click "Reprocess Errors" to retry all failed invoices (up to 3 attempts)
- After 3 failures, status becomes `failed` (requires manual investigation)

### Code Mapping

Messages with unmapped codes get status `mapping_error` on [Incoming Messages Page](/incoming-messages). They won't process until you resolve all unmapped codes on [Mapping Tasks Page](/mapping/tasks).

## Web UI Pages

The web UI provides visibility into all queues and operations:

| Page                  | URL                                      | Purpose                                                            |
|-----------------------|------------------------------------------|--------------------------------------------------------------------|
| **Invoices**          | [/invoices](/invoices)                   | Create invoices, trigger BAR generation, monitor processing status |
| **Outgoing Messages** | [/outgoing-messages](/outgoing-messages) | View generated BAR messages, trigger transmission                  |
| **Incoming Messages** | [/incoming-messages](/incoming-messages) | Monitor received messages, trigger processing, retry failures      |
| **Mapping Tasks**     | [/mapping/tasks](/mapping/tasks)         | Resolve unmapped lab codes to LOINC                                |
| **Code Mappings**     | [/mapping/table](/mapping/table)         | View and manage all code mappings by sender                        |
| **MLLP Test Client**  | [/mllp-client](/mllp-client)             | Send test HL7v2 messages for debugging                             |
