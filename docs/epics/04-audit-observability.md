# Epic 4 — Audit & observability

**Phase:** 1 — Spine

## Goal

Every action attributable, immutable, and exportable; every agent run traceable with cost.

## Why it matters

Trustworthy autonomy is impossible without a complete, tamper-evident record. This cannot be
added later.

## Key stories

- Append-only audit log capturing actor, action, resource, inputs/outputs, timestamp, and
  approval trail.
- Tamper-evidence (hash-chaining) and export to an external SIEM in the hardened profile.
- OpenTelemetry tracing across API, agent loop, and tool calls; self-hosted Langfuse for
  LLM-specific traces.
- Per-member and per-team token/cost accounting surfaced in the UI and enforced against quotas.

## Acceptance criteria

- Any action can be reconstructed from the audit log.
- Agent runs show a full trace with token cost.
- Logs export to the configured SIEM.
