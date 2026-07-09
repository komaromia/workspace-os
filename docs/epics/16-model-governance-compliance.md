# Epic 16 — Model governance & compliance enablement

**Phase:** 4 — Production

## Goal

Treat the agents as governed models: inventory, evaluation, monitoring, and the evidence a bank's
model-risk and compliance functions need.

## Why it matters

In a bank, autonomous agents fall under model-risk management and related regimes; the
deployment stalls without this evidence. (Which specific regulations bind is a determination for
the bank's compliance and model-risk functions, not this document — this epic provides the
technical hooks they will require.)

## Key stories

- A model/persona inventory with versions, owners, and intended use.
- Prompt/response logging suitable for validation and review.
- An evaluation harness and red-teaming process run before persona changes ship.
- Monitoring for drift, anomalous actions, and cost/behavior thresholds.

## Acceptance criteria

- Every persona is inventoried and versioned.
- Prompts/responses are logged for review.
- Persona changes require passing evals.
- Monitoring alerts on anomalous agent behavior.
