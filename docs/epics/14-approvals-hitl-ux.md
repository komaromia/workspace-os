# Epic 14 — Approvals & human-in-the-loop UX

**Phase:** 4 — Production

## Goal

A clear, unbypassable interface for humans to review and approve proposed agent actions.

## Why it matters

The maker-checker gate is only as good as the human's ability to understand and act on what is
proposed.

## Key stories

- An approvals inbox showing the proposed action, its context, inputs, and predicted effect.
- Approve/reject/modify flow that resumes or cancels the paused agent workflow.
- Dual-control enforcement for the highest-consequence actions (two distinct approvers).
- Every decision recorded in the audit trail with the deciding member.

## Acceptance criteria

- A proposed consequential action waits in an inbox.
- Approving it resumes the workflow.
- The decision and its rationale are auditable.
- High-consequence actions require two approvers.
