# Troubleshooting

For background on message types, statuses, and terminology, see [Concepts](concepts.md).

## Message Status Reference

### IncomingHL7v2Message Status

| Status | Meaning | Action |
|--------|---------|--------|
| `received` | Message received, awaiting processing | Will be processed automatically |
| `processed` | Successfully converted to FHIR | No action needed |
| `error` | Processing failed | Check `error` field, fix issue, use "Mark for Retry" |
| `mapping_error` | OBX codes need LOINC mapping | Resolve via `/mapping/tasks` |

### OutgoingBarMessage Status

| Status | Meaning | Action |
|--------|---------|--------|
| `pending` | Message created, awaiting send | Will be sent automatically or use "Send Messages" |
| `sent` | Successfully sent | No action needed |
| `error` | Send failed | Check logs, retry |

### Invoice Processing Status

| Status | Meaning | Action |
|--------|---------|--------|
| `pending` | Awaiting BAR generation | Will be processed automatically |
| `completed` | BAR message created | No action needed |
| `error` | Generation failed | Use "Reprocess Errors" (max 3 retries) |
| `failed` | Exceeded retry limit | Manual investigation needed |

## Common Issues

### Aidbox won't start

**Symptoms:** Container exits immediately or health check fails.

**Check container logs:**
```sh
docker compose logs aidbox
```

**Common causes:**

1. **License not activated**
   - On first run, you must activate the license
   - Open http://localhost:8080 and log in at aidbox.app
   - The license is stored in the database, so it persists across restarts

2. **PostgreSQL not ready**
   - Aidbox depends on PostgreSQL starting first
   - Solution: Run `docker compose down && docker compose up -d`

3. **Port 8080 already in use**
   - Check: `lsof -i :8080`
   - Solution: Stop the conflicting service or change the port in docker-compose.yaml

4. **Database corruption**
   - Reset the database: `docker compose down -v && docker compose up -d`
   - Re-run migrations: `bun run migrate`

### Messages stuck in "received" status

**Symptoms:** Messages appear on Incoming Messages page but never process.

**Causes:**

1. **Processor service not running**
   - The web UI only triggers on-demand processing via buttons
   - For automatic processing, run: `bun src/v2-to-fhir/processor-service.ts`

2. **Click "Process Messages" button**
   - Go to http://localhost:3000/incoming-messages
   - Click "Process Messages" to trigger processing

3. **Check for errors**
   - If processing fails, the status changes to `error` or `mapping_error`
   - Check the `error` field for details

### MLLP connection refused

**Symptoms:** Cannot connect to MLLP server on port 2575.

**Causes:**

1. **MLLP server not running**
   ```sh
   bun run mllp
   ```

2. **Wrong port**
   - Check the configured port: `echo $MLLP_PORT` (default: 2575)
   - Verify the server is listening: `lsof -i :2575`

3. **Docker network issues**
   - MLLP runs outside Docker, ensure localhost is accessible
   - If connecting from another container, use host IP instead of localhost

### Code mapping errors

**Symptoms:** Messages have `status=mapping_error` with unmapped codes listed.

**Resolution:**

1. Go to http://localhost:3000/mapping/tasks
2. Review each unmapped code
3. Search for the matching LOINC code
4. Click "Resolve" to save the mapping
5. Messages automatically return to `received` status
6. Click "Process Messages" on the Incoming Messages page

**If the LOINC code doesn't exist:**
- The code may be a local code that needs a different mapping
- Check the sample context (value, units, reference range) for hints
- Consult the sending system's documentation

### Patient/Encounter not found

**Symptoms:** Processing fails with "Patient not found" or "Encounter not found".

**Cause:** The incoming message references a Patient ID (PID-3) or Encounter ID (PV1-19) that doesn't exist in Aidbox.

**Solutions:**

1. **Create the missing Patient**
   - The Patient must exist before processing ORU messages
   - Send an ADT^A01 (admission) message first to create the Patient and Encounter
   - Or manually create the Patient in Aidbox

2. **Check identifier matching**
   - PID-3 value must match Patient.identifier[].value in Aidbox
   - PV1-19 value must match Encounter.identifier[].value in Aidbox

### Invoice BAR generation fails

**Symptoms:** Invoice stays in `pending` or `error` status, no BAR message created.

**Check the error:**
- Query the invoice to see the error:
  ```sh
  curl -u root:Vbro4upIT1 \
    "http://localhost:8080/fhir/Invoice?processing-status=error"
  ```

**Common causes:**

1. **Missing required references**
   - Invoice must have a `subject` (Patient reference)
   - Need at least one related Encounter

2. **Missing Account**
   - Create an Account resource linked to the Patient
   - The Account provides the PID-18 account number

3. **Builder service not running**
   - For automatic processing: `bun src/bar/invoice-builder-service.ts`
   - Or click "Build BAR" button in the UI

### Web UI not loading

**Symptoms:** http://localhost:3000 shows error or blank page.

**Causes:**

1. **Server not running**
   ```sh
   bun run dev
   ```

2. **Port conflict**
   - Check: `lsof -i :3000`
   - The server runs on port 3000 by default

3. **Check server logs**
   ```sh
   bun run logs
   # or
   cat logs/server.log
   ```

## Logs

### Web Server Logs

```sh
# View live logs
bun run logs

# View last 100 lines
tail -100 logs/server.log

# Search for errors
grep -i error logs/server.log
```

### Docker Logs

```sh
# Aidbox logs
docker compose logs -f aidbox

# PostgreSQL logs
docker compose logs -f postgres

# All logs
docker compose logs -f
```

### Aidbox Request Logs

Aidbox logs all FHIR API requests. Check for:
- Failed validation errors
- Missing resource errors
- Authorization issues

```sh
docker compose logs aidbox | grep -i error
```

## Resetting State

### Clear All Messages

```sh
# Delete all incoming messages
curl -X DELETE -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/IncomingHL7v2Message"

# Delete all outgoing messages
curl -X DELETE -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/OutgoingBarMessage"
```

### Reset Database

This deletes all data and starts fresh:

```sh
docker compose down -v
docker compose up -d
bun run migrate
bun scripts/load-test-data.ts  # Optional: reload test data
```

### Clear ConceptMaps

To reset all code mappings:

```sh
curl -X DELETE -u root:Vbro4upIT1 \
  "http://localhost:8080/fhir/ConceptMap"
```

## Getting Help

If you're still stuck:

1. Check the developer guide in `docs/developer-guide/`
2. Review the source code in `src/`
3. Open an issue with:
   - Steps to reproduce
   - Error messages
   - Relevant log output
