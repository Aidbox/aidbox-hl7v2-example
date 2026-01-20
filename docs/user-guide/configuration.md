# Configuration

## Environment Variables

Bun automatically loads `.env` files. Create a `.env` file in the project root to override defaults.

### Aidbox Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `AIDBOX_URL` | `http://localhost:8080` | Aidbox FHIR server URL |
| `AIDBOX_CLIENT_ID` | `root` | Aidbox client ID |
| `AIDBOX_CLIENT_SECRET` | `Vbro4upIT1` | Aidbox client secret |

### BAR Message Configuration

Configure HL7v2 message header fields (MSH segment) for outbound BAR messages.

| Variable | Default | Description |
|----------|---------|-------------|
| `FHIR_APP` | (empty) | Sending application name (MSH-3) |
| `FHIR_FAC` | (empty) | Sending facility name (MSH-4) |
| `BILLING_APP` | (empty) | Receiving application name (MSH-5) |
| `BILLING_FAC` | (empty) | Receiving facility name (MSH-6) |

Example `.env` for production:
```
FHIR_APP=HOSPITAL_FHIR
FHIR_FAC=MAIN_CAMPUS
BILLING_APP=BILLING_SYSTEM
BILLING_FAC=BILLING_DEPT
```

### MLLP Server

| Variable | Default | Description |
|----------|---------|-------------|
| `MLLP_PORT` | `2575` | MLLP server listening port |

## Docker Compose Configuration

The `docker-compose.yaml` starts two services: PostgreSQL (database) and Aidbox (FHIR server).

### Changing Ports

**Aidbox port** (default 8080):
```yaml
services:
  aidbox:
    ports:
    - 9000:8080  # Change 9000 to desired external port
```

If you change the port, also update `BOX_WEB_BASE_URL` and your `AIDBOX_URL` environment variable.

### Persistent Data

PostgreSQL data is stored in a Docker volume named `postgres_data`. Data persists across container restarts.

To reset the database:
```sh
docker compose down -v   # -v removes volumes
docker compose up -d
```

### Aidbox License

On first run, Aidbox requires license activation:
1. Navigate to http://localhost:8080
2. Log in at aidbox.app
3. License is automatically activated

### Key Aidbox Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `BOX_FHIR_COMPLIANT_MODE` | `true` | Strict FHIR R4 compliance |
| `BOX_FHIR_SCHEMA_VALIDATION` | `true` | Validate resources against FHIR schemas |
| `BOX_FHIR_TERMINOLOGY_ENGINE` | `hybrid` | Use external terminology server for LOINC lookups |
| `BOX_INIT_BUNDLE` | `file:///init-bundle.json` | Load custom resources on startup |

### Terminology Server

LOINC code lookup uses the Health Samurai terminology server:
```yaml
BOX_FHIR_TERMINOLOGY_SERVICE_BASE_URL: https://tx.health-samurai.io/fhir
```

To use a different terminology server, change this URL.

## Custom FHIR Resources

Custom resources are defined in `init-bundle.json` and loaded automatically when Aidbox starts.

### OutgoingBarMessage

Stores generated BAR messages pending transmission.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `patient` | Reference(Patient) | Yes | Patient the message is about |
| `invoice` | Reference(Invoice) | Yes | Source invoice |
| `status` | string | Yes | `pending`, `sent`, or `error` |
| `hl7v2` | string | No | The HL7v2 message content |

### IncomingHL7v2Message

Stores received HL7v2 messages and their processing status.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | Message type (e.g., `ADT^A01`, `ORU^R01`) |
| `date` | dateTime | No | Message timestamp |
| `message` | string | Yes | Raw HL7v2 message content |
| `status` | string | No | `received`, `processed`, `error`, `mapping_error` |
| `error` | string | No | Error message if processing failed |
| `bundle` | string | No | JSON of created FHIR resources |
| `sendingApplication` | string | No | MSH-3 sending application |
| `sendingFacility` | string | No | MSH-4 sending facility |
| `patient` | Reference(Patient) | No | Linked patient after processing |
| `unmappedCodes` | BackboneElement[] | No | OBX codes needing LOINC mapping |

**unmappedCodes structure:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `localCode` | string | Yes | The unmapped code |
| `localDisplay` | string | No | Code description |
| `localSystem` | string | No | Source code system |
| `mappingTask` | Reference(Task) | Yes | Task for resolving this code |

### Invoice Extensions

The Invoice resource uses extensions to track processing status:

| Extension URL | Value Type | Description |
|--------------|------------|-------------|
| `http://example.org/invoice-processing-status` | code | `pending`, `completed`, `error`, `failed` |
| `http://example.org/invoice-processing-retry-count` | integer | Number of retry attempts |
| `http://example.org/invoice-processing-error-reason` | string | Error description |

## Adding Custom Resources

To add new custom resources:

1. Edit `init-bundle.json` and add a StructureDefinition entry
2. Add SearchParameter entries if you need to query by custom fields
3. Restart Aidbox: `docker compose restart aidbox`
4. Run migrations: `bun migrate`

Example StructureDefinition pattern:
```json
{
  "request": { "method": "PUT", "url": "StructureDefinition/MyResource" },
  "resource": {
    "resourceType": "StructureDefinition",
    "id": "MyResource",
    "name": "MyResource",
    "type": "MyResource",
    "status": "active",
    "kind": "resource",
    "baseDefinition": "http://hl7.org/fhir/StructureDefinition/DomainResource",
    "derivation": "specialization",
    "differential": {
      "element": [
        { "id": "MyResource", "path": "MyResource", "min": 0, "max": "*" },
        { "id": "MyResource.myField", "path": "MyResource.myField", "min": 1, "max": "1", "type": [{ "code": "string" }] }
      ]
    }
  }
}
```
