---
name: hl7v2-to-fhir-pipeline
description: Comprehensive pipeline for creating a new message converter or add/edit a field mapping for an existing converter.
---

# HL7v2->fhir Module Extension

Your job is to extend the conversion module according to user's request.

If the user request is not related to creating a new message converter, a new field mapping, or adapting the existing conversion to new message examples - return an error.

## Rules

- You are the orchestrator agent. You perform work by creating sub-agents for each step in the pipeline.
- Only you can interact with the user. If a sub-agent needs user-input, it can stop and return questions. You must resume the sub-agent with provided user feedback if it didn't finish its step.
  - IMPORTANT: if user starts to discuss a question that is related to the work a sub-agent is doing, you act like a proxy and let the sub-agent answer user's questions or concerns. Don't pollute your context by thinking about a specific task the sub-agent is doing. 
- If user points you to specific directory in `ai/tickets/converter-skill-tickets/`, you work there, resuming the last step or starting with the Step 1 if no work has been done.
- Between steps, your only job is to commit and move to the next step. Do NOT present, summarize, or ask the user about content from the ticket document when it's not explicitly required by a sub-agent (when it returns `NEED_USER_INPUT`).
- **CRITICAL**: NEVER USE PROVIDED EXAMPLE MESSAGES UNCHANGED. ALWAYS DE-IDENTIFY THEM BY CHANGING NAMES, DATES AND NUMERIC IDS.

## Pipeline

### Step 1

- Create a folder in `ai/tickets/converter-skill-tickets/` that stands for the name of the change user needs (unless user instructed you to work in a specific directory).
- Create a ticket file that will contain all the collected work by the sub-agents: `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`
- Fill the ticket with the high-level description of the goal ("# Goal" section)
- Create a sub-folder `/examples` in the ticket directory. 
- Ask user to put example messages in the examples directory.
- If user explicitly said they don't have real examples, run a sub-agent to generate the examples.
The sub-agent prompt:
```
Generate 5 examples of <related-hl7v2-message> messages in `ai/tickets/converter-skill-tickets/<the-ticket-name>/examples/`
Use skill hl7v2-info to read the hl7v2 spec and generate examples, conforming to the spec:
- 3 messages conforming to 2.5
- 2 messages configming to 2.8.2
Each examples must have its own file.
```
- Specify the path to example messages in the ticket
- Commit the files.

### Step 2

Run a sub-agent to explore the hl7v2 spec and mappings and make a requirements document.

Prompt:
```
You are the Requirements Agent for a new HL7v2→FHIR message converter.

Goal:
Produce a requirements document that defines what the converter must do, based on HL7v2 spec + official V2-to-FHIR mappings + real example messages.

Inputs:
- Feature document path: `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`
- Example message locations: `ai/tickets/converter-skill-tickets/<the-ticket-name>/examples/`

Hard constraints:
1. Use `hl7v2-info` skill for HL7v2 structure/field/optionality checks. 
2. Use `docs/v2-to-fhir-spec/mappings/` as the authoritative mapping base.
3. Compare mappings to real example messages and document every misalignment.
4. Separate clearly:
    - Normative requirements (spec + official mappings)
    - Observed sender-profile deviations (real message behavior)
5. Every claim must include evidence and its id (REQ-#, MIS-#, EDG-#, etc) 

Research workflow:
1. Inspect message structure with `hl7v2-info`:
   - List all relevant segments
   - List fields/components that are candidates for mapping
   - Check both 2.5 and 2.8.2 versions - all versions must be supported
2. Inspect official mappings in `docs/v2-to-fhir-spec/mappings/`:
   - Outline baseline mapping requirements and logic
3. Inspect example messages:
   - Determine what is consistently present, variably present, and often missing
   - Note sender-specific conventions and malformed patterns
4. Document baseline vs real messages mismatches:
   - Identify mismatches and missing data patterns
   - Include evidence for each mismatch or edge case
5. Write proposal for mapping adjustments:
   - Preprocessor requirements for safely restorable values (identifiers, dates, coding system metadata, etc.)
   - Relaxation policy for missing segments/fields observed in production-like examples
   - Fallback chain for every inferred identifier
   - Must be labeled `Proposal` until confirmed.
6. Write Open Questions that need user decision.

CRITICAL: keep BOTH the spec requirements and the real message handling requirements in the document! They must be available for the future engineer who will work on the feature design.

Rules for proposals:
- Preprocessors:
  - Only infer from context within the same message.
  - Prefer deterministic, explainable transformations.
  - Define rejection conditions when inference is unsafe.
- Relaxed requirements:
  - Allowed only when real messages consistently violate strict expectation.
  - Must include risk and downstream impact.
- Identifier fallback chains:
  - Required for each identifier used by converter logic.
  - Must include ordered sources, guard conditions, and terminal failure behavior.

Required output format (write into `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`):
---
# Requirements

## Scope
- Message types/events in scope
- Out-of-scope items

## Normative Mapping Requirements (Spec/IG-Based)
- Segment/field/component mapping requirements
- MUST/SHOULD/MAY prioritization
- Evidence references

## Real Message Profile
- What real messages actually contain
- Variability/missingness patterns
- Evidence references

## Gaps Between Normative and Real
- Gap description
- Impact on conversion
- Evidence references

## Preprocessor Requirements
- For each required preprocessor:
  - Input condition
  - Transformation logic
  - Allowed data sources in-message
  - Rejection condition
  - Rationale

## Relaxed Requirements (Proposal)
- Segment/field to relax
- Relaxation rule
- Why needed (real message evidence)
- Risks and mitigation

## Fallback Chains
- One table per identifier:
  - Identifier name
  - Primary source
  - Fallback 1..N
  - Preconditions
  - Failure outcome

## Acceptance Criteria for Implementation
- Testable, unambiguous requirements the implementation agent must satisfy

## Open Questions / Unknowns
- Question
- Blocking level
---

Quality gate before finishing:
1. No requirement without evidence.
2. Normative vs proposed requirements are explicitly separated.
3. Every inferred identifier has a documented fallback chain.
4. Every proposed relaxation has risk noted.
5. Confirm document updated at `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`.
```

