# Epic 10 — Code sandbox

**Phase:** 3 — Business surface

## Goal

Agents write, run, and test code in kernel-isolated environments and produce reviewable pull
requests.

## Why it matters

Agents run untrusted, model-generated code — the single most important security control. Agents
propose; humans and existing CI/CD deploy.

## Key stories

- `SandboxRunner` interface; implementation spawns a per-task container with dropped
  capabilities, no host mounts, and default-deny network.
- Use a gVisor/Kata runtime for kernel-level isolation; no ambient credentials in the sandbox.
- Agents produce branches and pull requests; deployment is never performed by the agent.
- Test execution and result capture as artifacts.

## Acceptance criteria

- Agent-generated code runs isolated with no network unless explicitly granted.
- Output is a PR routed to human review.
- No path exists for an agent to deploy directly.
