# ADR 0001: TypeScript everywhere, single monorepo

## Status

Accepted — 2026-07-09

## Context

The workspace needs a browser frontend, a backend/API, and an agent runtime that reasons, calls
tools, and runs long-lived workflows. We want to minimize the number of languages and repos a
contributor (human or agent) has to hold in their head, and we want scaling from a single laptop
to a bank production deployment to be a matter of swapping adapters, not rewriting subsystems.

Two realistic options:

1. **TypeScript everywhere**, one monorepo.
2. **Python for the backend/agent runtime, TypeScript for the frontend** — two languages, two
   toolchains, a network boundary between them even in the simple profile.

## Decision

TypeScript, everywhere, in a single monorepo (`apps/*`, `packages/*`).

## Rationale

- TypeScript is the only language of the two that can serve the browser frontend. Choosing Python
  for the backend would not eliminate a second language — it would just move the split to
  frontend/backend instead of avoiding it.
- A single language lets `packages/core` (the domain model: members, work items, artifacts,
  meetings) be imported directly by both the server and the agent runtime, instead of being
  duplicated or served over an internal API.
- One toolchain (pnpm/turbo, one linter, one test runner, one CI pipeline) is simpler to keep
  correct and secure — relevant given the hardened/bank-deployment target in
  [Epic 15](../epics/15-deployment-hardening.md).

## Consequences

- **Accepted cost:** Python's data-analysis and ML ecosystem (pandas, scikit-learn, etc.) is not
  available in-process. Where an agent genuinely needs it, it shells out to a containerized tool
  via the `SandboxRunner` interface rather than importing the library into the codebase. This is
  the same isolation boundary Epic 10 (code sandbox) already requires for untrusted
  model-generated code, so it isn't a new category of complexity. DuckDB/ClickHouse cover the
  analytics store (Epic 13) so most "run a query" and "produce a report" work doesn't need
  Python at all.
- Node/TypeScript's durable-execution and CRDT ecosystem (DBOS, Yjs) is mature enough to build
  the agent runtime and collaborative artifacts on directly — this was a precondition for the
  decision, not an afterthought.

## Alternatives considered

- **Python backend + TypeScript frontend:** rejected — reintroduces the two-language problem this
  decision exists to avoid, and adds a serialization boundary between the domain model and the
  agent runtime.
- **Polyglot microservices per concern:** rejected for this stage — the "one app, two profiles"
  principle ([foundations.md](../architecture/foundations.md)) depends on a single deployable
  artifact; microservices would fight that from day one.
