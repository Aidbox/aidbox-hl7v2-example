---
name: work
description: Execute a plan produced by `/plan` — one task at a time, with tests and an independent review after each task.
---

# Work

Execute a plan file at `ai/tickets/YYYY-MM-DD-*.md` produced by `/plan`. The file starts with `# Plan: [Name]` and contains `## Task N: [Name]` sections with checkboxes.

## Cycle

1. Open the plan file. Pick the first task with unchecked checkboxes (start at Task 1 if nothing is checked).
2. Work through the task's checkboxes one at a time. Mark each as checked in the plan file immediately after completion.
3. Run the commands listed under `## Validation` in the plan. If any fail, fix the root cause — don't skip.
4. Spawn an independent review agent (prompt below). Address findings, then re-run the same validation commands.
5. Print the full review text to the user (include addressed and ignored issues) and stop. Wait for the user to say "next task" before starting the next one.

If the task is the last one and the user approves, move the plan file to `ai/tickets/completed/`.

## Review agent prompt

```
Use skill ai-review to review implementation of Task [N] from [plan-file-path]. Think hard. The changes are uncommitted. Return your review output; do not change any files.
```

Replace `[N]` and `[plan-file-path]`. If the user specified codex for reviews, spawn it with:

```
codex exec --model gpt-5.3-codex --sandbox workspace-write --full-auto <prompt>
```

## Rules

- **One task per turn.** Never start task N+1 in the same turn you finish N.
- **Don't plan ahead.** The plan file is the plan. Don't maintain your own TODO list.
- **Never skip tests.** "Validation passed" means you ran them and they passed. If you can't run them, report the blocker — don't mark the checkbox.
- **Fix failing tests**, even pre-existing ones. If a test's expected behavior is wrong, ask the user before changing it.
- **Always spawn a review agent.** Don't review your own code.
