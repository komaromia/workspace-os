# Foundational decisions

## Language & repository shape

**Language: TypeScript, everywhere.** It is the one language that spans the frontend, the
backend/API, and the agent runtime, so the repository stays single-language end to end. The
alternative, Python, has a richer data/ML ecosystem but cannot serve the browser frontend, which
would reintroduce a second language — so TypeScript wins the "one language" constraint cleanly.
The cost accepted: some data-analysis and ML libraries are Python-first; where an agent needs
them, it shells out to a containerized tool rather than importing them into the codebase.

**Repository: a single monorepo, one deployable app.** See
[repo-layout.md](repo-layout.md) for the folder-by-folder breakdown.

## Recommended TypeScript stack

| Concern           | Choice                                                                                                         |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Runtime/API       | Node.js + Fastify (or Hono)                                                                                    |
| Frontend          | React + Vite                                                                                                   |
| Real-time         | WebSocket + Yjs (CRDT) for collaborative artifacts                                                             |
| Database          | Postgres + pgvector, via Drizzle ORM                                                                           |
| Work queue        | Postgres `SELECT … FOR UPDATE SKIP LOCKED` (simple profile)                                                    |
| Event bus         | Postgres `LISTEN/NOTIFY` (simple profile)                                                                      |
| Durable execution | DBOS (TypeScript SDK) — crash-safe agent workflows, checkpointing to Postgres; swappable for Temporal at scale |
| Model access      | Thin `ModelProvider` interface over provider SDKs and/or local model via Ollama                                |
| Tools             | MCP TypeScript SDK                                                                                             |
| Sandbox           | Docker via dockerode, with gVisor/Kata runtime                                                                 |
| Authorization     | TypeScript policy module (role + relationship checks backed by Postgres); adopt OpenFGA at scale               |
| Observability     | OpenTelemetry + self-hosted Langfuse                                                                           |
| Analytics         | DuckDB (Node bindings) simple / ClickHouse at scale                                                            |

## Guiding principles

1. **Peers in participation, not in privilege.** Agents and humans share the same collaboration
   surface — they claim work, author artifacts, attend meetings — but authority over
   consequential actions (merge to production, move money, change access) is never granted to an
   agent. Every such action is a proposal that a human approves.
2. **Governance from the first commit.** Audit, authorization, and approval are not later
   features; they are load-bearing and cannot be retrofitted into a trustworthy system.
3. **Interfaces at the boundaries.** `ModelProvider`, `ObjectStore`, `SandboxRunner`, and `Queue`
   are interfaces. Scaling from one machine to a cluster is swapping implementations, not
   rewriting.
4. **One app, two profiles.** A "simple" profile (single machine, docker-compose) for development
   and low-risk pilots, and a "hardened" profile for production bank deployment. Same code.

## Build phasing

- **Phase 1 (spine):** Epics 1–5 — create a member, publish work, have an agent claim it and
  produce an artifact under authorization, all logged.
- **Phase 2 (real work):** Epics 6–9 — code sandbox, MCP tools, real-time collaboration,
  approvals.
- **Phase 3 (business surface):** Epics 10–12 — meetings, analytics, finance.
- **Phase 4 (production):** Epics 13–14 — hardening and compliance enablement, done incrementally
  throughout but formalized here.

> Note: the phase numbering above (from the original design doc) references epics 1–14; the full
> epic set as scaffolded in `docs/epics/` runs 1–16, with meetings/analytics/finance/approvals
> renumbered as 12–14 and deployment/compliance as 15–16. See
> [epics/00-overview.md](../epics/00-overview.md) for the authoritative list.

## Recommended starting point

The smallest slice that is still on the right architectural path is **Epics 1–5 and 7**, together
with the governance bones of **3 and 4**: a TypeScript monorepo running on one machine (Fastify +
Postgres/pgvector + DBOS + an owned agent loop), where an agent can claim a work item and produce
a versioned artifact under proper authorization, with every action audited. That spine is what
every other epic hangs off, and it validates the peer model, the durable runtime, and the
governance boundary before investing in the sandbox, MCP breadth, meetings, and analytics.
