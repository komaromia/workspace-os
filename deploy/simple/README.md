# Simple profile

Single machine, docker-compose: server + Postgres/pgvector, filesystem object storage, embedded
analytics (DuckDB), local or approved model. For development and low-risk pilots.

## Postgres + pgvector

```sh
docker compose -f deploy/simple/docker-compose.yml up -d
```

Starts `pgvector/pgvector:pg16` on `localhost:55432` (chosen to avoid clashing with a locally
installed Postgres on the default 5432), credentials `workspace_os` / `workspace_os`, database
`workspace_os`, with a health check and a named volume for persistence.

Apply migrations (from `packages/adapters`):

```sh
pnpm --filter @workspace-os/adapters db:migrate
```

Override the target database with `DATABASE_URL` (defaults to
`postgres://workspace_os:workspace_os@localhost:55432/workspace_os`, matching the compose file
above).

The rest of the simple profile (server process, filesystem object storage, embedded analytics,
local/approved model) is not yet wired up — see
[`docs/epics/01-foundation.md`](../../docs/epics/01-foundation.md).
