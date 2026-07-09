import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Member, UnknownActorError } from "@workspace-os/core";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { DrizzleMemberRepository } from "../repository/drizzle-member-repository.js";
import { DrizzleActivityLog } from "./drizzle-activity-log.js";

describe("DrizzleActivityLog (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const log = new DrizzleActivityLog(db);
  const members = new DrizzleMemberRepository(db);

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

  beforeEach(async () => {
    await runMigrations(connectionString);
    await db.execute(sql`truncate table members restart identity cascade`);
    await members.save(human);
    await members.save(agent);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("records a human action attributed to the acting member", async () => {
    const record = await log.record({
      actor: human,
      action: "artifact.create",
      resourceType: "artifact",
      resourceId: "art_1",
      metadata: { title: "Report" },
    });

    expect(record.id).toBeTruthy();
    expect(record.actorMemberId).toBe("m_human");
    expect(record.actorType).toBe("human");
    expect(record.action).toBe("artifact.create");
    expect(record.metadata).toEqual({ title: "Report" });
    expect(record.occurredAt).toBeInstanceOf(Date);
  });

  it("records an agent action through the identical path and shape", async () => {
    const humanRecord = await log.record({
      actor: human,
      action: "work.claim",
      resourceType: "work_item",
      resourceId: "w_1",
    });
    const agentRecord = await log.record({
      actor: agent,
      action: "work.claim",
      resourceType: "work_item",
      resourceId: "w_2",
    });

    // Same structure; the only distinguishing fields are the actor id/type.
    expect(Object.keys(agentRecord).sort()).toEqual(Object.keys(humanRecord).sort());
    expect(agentRecord.actorMemberId).toBe("m_agent");
    expect(agentRecord.actorType).toBe("agent");
    expect(humanRecord.actorType).toBe("human");
  });

  it("defaults metadata to an empty object when omitted", async () => {
    const record = await log.record({
      actor: agent,
      action: "ping",
      resourceType: "system",
      resourceId: "s_1",
    });

    expect(record.metadata).toEqual({});
  });

  it("lists activities by actor", async () => {
    await log.record({ actor: human, action: "a1", resourceType: "r", resourceId: "1" });
    await log.record({ actor: human, action: "a2", resourceType: "r", resourceId: "2" });
    await log.record({ actor: agent, action: "b1", resourceType: "r", resourceId: "3" });

    const humanActs = await log.listByActor("m_human");
    expect(humanActs.map((a) => a.action).sort()).toEqual(["a1", "a2"]);

    const agentActs = await log.listByActor("m_agent");
    expect(agentActs.map((a) => a.action)).toEqual(["b1"]);
  });

  it("lists activities by resource, mixing human and agent actors uniformly", async () => {
    await log.record({ actor: human, action: "edit", resourceType: "doc", resourceId: "d_1" });
    await log.record({ actor: agent, action: "edit", resourceType: "doc", resourceId: "d_1" });
    await log.record({ actor: agent, action: "edit", resourceType: "doc", resourceId: "d_other" });

    const acts = await log.listByResource("doc", "d_1");
    expect(acts).toHaveLength(2);
    expect(acts.map((a) => a.actorType).sort()).toEqual(["agent", "human"]);
  });

  it("rejects attributing an activity to a member that does not exist", async () => {
    const ghost = Member.create({
      id: "m_ghost",
      type: "agent",
      identityRef: "cred|ghost",
      displayName: "Ghost",
      roles: [],
    });

    await expect(
      log.record({ actor: ghost, action: "x", resourceType: "r", resourceId: "1" }),
    ).rejects.toThrow(UnknownActorError);
  });
});
