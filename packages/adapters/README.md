# @workspace-os/adapters

Concrete implementations of the boundary interfaces defined in `@workspace-os/core`
(`ModelProvider`, `ObjectStore`, `SandboxRunner`, `Queue`, `SecretsBroker`), selected at startup
by the `simple` / `hardened` profile setting. See
[ADR 0002](../../docs/decisions/0002-one-app-two-profiles.md) for why this boundary exists.

## Implemented so far

- `FilesystemObjectStore` — `ObjectStore` over the local filesystem.
- `EnvSecretsBroker` — `SecretsBroker` over `process.env`, with optional key prefix.
- `PostgresQueue` — `Queue` using `SELECT ... FOR UPDATE SKIP LOCKED` so concurrent claimers never
  see the same message (Epic 5's claim semantics).
- `src/db` — Drizzle ORM wiring against Postgres + pgvector (see
  [`deploy/simple/README.md`](../../deploy/simple/README.md) for bringing up the database
  locally). `db:generate` regenerates SQL migrations from `src/db/schema.ts`; `db:migrate` applies
  them.
- `src/profile` — the config/profile seam. `resolveProfile(env)` reads `PROFILE` (`simple` |
  `hardened`, defaulting to `simple`) and denies unknown values. `createAdapters(pool, env)`
  resolves the profile and wires up every adapter it selects; `createObjectStore` /
  `createSecretsBroker` / `createQueue` are the individual factories it composes, and each accepts
  an `override` so a caller can inject an adapter that doesn't exist yet (see below).

Still pending: `ModelProvider`, `SandboxRunner`. `createObjectStore("hardened", ...)` currently
throws `UnsupportedProfileAdapterError` rather than silently reusing the filesystem adapter — a
real hardened deployment needs an S3-compatible `ObjectStore` (Epic 15), which hasn't been built
yet. `createSecretsBroker` and `createQueue` work the same way for both profiles today: secrets
are expected to land in the environment either way (directly in `simple`, injected by the bank's
vault tooling in `hardened`), and Postgres backs the queue in both profiles regardless of where
it's deployed.

## Testing

- `pnpm test` — unit tests, no external dependencies.
- `pnpm test:integration` — exercises real Postgres (via `deploy/simple/docker-compose.yml`);
  requires the database to be up and migrated first.
