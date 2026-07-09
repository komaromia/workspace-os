# Epic 6 — Artifacts & documentation

**Phase:** 2 — Real work

## Goal

Versioned artifacts (docs, code references, analysis, test results) produced by any member.

## Why it matters

Agents "create documentation" and produce outputs; these need first-class, versioned,
attributable storage.

## Key stories

- Artifact model with type, version history, author (member), and links to the originating work
  item.
- Collaborative document editing (Yjs) so humans and agents can co-edit docs.
- Object storage via the `ObjectStore` interface (filesystem simple / S3-compatible hardened).
- Full-text and vector search over artifacts (pgvector) for agent retrieval/memory.

## Acceptance criteria

- An agent produces a versioned doc linked to its task.
- A human edits it collaboratively.
- Artifacts are retrievable by search.
