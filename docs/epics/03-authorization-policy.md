# Epic 3 — Authorization & policy core

**Phase:** 1 — Spine

## Goal

Fine-grained "can this member take this action on this resource" decisions, with dual-control
gates on consequential actions.

## Why it matters

This is the boundary that keeps agents as peers in participation but not in privilege — and it is
the control a bank's review board will scrutinize first.

## Key stories

- Role- and relationship-based permission checks enforced centrally on every action.
- Classify actions by consequence; mark irreversible/high-impact actions as requiring dual
  control (maker-checker).
- Policy that an agent can propose but never execute consequential actions.
- Deny-by-default: unknown actions are refused, not permitted.
- Design as a TypeScript module now; leave a seam to adopt a dedicated authorization service
  (e.g. OpenFGA) at scale.

## Acceptance criteria

- An agent attempting a consequential action is routed to approval rather than executing.
- Unauthorized actions are denied and logged.
- Policy changes are versioned and auditable.
