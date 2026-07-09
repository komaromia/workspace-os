# Epic 5 — Shared work board

**Phase:** 1 — Spine

## Goal

A common space where work is published and picked up by humans or agents, with safe claim
semantics.

## Why it matters

This is the heart of "peers" — the same board, the same claim mechanism, for both member types.

## Key stories

- Work items with state, required role/skills, priority, and assignment.
- Claim semantics via Postgres `FOR UPDATE SKIP LOCKED` so two agents never grab the same item.
- Orchestrator matching: dispatch to an available agent by persona/role, or allow self-claim.
- Progress reporting back to the item; dependency and sub-task support.
- Real-time board updates via `LISTEN/NOTIFY`.

## Acceptance criteria

- A published item can be claimed exactly once.
- An agent claims an item, works it, and reports progress visible live to humans.
