import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Member } from "@workspace-os/core";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { DrizzleMemberRepository } from "./drizzle-member-repository.js";

describe("DrizzleMemberRepository (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const repo = new DrizzleMemberRepository(db);

  beforeEach(async () => {
    await runMigrations(connectionString);
    // CASCADE clears activities that FK-reference members (Epic 2 attribution).
    await db.execute(sql`truncate table members restart identity cascade`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves and reloads a human member as a domain Member", async () => {
    const member = Member.create({
      id: "m_human_1",
      type: "human",
      identityRef: "oidc|abc",
      displayName: "Ada",
      roles: ["engineer", "reviewer"],
    });

    await repo.save(member);
    const loaded = await repo.findById("m_human_1");

    expect(loaded).not.toBeNull();
    expect(loaded!.type).toBe("human");
    expect(loaded!.displayName).toBe("Ada");
    expect(loaded!.roles.sort()).toEqual(["engineer", "reviewer"]);
    expect(loaded!.isHuman).toBe(true);
  });

  it("saves and reloads an agent member the same way (peer model)", async () => {
    const member = Member.create({
      id: "m_agent_1",
      type: "agent",
      identityRef: "cred_xyz",
      displayName: "Analyst Bot",
      roles: ["data-analyst"],
    });

    await repo.save(member);
    const loaded = await repo.findById("m_agent_1");

    expect(loaded!.isAgent).toBe(true);
    expect(loaded!.roles).toEqual(["data-analyst"]);
  });

  it("returns null for an unknown id", async () => {
    await expect(repo.findById("nope")).resolves.toBeNull();
  });

  it("finds a member by identityRef", async () => {
    await repo.save(
      Member.create({
        id: "m_1",
        type: "human",
        identityRef: "oidc|find-me",
        displayName: "Grace",
        roles: [],
      }),
    );

    const loaded = await repo.findByIdentityRef("oidc|find-me");
    expect(loaded!.id).toBe("m_1");
  });

  it("upserts on save: saving the same id twice updates rather than duplicating", async () => {
    const first = Member.create({
      id: "m_up",
      type: "human",
      identityRef: "oidc|up",
      displayName: "Original",
      roles: ["a"],
    });
    await repo.save(first);
    await repo.save(first.withRole("b").withoutRole("a"));

    const loaded = await repo.findById("m_up");
    expect(loaded!.roles).toEqual(["b"]);

    const count = await db.execute(sql`select count(*)::int as n from members`);
    expect(count.rows[0]).toMatchObject({ n: 1 });
  });
});
