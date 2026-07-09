import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PolicyDefinition, PolicyVersionConflictError } from "@workspace-os/governance";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { DrizzlePolicyRepository } from "./drizzle-policy-repository.js";

describe("DrizzlePolicyRepository (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const repo = new DrizzlePolicyRepository(db);

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

  beforeEach(async () => {
    await runMigrations(connectionString);
    await db.execute(sql`delete from policy_versions`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves a policy version and reloads it, preserving action classifications", async () => {
    await repo.saveVersion(PolicyDefinition.create(base));

    const loaded = await repo.findVersion("default", 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    const registry = loaded!.toActionRegistry();
    expect(registry.get("production.merge")?.consequence).toBe("consequential");
    expect(registry.get("production.merge")?.requiredRoles).toEqual(["maintainer"]);
  });

  it("retains every version and findLatest returns the highest", async () => {
    const v1 = PolicyDefinition.create(base);
    const v2 = v1.revise({ actions: [{ name: "money.transfer", consequence: "irreversible" }] });
    await repo.saveVersion(v1);
    await repo.saveVersion(v2);

    const latest = await repo.findLatest("default");
    expect(latest!.version).toBe(2);
    expect(latest!.actions.map((a) => a.name)).toEqual(["money.transfer"]);

    // The prior version's rules remain auditable.
    const old = await repo.findVersion("default", 1);
    expect(old!.actions.map((a) => a.name).sort()).toEqual(["artifact.read", "production.merge"]);
  });

  it("rejects saving an already-existing version (immutable)", async () => {
    await repo.saveVersion(PolicyDefinition.create(base));

    await expect(repo.saveVersion(PolicyDefinition.create(base))).rejects.toThrow(
      PolicyVersionConflictError,
    );
  });

  it("returns null for an unknown policy or version", async () => {
    await expect(repo.findVersion("nope", 1)).resolves.toBeNull();
    await expect(repo.findLatest("nope")).resolves.toBeNull();
  });
});
