# Epic 9 — Tool & MCP gateway with credential brokering

**Phase:** 2 — Real work

## Goal

Agents use external tools (marketing, analytics, finance, git) via MCP without ever seeing raw
credentials.

## Why it matters

This is where agent value and the largest credential-risk surface both live.

## Key stories

- MCP client integration; a registry of available tools per persona/role.
- Credential brokering: secrets held in a vault, injected per-call, never exposed to the model or
  logged.
- Per-call authorization against the policy engine; full audit of every external call.
- Hardened profile: MCP connections reach internal systems only, per the egress allowlist.

## Acceptance criteria

- An agent invokes an external tool successfully with no credential visible in prompts or logs.
- Disallowed tools are refused.
- Every call is audited.
