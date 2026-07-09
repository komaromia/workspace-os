# Repository layout

A single monorepo, one deployable app.

```
/apps/server        — the API, real-time layer, agent workers, and static frontend host
                       (one Node process in the simple profile)
/apps/web            — React + Vite frontend, built to static assets served by the server
/packages/core       — domain model (members, work items, artifacts, meetings) shared
                       across server and agents
/packages/agent      — the agent loop, personas, model gateway, MCP/tool client, sandbox runner
/packages/governance — authorization, approvals, audit, policy
/packages/adapters   — interface implementations (ModelProvider, ObjectStore, SandboxRunner,
                       Queue) selected by config
/deploy              — docker-compose (simple profile) and hardened Helm/manifests
                       (production profile)
```

## Why these boundaries

- **`apps/server` is the only long-running process in the simple profile.** It hosts the API,
  the WebSocket real-time layer, in-process agent workers, and serves the built frontend as
  static assets. This keeps `docker compose up` to a small number of containers (server +
  Postgres) while still letting the hardened profile split workers out horizontally without a
  rewrite.
- **`packages/core` has no framework or infrastructure dependencies.** It is pure domain model —
  `Member`, `WorkItem`, `Artifact`, `Meeting` — so both `apps/server` and `packages/agent` can
  depend on it without pulling in Fastify, DBOS, or any adapter.
- **`packages/agent` owns the agent loop, not a heavyweight multi-agent framework.** Personas,
  the model gateway, the MCP/tool client, and the sandbox runner all live here because they
  change together and are meaningfully agent-specific.
- **`packages/governance` is separated from `packages/core` on purpose.** Authorization,
  approvals, audit, and policy are the boundary a bank's review board will scrutinize first
  (Epics 3–4). Keeping it as its own package makes it easy to point at in a security review and
  to eventually extract into a dedicated service.
- **`packages/adapters` is where "simple" vs "hardened" lives as code, not as forked logic.**
  `ModelProvider`, `ObjectStore`, `SandboxRunner`, and `Queue` are interfaces defined near their
  consumers (`packages/core` or `packages/agent`); their concrete implementations — filesystem vs
  S3-compatible object store, local Ollama vs approved endpoint model, single-node Postgres queue
  vs distributed queue — live in `packages/adapters` and are selected by the profile/config
  system from Epic 1.
- **`deploy/` holds both profiles side by side.** `deploy/simple` is docker-compose for local dev
  and low-risk pilots; `deploy/hardened` is the bank-deployable manifests (private registry
  mirror, signed images, egress allowlist, internal-only MCP). Same application image, different
  deployment description.

## Workspace tooling (planned, Epic 1)

pnpm workspaces + Turborepo are the intended build/task orchestration layer across
`apps/*` and `packages/*`. Not yet wired up — see
[epics/01-foundation.md](../epics/01-foundation.md).
