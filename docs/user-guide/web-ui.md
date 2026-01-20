# Web UI Guide

## Navigation

The navigation bar appears at the top of every page with links to all sections. Badge counts show pending items requiring attention:
- **Invoices** - Count of invoices with `pending` or `error` status
- **Mapping Tasks** - Count of unmapped codes awaiting resolution

## Invoices Page

**URL:** `/invoices`

Manages billing invoices that trigger BAR message generation.

### Status Filter

Filter invoices by processing status using the dropdown:
- **All** - Show all invoices
- **Pending** - Awaiting BAR generation
- **Completed** - BAR message successfully created
- **Error** - Generation failed (can be retried)
- **Failed** - Exceeded retry limit (requires manual investigation)

### Actions

| Button | Action |
|--------|--------|
| **Build BAR** | Generate BAR messages for all pending invoices |
| **Reprocess Errors** | Retry failed invoices (max 3 attempts, then marked as `failed`) |
| **Create Invoice** | Open form to create a new invoice |

### Creating an Invoice

1. Click "Create Invoice"
2. Select a **Patient** from the dropdown
3. Select **Encounters** to include (multi-select)
4. Select **Procedures** to include (multi-select)
5. Enter **Amount** and **Currency**
6. Click "Create"

The invoice is created with `processing-status=pending` and will be picked up by "Build BAR".

## Outgoing Messages Page

**URL:** `/outgoing-messages`

Displays BAR messages generated from invoices, ready to send.

### Status Filter

- **All** - Show all messages
- **Pending** - Awaiting send
- **Sent** - Successfully delivered
- **Error** - Send failed

### HL7v2 Message Display

Each message shows the raw HL7v2 content with syntax highlighting:
- **Segment names** (MSH, PID, PV1) in bold
- **Field delimiters** `|` colored for readability
- **Hover tooltips** show field names and data types

### Actions

| Button | Action |
|--------|--------|
| **Send Messages** | Send all pending messages |

## Incoming Messages Page

**URL:** `/incoming-messages`

Displays HL7v2 messages received via MLLP or sent from outgoing messages.

### Status Filter

- **All** - Show all messages
- **Received** - Awaiting processing
- **Processed** - Successfully converted to FHIR
- **Error** - Processing failed
- **Mapping Error** - Contains unmapped OBX codes

### Message Details

Each message shows:
- **Type** - Message type (e.g., ADT^A01, ORU^R01)
- **Sender** - Sending application and facility (MSH-3/MSH-4)
- **Date** - Message timestamp
- **Status** - Current processing status
- **Error** - Error message (if failed)
- **Unmapped Codes** - List of OBX codes needing LOINC mapping (if mapping_error)

### Actions

| Button | Action |
|--------|--------|
| **Process Messages** | Process all received messages to FHIR |
| **Mark for Retry** | Reset a failed message to `received` for reprocessing |

### Handling Mapping Errors

When a message has `status=mapping_error`:
1. The unmapped OBX codes are listed on the message card
2. Click through to `/mapping/tasks` to resolve them
3. Once all codes are mapped, the message automatically returns to `received` status
4. Click "Process Messages" to complete conversion

## Mapping Tasks Page

**URL:** `/mapping/tasks`

Queue of unmapped laboratory codes requiring LOINC mapping.

### Task List

Each task shows:
- **Sender** - Sending application/facility that sent the code
- **Local Code** - The unmapped code (e.g., "K_SERUM")
- **Local Display** - Description from the source system
- **Sample Context** - Example value, units, reference range from the message

### Resolving a Task

1. Review the local code and sample context
2. Use the **LOINC Search** field to find the matching LOINC code
3. Type at least 2 characters to search (searches code and display text)
4. Select the correct LOINC code from the dropdown
5. Click "Resolve"

Once resolved:
- The mapping is saved to the sender's ConceptMap
- The task is marked as completed
- Affected messages have the code removed from `unmappedCodes`
- Messages with no remaining unmapped codes return to `received` status

### Completed Tasks

Toggle "Show Completed" to view previously resolved tasks with their LOINC mappings.

## Code Mappings Page

**URL:** `/mapping/table`

Direct management of ConceptMap entries for local-to-LOINC mappings.

### Sender Filter

Select a sender (ConceptMap) from the dropdown to view/edit its mappings.

### Mapping Table

| Column | Description |
|--------|-------------|
| **Local Code** | Code from the sending system |
| **Local Display** | Description of the local code |
| **Local System** | Code system identifier |
| **LOINC Code** | Mapped LOINC code |
| **LOINC Display** | LOINC description |
| **Actions** | Edit or Delete |

### Adding a Mapping

1. Click "Add Mapping"
2. Enter the **Local Code**, **Local Display**, and **Local System**
3. Search for and select the **LOINC Code**
4. Click "Add"

### Editing a Mapping

1. Click "Edit" on the mapping row
2. Search for and select a new LOINC code
3. Click "Save"

### Deleting a Mapping

1. Click "Delete" on the mapping row
2. Confirm the deletion

**Note:** Deleting a mapping may cause future messages with that code to fail with `mapping_error`.

## MLLP Test Client

**URL:** `/mllp-client`

Send test HL7v2 messages to the MLLP server.

### Configuration

- **Host** - MLLP server hostname (default: localhost)
- **Port** - MLLP server port (default: 2575)

### Sample Messages

Select from pre-built sample messages:
- **ADT^A01** - Patient admission
- **ADT^A08** - Patient information update
- **BAR^P01** - Billing account record
- **ORU^R01** - Lab results (will trigger code mapping if codes unmapped)

### Custom Message

1. Select "Custom" from the dropdown
2. Paste your HL7v2 message in the text area
3. Click "Send"

### Response

After sending, the page displays:
- **ACK Response** - The HL7v2 acknowledgment (AA=accepted, AE=error, AR=rejected)
- **Error Details** - If the message was rejected

The sent message is stored in Aidbox and appears on the Incoming Messages page.
