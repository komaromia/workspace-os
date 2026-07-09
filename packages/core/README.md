# @workspace-os/core

Domain model shared by the server and the agent runtime: `Member`, `WorkItem`, `Artifact`,
`Meeting`. Framework-free — no Fastify, DBOS, or adapter dependencies (see
[`docs/architecture/repo-layout.md`](../../docs/architecture/repo-layout.md)).

Also defines the boundary interfaces (`ModelProvider`, `ObjectStore`, `SandboxRunner`, `Queue`,
`SecretsBroker`) implemented in `@workspace-os/adapters`.

Not yet implemented — see [`docs/epics/01-foundation.md`](../../docs/epics/01-foundation.md) and
[`docs/epics/02-identity-membership.md`](../../docs/epics/02-identity-membership.md).
