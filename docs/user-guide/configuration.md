# Configuration

## Environment Variables

### Aidbox Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `AIDBOX_URL` | `http://localhost:8080` | Aidbox FHIR server URL |
| `AIDBOX_CLIENT_ID` | `root` | Aidbox client ID |
| `AIDBOX_CLIENT_SECRET` | `Vbro4upIT1` | Aidbox client secret |

### BAR Message Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FHIR_APP` | - | Sending application name (MSH-3) |
| `FHIR_FAC` | - | Sending facility name (MSH-4) |
| `BILLING_APP` | - | Receiving application name (MSH-5) |
| `BILLING_FAC` | - | Receiving facility name (MSH-6) |

### MLLP Server

| Variable | Default | Description |
|----------|---------|-------------|
| `MLLP_PORT` | `2575` | MLLP server listening port |

## Docker Compose Configuration

<!-- TODO: Describe docker-compose.yaml customization options -->

## Custom FHIR Resources

<!-- TODO: Describe how to modify init-bundle.json for custom resources -->
