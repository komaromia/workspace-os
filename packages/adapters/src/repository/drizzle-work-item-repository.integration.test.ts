import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Member, WorkItem } from "@workspace-os/core";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { DrizzleMemberRepository } from "./drizzle-member-repository.js";
import { DrizzleWorkItemRepository } from "./drizzle-work-item-repository.js";

describe("DrizzleWorkItemRepository (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const repo = new DrizzleWorkItemRepository(db);
  const members = new DrizzleMemberRepository(db);

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

  beforeEach(async () => {
    await runMigrations(connectionString);
    await db.execute(sql`truncate table members restart identity cascade`);
    await members.save(engineer);
    await members.save(analyst);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves a work item and reads it back", async () => {
    await repo.save(WorkItem.create({ id: "w_1", title: "Doc", priority: 3 }));

    const loaded = await repo.findById("w_1");
    expect(loaded!.title).toBe("Doc");
    expect(loaded!.state).toBe("open");
  });

  it("lists open items ordered by priority then age", async () => {
    await repo.save(WorkItem.create({ id: "w_lo", title: "Low", priority: 1 }));
    await repo.save(WorkItem.create({ id: "w_hi", title: "High", priority: 9 }));
    await repo.save(WorkItem.create({ id: "w_mid", title: "Mid", priority: 5 }));

    const open = await repo.listOpen();
    expect(open.map((w) => w.id)).toEqual(["w_hi", "w_mid", "w_lo"]);
  });

  it("claimNext assigns an open item to the member and marks it claimed", async () => {
    await repo.save(WorkItem.create({ id: "w_1", title: "Doc", priority: 3 }));

    const claimed = await repo.claimNext(analyst);
    expect(claimed!.id).toBe("w_1");
    expect(claimed!.state).toBe("claimed");
    expect(claimed!.assigneeMemberId).toBe("m_analyst");

    const reloaded = await repo.findById("w_1");
    expect(reloaded!.state).toBe("claimed");
  });

  it("returns null from claimNext when nothing is available", async () => {
    await expect(repo.claimNext(analyst)).resolves.toBeNull();
  });

  it("only claims items whose required role the member holds", async () => {
    await repo.save(
      WorkItem.create({ id: "w_eng", title: "Eng only", priority: 5, requiredRole: "engineer" }),
    );

    // The analyst lacks 'engineer', so there is nothing it can claim.
    await expect(repo.claimNext(analyst)).resolves.toBeNull();
    // The engineer can.
    const claimed = await repo.claimNext(engineer);
    expect(claimed!.id).toBe("w_eng");
  });

  it("claims the highest-priority eligible item first", async () => {
    await repo.save(WorkItem.create({ id: "w_lo", title: "Low", priority: 1 }));
    await repo.save(WorkItem.create({ id: "w_hi", title: "High", priority: 9 }));

    const claimed = await repo.claimNext(analyst);
    expect(claimed!.id).toBe("w_hi");
  });

  it("never gives the same item to two concurrent claimers (FOR UPDATE SKIP LOCKED)", async () => {
    const itemCount = 20;
    for (let i = 0; i < itemCount; i++) {
      await repo.save(WorkItem.create({ id: `w_${i}`, title: `Item ${i}`, priority: i }));
    }

    const claimerCount = 5;
    const results = await Promise.all(
      Array.from({ length: claimerCount }, async () => {
        const claimedIds: string[] = [];
        for (;;) {
          const item = await repo.claimNext(analyst);
          if (!item) break;
          claimedIds.push(item.id);
        }
        return claimedIds;
      }),
    );

    const allClaimed = results.flat();
    expect(allClaimed).toHaveLength(itemCount);
    expect(new Set(allClaimed).size).toBe(itemCount);
  });
});
