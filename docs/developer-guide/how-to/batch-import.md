# Batch import and error triage

A workflow for regression-checking the converter pipeline against a real-world
corpus of HL7v2 messages. Drop a zip (or directory) of messages into the
system, watch them process, then iterate on converter fixes while re-running
the same batch.

## Import a batch

```sh
bun scripts/import-batch.ts <zip-or-dir> [--tag <name>]
```

- Accepts a `.zip` archive, a directory, or a single file.
- `.zip` is extracted via `tar -xf` (ships with Windows 10+, macOS, Linux), so
  no extra dependencies are required.
- Files are walked recursively. RTF wrappers (`{\rtf ...}`) are stripped and
  multi-message files are split on each `MSH|`.
- One `IncomingHL7v2Message` resource is created per extracted message with
  `status=received` and `batchTag` set. The polling worker (see
  [architecture.md](../architecture.md)) picks them up automatically — no
  "Process All" click needed.

`--tag` defaults to `<source-basename>-<yyyyMMddHHmmss>`. Override it if you
want a human-readable label (e.g. `--tag acme-adt-corpus`).

### Example

```sh
bun scripts/import-batch.ts ~/Desktop/ADT_A01.zip --tag acme-adt-corpus
# Imported 87 message(s) as batchTag=acme-adt-corpus
# By type:
#   ADT_A01: 87
# View the batch at: http://localhost:3000/incoming-messages?batch=acme-adt-corpus
```

## Triage the results

Open `http://localhost:3000/incoming-messages?batch=<tag>` (or pick the batch
from the dropdown in the top right of `/incoming-messages`).

The batch summary panel shows:

- Total messages and a status breakdown (clickable chips act as combined
  filters: batch + status).
- **Error groups** — errored messages bucketed by `status × type`, with a
  sample error line per group. This is the starting point for "what's
  broken?" — a high count in one group usually means a single converter bug
  is responsible.
- **Retry all N errored** — a single button that requeues every errored
  message in this batch (see below).

Click a message to expand it: you get the raw HL7v2, the stored error, and —
for code-mapping errors — the list of unmapped codes with links to the
mapping tasks.

## Fix and re-run

Typical loop:

1. Inspect an error group, find the root cause in a converter or preprocessor.
2. Apply the fix, `bun test:local`.
3. Click **Retry all errored** (or `POST /mark-batch-for-retry/<batchTag>`).
   Errored messages flip back to `status=received`, the polling worker picks
   them up, and you compare the before/after counts in the summary.

Only errored messages (`parsing_error`, `conversion_error`,
`code_mapping_error`, `sending_error`) are requeued. Messages that already
reached `processed` or `warning` are left alone — a converter fix can change
their FHIR output, but replaying them would require cleaning up previously
written FHIR resources, which this workflow does not do. If you need that,
drop and re-import the batch into a clean Aidbox
(`bun reset-integration-aidbox` is a starting point).

## Under the hood

- `batchTag` is an optional `string` field on the `IncomingHL7v2Message`
  StructureDefinition (`init-bundle.json`) with a companion SearchParameter
  (`batch-tag`) so Aidbox can filter by it.
- Batch listing in the UI dedupes `batchTag` from the 500 most recent
  messages. If you import more than that in rapid succession, older batches
  disappear from the dropdown but you can still URL-address them with
  `?batch=<tag>`.
