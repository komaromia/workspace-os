# @workspace-os/adapters

Concrete implementations of the boundary interfaces defined in `@workspace-os/core`
(`ModelProvider`, `ObjectStore`, `SandboxRunner`, `Queue`, `SecretsBroker`), selected at startup
by the `simple` / `hardened` profile setting. See
[ADR 0002](../../docs/decisions/0002-one-app-two-profiles.md) for why this boundary exists.

## Implemented so far

- `FilesystemObjectStore` — `ObjectStore` over the local filesystem.
- `EnvSecretsBroker` — `SecretsBroker` over `process.env`, with optional key prefix.
- `src/db` — Drizzle ORM wiring against Postgres + pgvector (see
  [`deploy/simple/README.md`](../../deploy/simple/README.md) for bringing up the database
  locally). `db:generate` regenerates SQL migrations from `src/db/schema.ts`; `db:migrate` applies
  them.

Still pending: `ModelProvider`, `SandboxRunner`, and the Postgres-backed `Queue` (Epic 5).

## Testing

- `pnpm test` — unit tests, no external dependencies.
- `pnpm test:integration` — exercises real Postgres (via `deploy/simple/docker-compose.yml`);
  requires the database to be up and migrated first.
