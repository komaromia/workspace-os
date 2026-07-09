import { describe, expect, it } from "vitest";
import { Member } from "@workspace-os/core";
import { ActionRegistry } from "./action.js";
import { PolicyEngine } from "./policy-engine.js";

describe("PolicyEngine", () => {
  const registry = ActionRegistry.of([
    { name: "artifact.read", consequence: "routine" },
    { name: "artifact.draft", consequence: "routine" },
    { name: "production.merge", consequence: "consequential" },
    { name: "access.grant", consequence: "consequential" },
    { name: "money.transfer", consequence: "irreversible" },
  ]);
  const engine = new PolicyEngine(registry);

  const human = Member.create({
    id: "m_human",
    type: "human",
    identityRef: "oidc|h",
    displayName: "Ada",
    roles: ["engineer"],
  });
  const agent = Member.create({
    id: "m_agent",
    type: "agent",
    identityRef: "cred|a",
    displayName: "Bot",
    roles: ["data-analyst"],
  });

  it("denies unknown actions by default", () => {
    const decision = engine.authorize(human, "totally.unknown");

    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toBe("unknown-action");
  });

  it("allows routine actions for humans and agents alike", () => {
    expect(engine.authorize(human, "artifact.draft").outcome).toBe("allow");
    expect(engine.authorize(agent, "artifact.draft").outcome).toBe("allow");
  });

  it("routes a consequential action to approval rather than allowing it (human)", () => {
    const decision = engine.authorize(human, "production.merge");

    expect(decision.outcome).toBe("requires_approval");
    expect(decision.approversRequired).toBe(1);
    expect(decision.reason).toBe("consequential-requires-approval");
  });

  it("never lets an agent execute a consequential action — always routes to approval", () => {
    const decision = engine.authorize(agent, "production.merge");

    expect(decision.outcome).toBe("requires_approval");
    expect(decision.outcome).not.toBe("allow");
  });

  it("requires dual control (two approvers) for irreversible actions", () => {
    const decision = engine.authorize(human, "money.transfer");

    expect(decision.outcome).toBe("requires_approval");
    expect(decision.approversRequired).toBe(2);
    expect(decision.reason).toBe("irreversible-requires-dual-control");
  });

  it("requires dual control for an agent-initiated irreversible action too", () => {
    const decision = engine.authorize(agent, "money.transfer");

    expect(decision.outcome).toBe("requires_approval");
    expect(decision.approversRequired).toBe(2);
  });

  it("exposes whether a member may execute an action directly (no approval)", () => {
    expect(engine.canExecuteDirectly(human, "artifact.read")).toBe(true);
    expect(engine.canExecuteDirectly(agent, "production.merge")).toBe(false);
    expect(engine.canExecuteDirectly(human, "money.transfer")).toBe(false);
    expect(engine.canExecuteDirectly(human, "unknown.action")).toBe(false);
  });
});
