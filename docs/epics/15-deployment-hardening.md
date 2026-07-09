# Epic 15 — Deployment & hardening (single-node → bank profile)

**Phase:** 4 — Production

## Goal

One codebase that runs on a single machine for development and hardens into a bank-deployable
production profile.

## Why it matters

The simple profile keeps iteration fast; the hardened profile is what a bank will actually run.

## Key stories

- Simple profile: docker-compose, filesystem storage, embedded analytics, local or approved
  model.
- Hardened profile: deploy inside the bank's boundary; private image registry mirror; signed
  images; egress allowlist; internal-only MCP.
- Federated SSO/MFA; secrets in the bank's vault; encryption at rest via their KMS/HSM; TLS/mTLS
  in transit.
- Defined RTO/RPO, tested backup/failover, and formal dev/test/UAT/prod separation with change
  control.

## Acceptance criteria

- The same image runs in both profiles by config.
- The hardened profile passes a security review checklist (no external egress, no exposed
  secrets, full audit export).
