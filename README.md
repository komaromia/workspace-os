# workspace-os

A shared workspace where humans and AI agents collaborate as peers: agents have
personas and roles, pick up work from a common board, write docs and code, run
analysis, connect to external systems via MCP, and sync with humans in meetings.

Single TypeScript monorepo. One codebase, two deployment profiles: **simple**
(single machine, docker-compose, for development and low-risk pilots) and
**hardened** (bank-deployable production profile).

## Start here

- [`docs/README.md`](docs/README.md) — knowledge base index (architecture, epics, decisions)
- [`docs/architecture/foundations.md`](docs/architecture/foundations.md) — language, stack, guiding principles
- [`docs/epics/00-overview.md`](docs/epics/00-overview.md) — build phasing and the recommended starting point

## Repository layout

```
/apps/server        API, real-time layer, agent workers, static frontend host
/apps/web            React + Vite frontend
/packages/core       domain model (members, work items, artifacts, meetings)
/packages/agent      agent loop, personas, model gateway, MCP/tool client, sandbox runner
/packages/governance authorization, approvals, audit, policy
/packages/adapters   interface implementations (ModelProvider, ObjectStore, SandboxRunner, Queue)
/deploy              docker-compose (simple profile) and hardened manifests
/docs                knowledge base: architecture, epics, decisions
```

See [`docs/architecture/repo-layout.md`](docs/architecture/repo-layout.md) for the rationale behind each boundary.

## Status

Scaffolding stage — folder structure and knowledge base are in place; no
application code yet. Next step is Epic 1 (foundation & repository
scaffolding): pnpm/turbo workspaces, Postgres + pgvector via docker-compose,
Drizzle migrations, and the core interface definitions.
