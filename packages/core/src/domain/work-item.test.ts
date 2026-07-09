import { describe, expect, it } from "vitest";
import { Member } from "./member.js";
import {
  InvalidWorkItemError,
  WorkItem,
  WorkItemClaimError,
  WorkItemTransitionError,
} from "./work-item.js";

describe("WorkItem", () => {
  const base = {
    id: "w_1",
    title: "Write the onboarding doc",
    priority: 5,
  };

  const engineer = Member.create({
    id: "m_eng",
    type: "human",
    identityRef: "oidc|eng",
    displayName: "Eng",
    roles: ["engineer"],
  });
  const analyst = Member.create({
    id: "m_analyst",
    type: "agent",
    identityRef: "cred|an",
    displayName: "Analyst",
    roles: ["data-analyst"],
  });

  it("is created open and unassigned", () => {
    const item = WorkItem.create(base);

    expect(item.id).toBe("w_1");
    expect(item.title).toBe("Write the onboarding doc");
    expect(item.priority).toBe(5);
    expect(item.state).toBe("open");
    expect(item.assigneeMemberId).toBeNull();
  });

  it("rejects a blank title or non-integer priority", () => {
    expect(() => WorkItem.create({ ...base, title: "" })).toThrow(InvalidWorkItemError);
    expect(() => WorkItem.create({ ...base, priority: 1.5 })).toThrow(InvalidWorkItemError);
  });

  it("can be claimed by any member when it requires no specific role", () => {
    const claimed = WorkItem.create(base).claimBy(analyst);

    expect(claimed.state).toBe("claimed");
    expect(claimed.assigneeMemberId).toBe("m_analyst");
  });

  it("claim is immutable — the original stays open", () => {
    const item = WorkItem.create(base);
    item.claimBy(analyst);

    expect(item.state).toBe("open");
    expect(item.assigneeMemberId).toBeNull();
  });

  it("only lets a member with the required role claim a role-gated item", () => {
    const item = WorkItem.create({ ...base, requiredRole: "engineer" });

    expect(item.canBeClaimedBy(engineer)).toBe(true);
    expect(item.canBeClaimedBy(analyst)).toBe(false);
    expect(item.claimBy(engineer).assigneeMemberId).toBe("m_eng");
    expect(() => item.claimBy(analyst)).toThrow(WorkItemClaimError);
  });

  it("cannot be claimed twice", () => {
    const claimed = WorkItem.create(base).claimBy(engineer);

    expect(claimed.canBeClaimedBy(analyst)).toBe(false);
    expect(() => claimed.claimBy(analyst)).toThrow(WorkItemClaimError);
  });

  it("runs the happy-path lifecycle: claim → start → complete", () => {
    const done = WorkItem.create(base).claimBy(engineer).start().complete();

    expect(done.state).toBe("done");
    expect(done.assigneeMemberId).toBe("m_eng");
  });

  it("supports block and unblock while in progress", () => {
    const inProgress = WorkItem.create(base).claimBy(engineer).start();

    const blocked = inProgress.block("waiting on review");
    expect(blocked.state).toBe("blocked");

    const resumed = blocked.unblock();
    expect(resumed.state).toBe("in_progress");
  });

  it("rejects invalid transitions", () => {
    const open = WorkItem.create(base);
    expect(() => open.start()).toThrow(WorkItemTransitionError);
    expect(() => open.complete()).toThrow(WorkItemTransitionError);

    const claimed = open.claimBy(engineer);
    expect(() => claimed.complete()).toThrow(WorkItemTransitionError);
  });

  it("can be cancelled from open, claimed, or in_progress but not from done", () => {
    expect(WorkItem.create(base).cancel().state).toBe("cancelled");
    expect(WorkItem.create(base).claimBy(engineer).cancel().state).toBe("cancelled");

    const done = WorkItem.create(base).claimBy(engineer).start().complete();
    expect(() => done.cancel()).toThrow(WorkItemTransitionError);
  });

  it("round-trips through toJSON/create", () => {
    const item = WorkItem.create({ ...base, requiredRole: "engineer" })
      .claimBy(engineer)
      .start();
    const rebuilt = WorkItem.create(item.toJSON());

    expect(rebuilt.state).toBe("in_progress");
    expect(rebuilt.assigneeMemberId).toBe("m_eng");
    expect(rebuilt.requiredRole).toBe("engineer");
  });
});
