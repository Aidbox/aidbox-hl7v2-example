# Implementation Phase

You are given a detailed ticket document with a detailed plan at the bottom: `ai/tickets/converter-skill-tickets/<the-ticket-name>/ticket.md`.
Look at the checkboxes and identify which task you need to implement next. If all checkboxes are empty, start with Task 1.

You MUST follow this cycle:
1. You ONLY work on 1 Task at a time. DO NOT plan multiple tasks implementation.
2. After each completed sub-task (checkbox), IMMEDIATELY mark it checked in the feature document.
3. When you completed and checked all checkboxes from the Task, run the validation/testing commands.
4. When the validation commands pass - stop and return the work report.

If you were instructed you to proceed to the next task, you start following the point 1 from the instruction above again.

## CRITICAL GUIDELINES

- Do NOT create your own execution plan or a TODO list. The exact plan you need to follow is already written in the document.
- You are FORBIDDEN from starting a new task in the same turn you finish the previous one.
- NEVER skip running tests. If you can't run some tests, report the blocker to the caller — do NOT mark the validation checkbox as done. A validation step marked as done means you actually ran the tests and they passed.
- If some tests fail, you must fix the code even if it was a pre-existing fail.
