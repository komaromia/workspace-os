# ADR 0002: One app, two deployment profiles (simple / hardened)

## Status

Accepted — 2026-07-09

## Context

The workspace needs to be easy to run for a single developer on a laptop, and eventually deployed
inside a bank's security boundary. Those two environments have very different requirements:
local Postgres vs. bank-managed database, filesystem object storage vs. S3-compatible storage
behind the bank's KMS, unrestricted outbound calls to a model API vs. a hard no-external-egress
guarantee, and so on.

The naive path — a separate codebase or a heavily-forked one for the "enterprise" deployment — is
a known failure mode: the two versions drift, security fixes land in one and not the other, and
the hardened version is perpetually behind.

## Decision

One application, one image. Every environment-sensitive concern is expressed as an interface
(`ModelProvider`, `ObjectStore`, `SandboxRunner`, `Queue`, `SecretsBroker` — see
[Epic 1](../epics/01-foundation.md)), with concrete implementations selected at startup by a
`profile` setting: `simple` or `hardened`. Implementations live in `packages/adapters`.
Deployment descriptions (not code) live side by side in `deploy/simple` and `deploy/hardened`
([repo-layout.md](../architecture/repo-layout.md)).

## Rationale

- Governance (authorization, audit, approvals — Epics 3, 4, 14) has to be identical in both
  profiles, or the hardened deployment isn't actually validated by anything that ran in
  development. A single codebase makes that a structural guarantee rather than a policy.
- The security-relevant differences between "my laptop" and "inside a bank" are almost entirely
  about _what's on the other side of an interface_ (which object store, which model endpoint,
  whether egress is allowed at all) — which is exactly what the adapter pattern is for.
- Forking or maintaining a parallel enterprise branch was the realistic alternative, and it fails
  the moment a security fix or feature lands in only one branch.

## Consequences

- New infrastructure-facing functionality must be added as an interface + adapter pair, not as a
  direct dependency, even when only the simple profile needs it today. This is the discipline
  cost of the decision.
- The hardened profile's differentiators (private registry mirror, signed images, egress
  allowlist, internal-only MCP, bank-managed secrets/KMS — [Epic 15](../epics/15-deployment-hardening.md))
  are deployment/config concerns, not code branches.
- A "no external egress" guarantee (Epic 8) must be provable from configuration, not just true by
  convention — this is a harder bar than a simple feature flag and should be treated as a
  first-class acceptance criterion, not an implementation detail.

## Alternatives considered

- **Separate enterprise fork/branch:** rejected — guaranteed drift, doubles the security review
  surface, and the whole point of building governance in from Epic 1 is defeated if the hardened
  deployment doesn't run the same governance code that was validated in development.
- **Feature flags without an adapter boundary:** rejected — flags scattered through business logic
  degrade over time into untestable combinatorial state; a clean interface boundary keeps the
  "which profile am I in" decision in one place (the config/profile system) instead of leaking
  into every call site.
