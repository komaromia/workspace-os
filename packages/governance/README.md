# @workspace-os/governance

Authorization (deny-by-default policy checks, dual control), approvals, and the audit log. This
is the boundary that keeps agents peers in participation but never in privilege — kept as its own
package so it is easy to point at in a security review and to eventually extract into a
dedicated service.

Not yet implemented — see:
- [`docs/epics/03-authorization-policy.md`](../../docs/epics/03-authorization-policy.md)
- [`docs/epics/04-audit-observability.md`](../../docs/epics/04-audit-observability.md)
- [`docs/epics/14-approvals-hitl-ux.md`](../../docs/epics/14-approvals-hitl-ux.md)
