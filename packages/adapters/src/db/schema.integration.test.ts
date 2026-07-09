import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, defaultConnectionString } from "./connection.js";
import { runMigrations } from "./migrate.js";
import { schemaBootstrapProbe } from "./schema.js";

describe("Postgres + pgvector + Drizzle wiring (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);

  beforeAll(async () => {
    await runMigrations(connectionString);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("has the pgvector extension enabled", async () => {
    const result = await db.execute(sql`select extname from pg_extension where extname = 'vector'`);
    expect(result.rows).toHaveLength(1);
  });

  it("round-trips a row with a vector column through drizzle", async () => {
    const [inserted] = await db
      .insert(schemaBootstrapProbe)
      .values({ label: "integration-test", embedding: [0.1, 0.2, 0.3] })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted!.label).toBe("integration-test");
    expect(inserted!.embedding).toEqual([0.1, 0.2, 0.3]);

    const rows = await db
      .select()
      .from(schemaBootstrapProbe)
      .where(sql`${schemaBootstrapProbe.id} = ${inserted!.id}`);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("supports pgvector nearest-neighbor ordering via <-> ", async () => {
    await db.insert(schemaBootstrapProbe).values([
      { label: "near", embedding: [1, 0, 0] },
      { label: "far", embedding: [0, 0, 1] },
    ]);

    const rows = await db.execute(
      sql`select label from _schema_bootstrap_probe order by embedding <-> '[1,0,0]' limit 1`,
    );

    expect(rows.rows[0]).toMatchObject({ label: "near" });
  });
});
