import type { Member } from "@workspace-os/core";
import type { ActionRegistry, Consequence } from "./action.js";

export type AuthorizationOutcome = "allow" | "deny" | "requires_approval";

export interface AuthorizationDecision {
  outcome: AuthorizationOutcome;
  /** Stable code explaining the decision, suitable for audit logging. */
  reason: string;
  /** Present when outcome is requires_approval: how many distinct approvers. */
  approversRequired?: number;
}

/**
 * The central authorization decision point (Epic 3). Deny-by-default: an
 * unknown action is refused, never permitted. Consequence drives the outcome
 * so that no one — human or agent — executes a consequential action directly;
 * every such action becomes a proposal a human approves. This is the boundary
 * that keeps agents peers in participation but not in privilege.
 *
 * Role- and relationship-based grants layer on top of this in a later story;
 * this core establishes the consequence gate and the deny-by-default posture.
 */
export class PolicyEngine {
  constructor(private readonly registry: ActionRegistry) {}

  authorize(_member: Member, actionName: string): AuthorizationDecision {
    const action = this.registry.get(actionName);
    if (!action) {
      return { outcome: "deny", reason: "unknown-action" };
    }
    return decideByConsequence(action.consequence);
  }

  /** True only when the member may perform the action with no approval step. */
  canExecuteDirectly(member: Member, actionName: string): boolean {
    return this.authorize(member, actionName).outcome === "allow";
  }
}

function decideByConsequence(consequence: Consequence): AuthorizationDecision {
  switch (consequence) {
    case "routine":
      return { outcome: "allow", reason: "routine-allowed" };
    case "consequential":
      return {
        outcome: "requires_approval",
        reason: "consequential-requires-approval",
        approversRequired: 1,
      };
    case "irreversible":
      return {
        outcome: "requires_approval",
        reason: "irreversible-requires-dual-control",
        approversRequired: 2,
      };
  }
}
