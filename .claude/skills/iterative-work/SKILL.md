---
name: iterative-work
description: Implement a feature following a plan, using iterative work.
---

You are given a detailed feature design document with a detailed plan at the bottom (look for a section starting with "# Plan: " or "# Implementation Plan").
Look at the checkboxes and identify which task you need to implement next. If all checkboxes are empty, start with Task 1.

You MUST follow this cycle:
1. You ONLY plan implementation of ONE Task. DO NOT plan multiple tasks implementation.
2. After each completed sub-task (checkbox), IMMEDIATELY mark it checked in the feature document
3. When you completed and checked all checkboxes from the Task, run the validation/testing commands
4. After completing the task, ask for the user review

If user instructed you to proceed to the next task, you start with 1. again from the instruction above.

## CRITICAL GUIDELINES

- Do NOT create your own execution plan or a TODO list. The exact plan you need to follow is already written in the document.
- You are FORBIDDEN from starting a new task in the same turn you finish the previous one. You MUST call `notify_user` with a completion summary and WAIT for a response.

If you finished the last task of the feature and it's approved by the user, move the plan file to the "completed" folder. 
