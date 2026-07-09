# Epic 2 — Identity & membership (humans and agents as peers)

**Phase:** 1 — Spine

## Goal

A unified `Member` model where humans and agents are the same kind of first-class principal.

## Why it matters

The "peer" experience is a data-model decision. If agents are a bolted-on afterthought,
everything downstream becomes a special case.

## Key stories

- Model `Member` with `type: human | agent`, both linked to an identity and carrying roles.
- Human auth via federated SSO (OIDC/SAML) to an external identity provider; MFA supported.
- Agents as governed non-human identities with short-lived, scoped credentials — never
  long-lived static keys.
- Persona definitions for agents: system prompt, allowed tools, model configuration, role —
  versioned.
- Unified activity attribution: any action records the acting member regardless of type.

## Acceptance criteria

- A human signs in via SSO.
- An agent is provisioned with a persona and a scoped identity.
- Both appear as members and can be assigned work through the same mechanism.
