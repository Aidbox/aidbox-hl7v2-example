---
name: hl7v2-to-fhir-pipeline
description: Build a new HL7v2→FHIR message converter or extend an existing one. Orchestrates requirements gathering, then delegates to `/plan` and `/work`.
---

# HL7v2 → FHIR Converter Pipeline

Build or extend an HL7v2→FHIR converter. Four phases: **Setup → Requirements → Plan → Execute**.

**One invocation = one phase.** Detect which phase is next from ticket state, run it, commit, stop. Do NOT re-invoke this skill — the user does that.

If the request is not about a converter (new message, new field mapping, extending conversion), stop and say so.

---

## Step A — Detect which phase to run

The arg from the user names a message type or ticket slug (e.g. `ADT_A03`, `adt-a03-discharge`).

**A.1 — Find or choose the ticket folder.**

Search for an existing folder:

```sh
ls ai/tickets/converter-skill-tickets/ 2>/dev/null | grep -i <keyword>
```

`<keyword>` = a lowercase fragment of the arg (e.g. `a03` for `ADT_A03`).

- Match found → `TICKET_DIR=ai/tickets/converter-skill-tickets/<match>`. Go to A.2.
- No match → this is new work. `SLUG` = kebab-case descriptive name (e.g. `adt-a03-discharge`). `TICKET_DIR=ai/tickets/converter-skill-tickets/<SLUG>`. Run **Phase 1**.

**A.2 — Inspect ticket.md to pick the phase.**

```sh
grep -c "^# Requirements" $TICKET_DIR/ticket.md
grep -c "^# Implementation Plan" $TICKET_DIR/ticket.md
grep -c "^- \[ \]" $TICKET_DIR/ticket.md
```

| `# Requirements` | `# Implementation Plan` | Unchecked `- [ ]` | Run |
|---|---|---|---|
| 0 | 0 | — | Phase 2 |
| ≥1 | 0 | — | Phase 3 |
| ≥1 | ≥1 | ≥1 | Phase 4 |
| ≥1 | ≥1 | 0 | Ask user what they want next. Stop. |

---

## Rules (apply to every phase)

- You talk to the user. Sub-agents, `/plan`, `/work` run silently — their output returns to you.
- Commit after each phase (ticket edits + new files).
- **De-identify example messages before saving them.** Change names, dates, and numeric IDs in any user-supplied message before writing it to `examples/` or a fixture. Never paste raw PHI.

---

## Phase 1 — Setup (new ticket)

1. Create the ticket folder: `mkdir -p $TICKET_DIR/examples`.
2. If the user supplied example messages, first pre-flight them:
   ```sh
   bun scripts/check-message-support.ts <file>
   ```
   If **all** report `supported — message converts cleanly`, delete the folder you just made and stop — no ticket needed. Tell the user it already works.
3. Write `$TICKET_DIR/ticket.md` with a `# Goal` section (2-4 sentences: what + why).
4. Populate `$TICKET_DIR/examples/`:
   - User supplied messages → de-identify, one message per file.
   - User has no examples → spawn an agent:
     ```
     Agent({
       description: "Generate HL7v2 examples",
       subagent_type: "general-purpose",
       prompt: "Generate 5 example <message-type> messages in $TICKET_DIR/examples/. 3 conforming to HL7v2 2.5, 2 conforming to HL7v2 2.8.2. Use the hl7v2-info skill. One message per file."
     })
     ```
5. Commit (`git add $TICKET_DIR && git commit`).
6. Tell the user: "Ticket created at `$TICKET_DIR`. Invoke the skill again to run Phase 2 (requirements)." Stop.

---

## Phase 2 — Requirements

Spawn the requirements agent. The prompt lives at `.claude/skills/hl7v2-to-fhir-pipeline/requirements-prompt.md` — read it, substitute `<the-ticket-name>` with the ticket slug, pass as prompt:

```
Agent({
  description: "Write requirements for <slug>",
  subagent_type: "general-purpose",
  prompt: <contents of requirements-prompt.md with slug substituted>
})
```

When the agent returns, commit the ticket changes. Tell the user: "Requirements added to `$TICKET_DIR/ticket.md`. Invoke the skill again to run Phase 3 (plan)." Stop.

---

## Phase 3 — Plan

Invoke `/plan` via the Skill tool:

```
Skill({ skill: "plan", args: "$TICKET_DIR/ticket.md" })
```

`/plan` talks with the user and appends `# Implementation Plan` to `ticket.md`. When it returns, commit. Tell the user: "Plan ready. Invoke the skill again to run Phase 4 (execute)." Stop.

---

## Phase 4 — Execute

Invoke `/work`:

```
Skill({ skill: "work", args: "$TICKET_DIR/ticket.md" })
```

`/work` runs tasks one at a time with review between each. When all tasks are checked off and the user has approved, tell them: "Converter ready. Test via the UI at http://localhost:3000." Stop.
