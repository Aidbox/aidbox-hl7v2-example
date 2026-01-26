# Getting Started

Before diving in, you may want to read [Concepts](concepts.md) to understand HL7v2, FHIR, and how the system processes messages.

## Prerequisites

- [Bun](https://bun.sh) v1.2+
- [Docker](https://docker.com) and Docker Compose

## Installation

```sh
# Clone the repository
git clone <repository-url>
cd aidbox-hl7v2-example

# Install dependencies
bun install

# Start Aidbox and PostgreSQL
docker compose up -d
```

## First Run

### 1. Activate Aidbox License

On first run, Aidbox requires license activation:

1. Open http://localhost:8080 in your browser
2. You'll be redirected to [aidbox.app](https://aidbox.app) to log in
3. After login, your license is automatically activated
4. Return to http://localhost:8080 - you should see the Aidbox console

### 2. Run Database Migrations

This creates the custom FHIR resources (OutgoingBarMessage, IncomingHL7v2Message):

```sh
bun run migrate
```

### 3. Start the Web Server

```sh
bun run dev
```

The server starts with hot reload. Logs are written to `logs/server.log`.

### 4. Load Test Data (Optional)

To populate Aidbox with sample patients, encounters, conditions, procedures, and coverages:

```sh
bun scripts/load-test-data.ts
```

This creates 5 patients with related resources for testing.

## Access Points

| Service | URL | Credentials |
|---------|-----|-------------|
| Web UI | http://localhost:3000 | - |
| Aidbox Console | http://localhost:8080 | root / Vbro4upIT1 |
| MLLP Server | localhost:2575 | - |

## Starting Background Services

The web UI triggers processing on-demand via buttons. For continuous background processing, run these services separately:

```sh
# Process pending invoices → generate BAR messages
bun src/bar/invoice-builder-service.ts

# Send pending outgoing messages
bun src/bar/sender-service.ts

# Process incoming HL7v2 messages → convert to FHIR
bun src/v2-to-fhir/processor-service.ts

# Start MLLP server to receive HL7v2 messages
bun run mllp
```

## Quick Workflow Test

1. Open http://localhost:3000/invoices
2. Create a new invoice (select a patient, add encounters/procedures)
3. Click "Build BAR" to generate a BAR message
4. Go to "Outgoing Messages" to see the generated HL7v2 message
5. Click "Send Messages" to send it to the incoming queue
6. Go to "Incoming Messages" to see the received message
7. Click "Process Messages" to convert it to FHIR resources

## Stopping Services

```sh
# Stop the web server
bun run stop

# Stop Aidbox and PostgreSQL
docker compose down
```

## Next Steps

- [Overview](overview.md) - Understand the system architecture and workflows
- [Configuration](configuration.md) - Customize environment variables
- [Troubleshooting](troubleshooting.md) - Common issues and solutions

**For developers:**
- [Developer Guide](../developer-guide/README.md) — Architecture, feature docs, and day-to-day workflows
