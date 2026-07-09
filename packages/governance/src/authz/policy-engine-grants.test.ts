import { describe, expect, it } from "vitest";
import { Member } from "@workspace-os/core";
import { ActionRegistry } from "./action.js";
import { PolicyEngine } from "./policy-engine.js";

describe("PolicyEngine role- and relationship-based grants", () => {
  const registry = ActionRegistry.of([
    { name: "artifact.read", consequence: "routine" },
    { name: "repo.configure", consequence: "routine", requiredRoles: ["maintainer", "admin"] },
    { name: "artifact.delete", consequence: "routine", requiredRelationship: "owner" },
    {
      name: "production.merge",
      consequence: "consequential",
      requiredRoles: ["maintainer"],
    },
  ]);
  const engine = new PolicyEngine(registry);

  const maintainer = Member.create({
    id: "m_1",
    type: "human",
    identityRef: "oidc|1",
    displayName: "Maintainer",
    roles: ["maintainer"],
  });
  const contributor = Member.create({
    id: "m_2",
    type: "human",
    identityRef: "oidc|2",
    displayName: "Contributor",
    roles: ["contributor"],
  });

  it("allows an action with no role requirement for anyone", () => {
    expect(engine.authorize(contributor, "artifact.read").outcome).toBe("allow");
  });

  it("allows a role-gated action when the member has one of the required roles", () => {
    expect(engine.authorize(maintainer, "repo.configure").outcome).toBe("allow");
  });

  it("denies a role-gated action when the member lacks every required role", () => {
    const decision = engine.authorize(contributor, "repo.configure");

    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toBe("insufficient-role");
  });

  it("enforces the role gate before consequence routing", () => {
    // contributor lacks 'maintainer', so this is denied outright — not routed
    // to approval. You must be eligible even to propose.
    const decision = engine.authorize(contributor, "production.merge");

    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toBe("insufficient-role");
  });

  it("still routes to approval when the role gate passes but the action is consequential", () => {
    const decision = engine.authorize(maintainer, "production.merge");

    expect(decision.outcome).toBe("requires_approval");
    expect(decision.approversRequired).toBe(1);
  });

  it("allows a relationship-gated action when the member has the relationship to the resource", () => {
    const decision = engine.authorize(contributor, "artifact.delete", {
      relationships: ["owner"],
    });

    expect(decision.outcome).toBe("allow");
  });

  it("denies a relationship-gated action when the member lacks the relationship", () => {
    const decision = engine.authorize(contributor, "artifact.delete", {
      relationships: ["viewer"],
    });

    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toBe("missing-relationship");
  });

  it("denies a relationship-gated action when no relationship context is supplied", () => {
    const decision = engine.authorize(contributor, "artifact.delete");

    expect(decision.outcome).toBe("deny");
    expect(decision.reason).toBe("missing-relationship");
  });
});
