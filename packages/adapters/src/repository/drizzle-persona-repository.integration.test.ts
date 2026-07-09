import { sql } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Persona, PersonaVersionConflictError } from "@workspace-os/core";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { DrizzlePersonaRepository } from "./drizzle-persona-repository.js";

describe("DrizzlePersonaRepository (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const repo = new DrizzlePersonaRepository(db);

  const base = {
    personaId: "persona_analyst",
    name: "Data Analyst",
    role: "data-analyst",
    systemPrompt: "You analyze data.",
    allowedTools: ["duckdb.query"],
    model: { modelId: "claude-sonnet-5", temperature: 0.2, maxTokens: 4096 },
  };

  beforeEach(async () => {
    await runMigrations(connectionString);
    await db.execute(sql`delete from persona_versions`);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("saves a version and reloads it as a domain Persona", async () => {
    await repo.saveVersion(Persona.create(base));

    const loaded = await repo.findVersion("persona_analyst", 1);
    expect(loaded).not.toBeNull();
    expect(loaded!.version).toBe(1);
    expect(loaded!.systemPrompt).toBe("You analyze data.");
    expect(loaded!.model).toEqual({
      modelId: "claude-sonnet-5",
      temperature: 0.2,
      maxTokens: 4096,
    });
    expect(loaded!.allowsTool("duckdb.query")).toBe(true);
  });

  it("retains every version and findLatest returns the highest", async () => {
    const v1 = Persona.create(base);
    const v2 = v1.revise({ systemPrompt: "Revised." });
    const v3 = v2.revise({ name: "Senior Analyst" });
    await repo.saveVersion(v1);
    await repo.saveVersion(v2);
    await repo.saveVersion(v3);

    const latest = await repo.findLatest("persona_analyst");
    expect(latest!.version).toBe(3);
    expect(latest!.name).toBe("Senior Analyst");

    // Older versions are still retrievable — immutable history.
    const old = await repo.findVersion("persona_analyst", 1);
    expect(old!.systemPrompt).toBe("You analyze data.");
  });

  it("rejects saving a version that already exists (versions are immutable)", async () => {
    await repo.saveVersion(Persona.create(base));

    await expect(repo.saveVersion(Persona.create(base))).rejects.toThrow(
      PersonaVersionConflictError,
    );
  });

  it("returns null for an unknown persona or version", async () => {
    await expect(repo.findVersion("nope", 1)).resolves.toBeNull();
    await expect(repo.findLatest("nope")).resolves.toBeNull();
  });
});
