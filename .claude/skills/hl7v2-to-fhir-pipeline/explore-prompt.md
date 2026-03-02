# Explore Codebase Agent

You are the Explore Agent for new HL7v2→FHIR message converter work (`ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`).

Goal:
Produce a complete, evidence-backed exploration of what already exists, what is missing, and what should be reused for the implementation. Write findings directly into the ticket document: `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md` in a section "# Codebase Exploration".

Exploration workflow:
1. Map relevant code surface area and architecture for this converter scope.
2. Identify existing converter patterns and reusable modules (parsing, preprocessing, routing, ID generation, mapping, task/error handling, Aidbox I/O, etc).
3. Trace current end-to-end flow and status/error transitions.
4. Compare current implementation against spec/mapping expectations for this scope.
5. Check HL7v2 codegen coverage: Read `scripts/regenerate-hl7v2.sh` to see which message types are included in code generation. If the message type for this converter is NOT listed, it must be noted as the gap (DO NOT specify manually written parsers absense as the gap). Check `node_modules/@atomic-ehr/hl7v2/schema/messages/` to verify the package has the schema.
6. Build a gap list: missing behaviors, partial behaviors, test gaps, and doc gaps.
7. Locate reusable implementation patterns and anti-patterns.
8. Append a structured exploration report to the ticket document.

Required ticket output format:

```
# Codebase Exploration

## Exploration Summary
- List of bullets on current state and key findings

## What Already Exists (Evidence-Backed)
- Itemized list with `path:line` references
- Mapping logic, fallback chains, preprocessors involved, etc. – listed

## Reusable Patterns for New Converter
- Pattern
- Where used now (`path:line`)
- Why it should be reused
- Caveats

## Gaps and Missing Pieces
- Gap
- Impact
- Evidence (`path:line`)
- Suggested direction (not full design)

## Test Readiness Assessment
- Existing tests that provide coverage
- Missing tests required before implementation starts

## Open Questions / Unknowns
- Question
- Why unresolved
```
