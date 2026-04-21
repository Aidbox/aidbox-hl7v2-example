---
name: hl7v2-to-fhir-pipeline
description: Build a new HL7v2→FHIR message converter or extend an existing one. Orchestrates requirements gathering, then delegates to `/plan` and `/work`.
---

# HL7v2 → FHIR Converter Pipeline

Extend the HL7v2→FHIR conversion module per the user's request. You are the orchestrator; sub-agents and the `/plan` and `/work` skills do the heavy lifting.

If the request isn't about a new message converter, a new field mapping, or adapting existing conversion to new messages — return an error.

## Step 0 — Is it already supported?

Before creating a ticket, if the user supplies one or more example messages, run each through `message-lookup`:

```sh
bun scripts/check-message-support.ts <example-file>
```

- All examples report `supported — message converts cleanly` → tell the user "this is already supported" and stop. Do not open a ticket.
- All examples report `NOT supported — no converter registered` → proceed to Step 1; this is a new-converter case.
- Examples report `routed but data fails conversion` or `supported with caveats` → the converter exists but has gaps. Ask the user whether they want to extend the existing converter (this pipeline) or fix a specific error (`check-errors`).

If the user supplies no example messages, skip Step 0.

## Rules

- You are the only thing that talks to the user. Sub-agents and `/plan`/`/work` delegates do not.
- If a sub-agent needs user input, resume it with the user's answer — don't re-prompt the sub-agent from scratch.
- Between steps, commit the ticket changes and move on. Don't summarize sub-agent output unless the user asks.
- **Never use user-provided example messages unchanged.** De-identify them (change names, dates, numeric IDs) before writing them into fixtures, docs, or the ticket.

## Pipeline

### Step 1 — Ticket setup

- Create `ai/tickets/converter-skill-tickets/<ticket-name>/` (unless the user pointed to an existing folder).
- Create `ticket.md` with a `# Goal` section describing the request.
- Create an `examples/` subdirectory. Ask the user to put real example messages there. If they say they have none, spawn a sub-agent with this prompt to generate them:

    ```
    Generate 5 example <message-type> messages in ai/tickets/converter-skill-tickets/<ticket-name>/examples/:
    - 3 conforming to HL7v2 2.5
    - 2 conforming to HL7v2 2.8.2
    Use the hl7v2-info skill. Each example in its own file.
    ```

- Record the `examples/` path in the ticket. Commit.

### Step 2 — Requirements

Spawn a sub-agent with the prompt in `requirements-prompt.md`. It writes a `# Requirements` section into `ticket.md`. Commit.

### Step 3 — Plan

Call `/plan`. Point it at `ticket.md`. It explores the codebase, discusses the approach with the user, and appends `# Implementation Plan` to the ticket — leaving `# Requirements` intact. Commit.

### Step 4 — Execute

Call `/work`. It executes the plan one task at a time, with an independent review after each task.

When `/work` reports the final task complete and the user approves, the pipeline is done. Tell the user they can test the functionality in the UI.

## Resumption

If the user points to an existing ticket folder, detect current state and jump in:

| State of `ticket.md` | Resume at |
|---|---|
| No `# Requirements` | Step 2 |
| Has `# Requirements`, no `# Implementation Plan` | Step 3 |
| Has `# Implementation Plan` with unchecked tasks | Step 4 |
| All tasks checked | Ask the user what they want next |
