# Configuration

## Quick Setup

For most deployments, you only need to configure these settings in a `.env` file:

| Setting | Example | When to Change |
|---------|---------|----------------|
| `AIDBOX_URL` | `http://aidbox.internal:8080` | Aidbox not on localhost |
| `MLLP_PORT` | `2575` | Port conflict or firewall rules |
| `FHIR_APP` / `FHIR_FAC` | `HOSPITAL_FHIR` / `MAIN_CAMPUS` | Identify your system in outbound messages |
| `BILLING_APP` / `BILLING_FAC` | `BILLING_SYS` / `BILLING_DEPT` | Identify the receiving billing system |

## Configuration by Use Case

### Changing Default Credentials (Required for Production)

The default Aidbox credentials (`root`/`Vbro4upIT1`) are for development only. **You must change these before deploying to any non-local environment.**

To change credentials:

1. Update `docker-compose.yaml`:
   ```yaml
   AIDBOX_CLIENT_ID: your-secure-client-id
   AIDBOX_CLIENT_SECRET: your-secure-secret  # Use a strong, random value
   ```

2. Update your `.env` file to match:
   ```env
   AIDBOX_CLIENT_ID=your-secure-client-id
   AIDBOX_CLIENT_SECRET=your-secure-secret
   ```

3. Restart Aidbox: `docker compose down && docker compose up -d`

### Connecting to a Remote Aidbox

If Aidbox runs on a different host:

```env
AIDBOX_URL=http://aidbox.yournetwork.local:8080
AIDBOX_CLIENT_ID=your-client-id
AIDBOX_CLIENT_SECRET=your-client-secret
```

### Setting Up Outbound BAR Messages

Configure the message header fields so receiving systems know who sent the message:

```env
# Your system (appears in MSH-3 and MSH-4)
FHIR_APP=HOSPITAL_FHIR
FHIR_FAC=MAIN_CAMPUS

# Destination billing system (appears in MSH-5 and MSH-6)
BILLING_APP=BILLING_SYSTEM
BILLING_FAC=BILLING_DEPT
```

### Using a Different Terminology Server

LOINC lookups use an external terminology server. To use your own:

Edit `docker-compose.yaml`:
```yaml
BOX_FHIR_TERMINOLOGY_SERVICE_BASE_URL: https://your-terminology-server/fhir
```

Then restart Aidbox: `docker compose restart aidbox`

## Environment Variable Reference

### Aidbox Connection

| Variable | Default | Description |
|----------|---------|-------------|
| `AIDBOX_URL` | `http://localhost:8080` | Aidbox FHIR server URL |
| `AIDBOX_CLIENT_ID` | `root` | Aidbox client ID |
| `AIDBOX_CLIENT_SECRET` | `Vbro4upIT1` | Aidbox client secret |

### BAR Message Headers

| Variable | Default | Description |
|----------|---------|-------------|
| `FHIR_APP` | (empty) | Sending application name (MSH-3) |
| `FHIR_FAC` | (empty) | Sending facility name (MSH-4) |
| `BILLING_APP` | (empty) | Receiving application name (MSH-5) |
| `BILLING_FAC` | (empty) | Receiving facility name (MSH-6) |

### Network

| Variable | Default | Description |
|----------|---------|-------------|
| `MLLP_PORT` | `2575` | MLLP server listening port |

## Docker Configuration

### Changing Aidbox Port

Edit `docker-compose.yaml`:
```yaml
services:
  aidbox:
    ports:
    - 9000:8080  # External:Internal
```

Also update `BOX_WEB_BASE_URL` in the same file and your `AIDBOX_URL` environment variable.

### Resetting the Database

PostgreSQL data persists in a Docker volume. To start fresh:

```sh
docker compose down -v   # -v removes volumes
docker compose up -d
bun run migrate
```

### Aidbox License

On first run, activate the license:
1. Navigate to http://localhost:8080
2. Log in at aidbox.app
3. License is stored in the database and persists across restarts

## Custom FHIR Resources

The system uses custom FHIR resources defined in `init-bundle.json`. For details on their structure, see the [Developer Guide](../developer-guide/README.md).
