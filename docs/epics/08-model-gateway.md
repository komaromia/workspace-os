# Epic 8 — Model gateway

**Phase:** 2 — Real work

## Goal

A single abstraction over all LLM access with routing, cost metering, and a strict no-egress
mode.

## Why it matters

Swapping local vs cloud models must be a config change, and a bank deployment requires a genuine
"no external providers" guarantee.

## Key stories

- `ModelProvider` interface with implementations for a local model (Ollama) and/or an approved
  endpoint.
- Task-based routing (cheap model for triage, strong model for coding), caching, and provider
  fallback.
- Per-member token metering feeding the cost/quota system.
- Hardened "no external egress" mode that refuses any off-box/off-tenant model call.

## Acceptance criteria

- Switching between local and remote models requires no code change.
- No-egress mode provably blocks external calls.
- All calls are metered.