Commit the changed files once the sub-agent finished.

### Step 3

Run a sub-agent to explore the codebase, existing conversion logic, note what's already done, what's missing, and what patterns/structures can be helpful to re-use for the implementation.

Prompt:
```
You are the Explore Agent for new HL7v2→FHIR message converter work (`ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`).

Goal:
Produce a complete, evidence-backed exploration of what already exists, what is missing, and what should be reused for the implementation. Write findings directly into the ticket document: `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md` in a section "# Codebase Exploration".

Exploration workflow:
1. Map relevant code surface area and architecture for this converter scope.
2. Identify existing converter patterns and reusable modules (parsing, preprocessing, routing, ID generation, mapping, task/error handling, Aidbox I/O, etc).
3. Trace current end-to-end flow and status/error transitions.
4. Compare current implementation against spec/mapping expectations for this scope.
5. Build a gap list: missing behaviors, partial behaviors, test gaps, and doc gaps.
6. Locate reusable implementation patterns and anti-patterns.
7. Append a structured exploration report to the ticket document.

Required ticket output format:
---
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
---
```

Commit the changed files once the sub-agent finished.

### Step 4

Spawn a sub-agent to write the design to satisfy the requirements given the existing codebase. If the sub-agent returns `NEED_USER_INPUT` marker, you must ask the user this question and then **resume** the sub-agent that asked this question to continue its work.

Prompt:
```
You are the Design Agent for HL7v2→FHIR converter work.

Goal:
Write an implementation design that satisfies the ticket requirements using existing code patterns.

Inputs:
- Ticket file: `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`

Hard constraints:
1. Do not implement code. Design only.
2. Treat `# Requirements` and `# Codebase Exploration` as primary inputs.
3. If you need user input, return your output with "NEED_USER_INPUT: [your-questions]" as you don't have access to the Question Tool.
4. If examples are referenced, keep them de-identified.

Workflow:
1. Inspect the ticket document. Explore the project for context that is missing in the ticket.
2. If the design involves trade-offs, ask the user for clarification. Only ask clinical/business questions, decide all technical implementation trade-offs independently. Make sure there're no open questions left. DO NOT finish interaction until all open questions from all sections and future design proposal are resolved.
3. Produce design:
- Reuse existing patterns/modules found in exploration.
- Define converter flow, mapping responsibilities, preprocessors, fallback logic, error/status behavior, and integration points.
- Make Affected Components table of files with change types
- Provide code examples and data schema
- Describe corner cases and how to handle them
- Make a comprehensive list of test cases that will cover the new functionality 
- Write design to ticket under `# Implementation Design`.
- Reference the requirement or edge case ID 

Design output format:
---
# Implementation Design

## Key Decisions

## Key Decisions
## New components
## Affected existing components
## Error/Warning/Mapping_Error Handling
## Edge cases handling
## Test Cases
- Unit tests
- Integration tests
- Fixture strategy and edge cases
---

4. Consolidate and cleanup the document
- Make sure the ticket document doesn't contain any mismatches between the Implementation Design and the previous sections
- Make sure all useful information from the Codebase Exploration is used in the Implementation Design, and remove the Codebase Exploration section
- Make sure any superceded or repeated info in the previous sections is removed to avoid the document bloat
- Make sure all AI Review Notes are addressed and this section is removed (if there was any) 
```

Commit the changed files once the sub-agent finished.

### Step 5 

Run a sub-agent with `ai-review` skill to review the design.

Prompt:
```
/ai-review <path-to-ticket-file>
```

After the review agent finished, **resume** the design agent to address findings and remove the AI Review Notes section. You only do this once. Do not run subsequent reviews after one was completed.

Commit the changes.

###  Step 6

Run a sub-agent to make the plan. The prompt is located in file named `planning-prompt.md` in the skill directory.

Commit the changes.

### Step 7

Iteratively run 1 sub-agent to implement 1 task using prompt from `implementation-prompt.md` file in the skill directory.

After each task is completed, commit the changes and run the next sub-agent until all tasks are done.

When all tasks are completed, move to the next step.

### Step 8

Run a sub-agent to review the implementation.

Prompt:
```
/ai-review implementation of <path-to-ticket-file>. Think hard. Return your review output as your response, do not change any files. 
```

If the review agent returned any issues, spawn a sub-agent to fix them.

Prompt:
```
Get familiar with <path-to-ticket-file>. A review of this implementation revealed issues you need to address:

<review-agent-output>
```

When the review and the fixes are done, your job is done. Report to the user the implementation is complete, they can test the functionality in the ui.
