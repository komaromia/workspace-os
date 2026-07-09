import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { EmailAlreadyRegisteredError, Member } from "@workspace-os/core";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { DrizzleHumanCredentialRepository } from "./drizzle-human-credential-repository.js";
import { DrizzleMemberRepository } from "./drizzle-member-repository.js";

describe("DrizzleHumanCredentialRepository (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const repo = new DrizzleHumanCredentialRepository(db);
  const members = new DrizzleMemberRepository(db);

  beforeEach(async () => {
    await runMigrations(connectionString);
    await db.execute(sql`truncate table members restart identity cascade`);
    await members.save(
      Member.create({
        id: "m_1",
        type: "human",
        identityRef: "local|ada@example.com",
        displayName: "Ada",
        roles: [],
      }),
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves a credential and finds it by email", async () => {
    await repo.save({ memberId: "m_1", email: "ada@example.com", passwordHash: "hash1" });

    const found = await repo.findByEmail("ada@example.com");
    expect(found).toEqual({ memberId: "m_1", email: "ada@example.com", passwordHash: "hash1" });
  });

  it("returns null for an unknown email", async () => {
    await expect(repo.findByEmail("nobody@example.com")).resolves.toBeNull();
  });

  it("rejects a second credential for an already-registered email", async () => {
    await repo.save({ memberId: "m_1", email: "dup@example.com", passwordHash: "h" });

    await members.save(
      Member.create({
        id: "m_2",
        type: "human",
        identityRef: "local|dup2",
        displayName: "Other",
        roles: [],
      }),
    );

    await expect(
      repo.save({ memberId: "m_2", email: "dup@example.com", passwordHash: "h2" }),
    ).rejects.toThrow(EmailAlreadyRegisteredError);
  });
});
