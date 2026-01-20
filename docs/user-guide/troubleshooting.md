# Troubleshooting

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

<!-- TODO: Common Docker issues, license activation -->

### Messages stuck in "received" status

<!-- TODO: Processor service not running, check logs -->

### MLLP connection refused

<!-- TODO: Port configuration, firewall, service not running -->

### Code mapping errors

<!-- TODO: Missing ConceptMap, how to resolve -->

## Logs

```sh
# View web server logs
bun run logs

# Check Docker container logs
docker compose logs -f aidbox
```
