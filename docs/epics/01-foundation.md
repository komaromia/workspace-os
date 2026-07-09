# Epic 1 — Foundation & repository scaffolding

**Phase:** 1 — Spine

## Goal

A single TypeScript monorepo that builds, tests, and runs locally with `docker compose up`.

## Why it matters

Every later epic depends on a consistent build, a running database, and the interface boundaries
that keep the codebase portable.

## Key stories

- Set up the monorepo (pnpm/turbo workspaces), TypeScript config, linting, formatting, and a test
  runner.
- Define the core interfaces: `ModelProvider`, `ObjectStore`, `SandboxRunner`, `Queue`,
  `SecretsBroker`.
- Provision Postgres + pgvector via docker-compose; wire Drizzle migrations.
- Establish a config/profile system ("simple" vs "hardened") that selects adapter
  implementations.
- CI: build, typecheck, test, and produce a signed container image.

## Acceptance criteria

- A fresh clone runs end to end locally with one command.
- Switching profiles changes backing services without code edits.
- CI is green and emits an SBOM.
