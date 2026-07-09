# Epics overview

Implementation is broken into 16 epics, grouped into four build phases. Each epic has its own
file in this directory with a goal, rationale, key stories, and acceptance criteria.

## Phasing

| Phase                | Epics                                                                                                                                                | Theme                                                                                                         |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1 — Spine            | [1](01-foundation.md), [2](02-identity-membership.md), [3](03-authorization-policy.md), [4](04-audit-observability.md), [5](05-shared-work-board.md) | Create a member, publish work, have an agent claim it and produce an artifact under authorization, all logged |
| 2 — Real work        | [6](06-artifacts-documentation.md), [7](07-agent-runtime-orchestration.md), [8](08-model-gateway.md), [9](09-tool-mcp-gateway.md)                    | Code sandbox, MCP tools, real-time collaboration, approvals groundwork                                        |
| 3 — Business surface | [10](10-code-sandbox.md), [11](11-realtime-collaboration.md), [12](12-meetings-sync.md), [13](13-analytics-finance.md)                               | Meetings, analytics, finance                                                                                  |
| 4 — Production       | [14](14-approvals-hitl-ux.md), [15](15-deployment-hardening.md), [16](16-model-governance-compliance.md)                                             | Hardening and compliance enablement, formalized but developed incrementally throughout                        |

## Recommended starting point

The smallest slice that is still on the right architectural path is **Epics 1–5 and 7**, together
with the governance bones of **3 and 4**. See
[../architecture/foundations.md](../architecture/foundations.md#recommended-starting-point) for
the full rationale. That spine validates the peer model, the durable runtime, and the governance
boundary before investing in the sandbox, MCP breadth, meetings, and analytics.

## All epics

1. [Foundation & repository scaffolding](01-foundation.md)
2. [Identity & membership (humans and agents as peers)](02-identity-membership.md)
3. [Authorization & policy core](03-authorization-policy.md)
4. [Audit & observability](04-audit-observability.md)
5. [Shared work board](05-shared-work-board.md)
6. [Artifacts & documentation](06-artifacts-documentation.md)
7. [Agent runtime & orchestration](07-agent-runtime-orchestration.md)
8. [Model gateway](08-model-gateway.md)
9. [Tool & MCP gateway with credential brokering](09-tool-mcp-gateway.md)
10. [Code sandbox](10-code-sandbox.md)
11. [Real-time collaboration & presence](11-realtime-collaboration.md)
12. [Meetings & sync](12-meetings-sync.md)
13. [Analytics & finance integrations](13-analytics-finance.md)
14. [Approvals & human-in-the-loop UX](14-approvals-hitl-ux.md)
15. [Deployment & hardening (single-node → bank profile)](15-deployment-hardening.md)
16. [Model governance & compliance enablement](16-model-governance-compliance.md)
