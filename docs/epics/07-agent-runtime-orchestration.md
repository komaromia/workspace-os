# Epic 7 — Agent runtime & orchestration

**Phase:** 2 — Real work

## Goal

A durable, crash-safe agent loop that loads a persona, reasons, acts, and checkpoints.

## Why it matters

Agent tasks are long-running, can fail midway, and must pause for human approval — durability is
the guarantee you cannot retrofit.

## Key stories

- Own the agent loop (perceive → reason → act → report); do not build on a heavyweight
  multi-agent framework.
- Model agent tasks as DBOS workflows: deterministic replay, retries, and "wait for approval" as
  a first-class step.
- Load persona, task context, and retrieved memory at the start of each run; checkpoint progress.
- In-process workers in the simple profile; horizontally scalable workers in the hardened
  profile.

## Acceptance criteria

- An agent task survives a process restart and resumes.
- A task can pause pending human approval and continue when granted.
- Every step is traced.
