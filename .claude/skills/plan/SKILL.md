---
name: plan
description: Create a checkbox task plan for a feature or fix. Output is a markdown file that `/work` executes one task at a time.
---

# Plan

Write an implementation plan as a markdown file of checkbox tasks. The plan is executed by `/work`, one task at a time with user checkpoints.

## Output

Location: `ai/tickets/YYYY-MM-DD-short-name.md`

If the ticket already has upstream sections (e.g. `# Requirements` from a prior phase), leave them in place and append the plan as its own section. Reference upstream content by heading — don't duplicate it.

## Process

1. If the request is ambiguous, ask only the questions that genuinely block exploration. Many questions are better deferred to step 3.
2. Explore the codebase — spawn an Explore agent for unfamiliar areas. Read `CLAUDE.md`, find related patterns, understand constraints.
3. Present findings and propose the implementation shape. Confirm with the user before writing tasks.
4. Write the plan using the structure below.

## Structure

```markdown
# Plan: [Name]

## Overview
[2–4 sentences: what and why]

## Validation
- `bun test:local`
- `bun run typecheck`

## Task 1: [Name]
- [ ] Specific action with file/function reference
- [ ] ...
- [ ] Write/update tests
- [ ] Run validation — must pass
- [ ] Stop for user review before next task

## Task 2: ...

## Task N: Cleanup
- [ ] Update docs (CLAUDE.md, inline comments) if patterns changed
- [ ] Final `bun test:all`
```

## Task rules

- **One concern per task.** If a task has 3 unrelated bullets, split it. Target 3–7 checkboxes.
- **Every task ends with a validation gate + user checkpoint.**
- **Order by dependency** — types before consumers, shared code before users, tests alongside implementation, cleanup last.
- **Reference concrete files** (`src/foo/bar.ts:42`), not "the bar module."

## Planning rules

- **Ask the user only about business/product decisions** — what the feature should do, what behavior is acceptable. Decide technical tradeoffs (file layout, helper extraction, naming) yourself.
- **No open questions at finalization.** If the user defers an answer, mark it `OPEN:` inline in the plan rather than leaving implicit ambiguity.
- **Plan ≠ code.** Don't implement anything while writing the plan.
