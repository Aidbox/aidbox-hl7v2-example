---
name: message-lookup
description: Check whether an HL7v2 message is already supported by this pipeline (parse → preprocess → convert, prints verdict). Use before building a new converter, triaging "is this supported?", or verifying a parsing/conversion_error fix.
---

# Message Lookup

Quick go/no-go check: does this HL7v2 message already flow through the pipeline, or does something need to change?

## When to use

- **Before designing a new converter.** If the message already converts cleanly, there is nothing to build.
- **When a developer asks "do we support X?"** Routing, preprocessing, and config are all in play — don't answer from memory.
- **After a fix.** Verify the message now succeeds before claiming done.
- **Triaging user-supplied sample messages.** Produces a one-screen summary instead of walking the code.

## Prerequisites

Aidbox must be running. The converter calls `resourceExists` and loads config; without Aidbox, the script fails before reaching a real verdict.

```sh
docker compose ps      # aidbox + postgres should be Up
```

If Aidbox is down, tell the developer and stop — do not proceed.

## Step 1: Save the message to a file

Put the raw HL7v2 bytes in any file (`.hl7`, `.txt`, whatever). MLLP framing bytes (`\x0b`, `\x1c`) and CRLF/LF line endings are stripped automatically. One message per file.

Do not hand the script MLLP-framed multi-message dumps — split them first.

## Step 2: Run the check

Brief human-readable summary (default):

```sh
bun scripts/check-message-support.ts <path-to-file>
```

Full JSON result (bundle + messageUpdate), for programmatic use or deeper inspection:

```sh
bun scripts/check-message-support.ts <path-to-file> --json
```

Exit code: `0` if the message produces status `processed` or `warning`; `1` otherwise.

## Step 3: Interpret the output

The brief output has fixed lines: `Message`, `Sender`, `Routing`, `Status`, `Resources`, optional `Error`, `Verdict`.

| Verdict line | What it means | What to tell the developer |
|---|---|---|
| `supported — message converts cleanly` | Status = `processed`. Bundle built. | "Already supported. No work needed. Here's the resource summary: …" |
| `supported with caveats` | Status = `warning`. Something was skipped (typically Encounter from a missing/invalid PV1). | "Supported, but [Error line] — decide whether that's acceptable." |
| `routed but data fails conversion` | Status = `conversion_error`. Message type is known; data is missing/invalid. | Read the `Error` line — it names the field. Options: sender fixes the data, add a preprocessor, or relax config (`required: false`). Route to `check-errors` for a full diagnosis. |
| `routed but contains unmapped codes` | Status = `code_mapping_error`. | Unmapped codes went to `/mapping/tasks`. Route to `check-errors` for resolution. |
| `malformed — sender must fix` | Parse failed, or MSH missing. | Show them which segment/framing is off. No code fix on our side. |
| `NOT supported — no converter registered` | Routing threw `Unsupported message type: X_Y`. | This is a real "build a new converter" case. Route to `hl7v2-to-fhir-pipeline`. |

## Rules

- **Run the script rather than reasoning from the filename or MSH-9 alone.** Routing, preprocessing, and config interact — "we have an adt-a01.ts file" is not the same as "this message works."
- **Do not paraphrase the `Error` line** when a conversion fails. Copy it exactly; it names the field.
- **Do not keep the temp file around.** `rm` it after the check.
- **Do not edit code based only on this output.** A `conversion_error` may be a sender issue, a preprocessor gap, or a config tightness — pick one deliberately, with the developer's input.
- **NEVER count pipe positions by hand.** When the script's `Error` line mentions a field (e.g., `PV1-19`) and you want to confirm what the sender put there, or inspect any other field, use `scripts/hl7v2-inspect.sh <file> --segment <SEG> --values` (or `--field <SEG.N>`). Do not read the raw message and count pipes. Do not say things like "the `1` at position N" without running the inspector first. This is the single easiest place to be subtly wrong; eyeballing is banned, full stop. This rule also applies when telling the user what a field contains in a follow-up explanation.
