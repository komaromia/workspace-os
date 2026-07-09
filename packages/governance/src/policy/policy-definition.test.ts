import { describe, expect, it } from "vitest";
import { Member } from "@workspace-os/core";
import { PolicyEngine } from "../authz/policy-engine.js";
import { InvalidPolicyError, PolicyDefinition } from "./policy-definition.js";

describe("PolicyDefinition", () => {
  const base = {
    policyId: "default",
    actions: [
      { name: "artifact.read", consequence: "routine" as const },
      {
        name: "production.merge",
        consequence: "consequential" as const,
        requiredRoles: ["maintainer"],
      },
    ],
  };

  it("constructs at version 1 exposing its actions", () => {
    const policy = PolicyDefinition.create(base);

    expect(policy.policyId).toBe("default");
    expect(policy.version).toBe(1);
    expect(policy.actions.map((a) => a.name).sort()).toEqual(["artifact.read", "production.merge"]);
  });

  it("builds an ActionRegistry that classifies its actions", () => {
    const registry = PolicyDefinition.create(base).toActionRegistry();

    expect(registry.get("production.merge")?.consequence).toBe("consequential");
    expect(registry.has("nope")).toBe(false);
  });

  it("revising bumps the version and replaces actions, leaving the prior version intact", () => {
    const v1 = PolicyDefinition.create(base);

    const v2 = v1.revise({
      actions: [{ name: "money.transfer", consequence: "irreversible" }],
    });

    expect(v2.version).toBe(2);
    expect(v2.actions.map((a) => a.name)).toEqual(["money.transfer"]);
    expect(v1.version).toBe(1);
    expect(v1.actions.map((a) => a.name).sort()).toEqual(["artifact.read", "production.merge"]);
  });

  it("rejects a blank policyId", () => {
    expect(() => PolicyDefinition.create({ ...base, policyId: "" })).toThrow(InvalidPolicyError);
  });

  it("rejects duplicate action names", () => {
    expect(() =>
      PolicyDefinition.create({
        policyId: "p",
        actions: [
          { name: "dup", consequence: "routine" },
          { name: "dup", consequence: "consequential" },
        ],
      }),
    ).toThrow(InvalidPolicyError);
  });

  it("rejects a version below 1 when rehydrating", () => {
    expect(() => PolicyDefinition.create({ ...base, version: 0 })).toThrow(InvalidPolicyError);
  });

  it("exposes actions as an immutable copy", () => {
    const policy = PolicyDefinition.create(base);
    policy.actions.push({ name: "injected", consequence: "routine" });

    expect(policy.actions.some((a) => a.name === "injected")).toBe(false);
  });

  it("round-trips through toJSON/create preserving the version", () => {
    const v2 = PolicyDefinition.create(base).revise({ actions: base.actions });
    const rebuilt = PolicyDefinition.create(v2.toJSON());

    expect(rebuilt.version).toBe(2);
    expect(rebuilt.policyId).toBe("default");
  });

  it("drives a PolicyEngine via PolicyEngine.fromDefinition", () => {
    const engine = PolicyEngine.fromDefinition(PolicyDefinition.create(base));
    const maintainer = Member.create({
      id: "m",
      type: "human",
      identityRef: "oidc|m",
      displayName: "M",
      roles: ["maintainer"],
    });

    expect(engine.authorize(maintainer, "artifact.read").outcome).toBe("allow");
    expect(engine.authorize(maintainer, "production.merge").outcome).toBe("requires_approval");
    expect(engine.authorize(maintainer, "unknown").outcome).toBe("deny");
  });
});
