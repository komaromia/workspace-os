import { describe, expect, it } from "vitest";
import { InvalidMemberError, Member } from "./member.js";

describe("Member", () => {
  const baseHuman = {
    id: "m_human_1",
    type: "human" as const,
    identityRef: "oidc|subject-123",
    displayName: "Ada Lovelace",
    roles: ["engineer"],
  };

  const baseAgent = {
    id: "m_agent_1",
    type: "agent" as const,
    identityRef: "cred_abc",
    displayName: "Analyst Bot",
    roles: ["data-analyst"],
  };

  it("constructs a human member and exposes its fields", () => {
    const member = Member.create(baseHuman);

    expect(member.id).toBe("m_human_1");
    expect(member.type).toBe("human");
    expect(member.identityRef).toBe("oidc|subject-123");
    expect(member.displayName).toBe("Ada Lovelace");
    expect(member.isHuman).toBe(true);
    expect(member.isAgent).toBe(false);
  });

  it("constructs an agent member as a first-class principal, not a special case", () => {
    const member = Member.create(baseAgent);

    expect(member.type).toBe("agent");
    expect(member.isAgent).toBe(true);
    expect(member.isHuman).toBe(false);
    // The peer model: both types can be assigned work through the same check.
    expect(member.canBeAssignedWork).toBe(true);
    expect(Member.create(baseHuman).canBeAssignedWork).toBe(true);
  });

  it("checks roles with hasRole and hasAnyRole", () => {
    const member = Member.create({ ...baseHuman, roles: ["engineer", "reviewer"] });

    expect(member.hasRole("engineer")).toBe(true);
    expect(member.hasRole("admin")).toBe(false);
    expect(member.hasAnyRole(["admin", "reviewer"])).toBe(true);
    expect(member.hasAnyRole(["admin", "owner"])).toBe(false);
  });

  it("exposes roles as an immutable copy that cannot mutate internal state", () => {
    const member = Member.create(baseHuman);
    const roles = member.roles;
    roles.push("admin");

    expect(member.hasRole("admin")).toBe(false);
  });

  it("adds and removes roles immutably, returning a new Member", () => {
    const member = Member.create(baseHuman);

    const withReviewer = member.withRole("reviewer");
    expect(withReviewer).not.toBe(member);
    expect(member.hasRole("reviewer")).toBe(false);
    expect(withReviewer.hasRole("reviewer")).toBe(true);

    const removed = withReviewer.withoutRole("reviewer");
    expect(removed.hasRole("reviewer")).toBe(false);
  });

  it("does not duplicate a role that is already present", () => {
    const member = Member.create(baseHuman).withRole("engineer");

    expect(member.roles.filter((r) => r === "engineer")).toHaveLength(1);
  });

  it("de-duplicates roles supplied at construction", () => {
    const member = Member.create({ ...baseHuman, roles: ["engineer", "engineer", "reviewer"] });

    expect(member.roles.sort()).toEqual(["engineer", "reviewer"]);
  });

  it("rejects an unknown member type", () => {
    expect(() => Member.create({ ...baseHuman, type: "robot" as never })).toThrow(
      InvalidMemberError,
    );
  });

  it("rejects a blank id, identityRef, or displayName", () => {
    expect(() => Member.create({ ...baseHuman, id: "" })).toThrow(InvalidMemberError);
    expect(() => Member.create({ ...baseHuman, identityRef: "  " })).toThrow(InvalidMemberError);
    expect(() => Member.create({ ...baseHuman, displayName: "" })).toThrow(InvalidMemberError);
  });

  it("round-trips through a plain object via toJSON/create", () => {
    const member = Member.create(baseAgent).withRole("reviewer");
    const json = member.toJSON();
    const rebuilt = Member.create(json);

    expect(rebuilt.id).toBe(member.id);
    expect(rebuilt.type).toBe(member.type);
    expect(rebuilt.roles.sort()).toEqual(member.roles.sort());
  });
});
