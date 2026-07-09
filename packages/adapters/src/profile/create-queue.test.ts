import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PostgresQueue } from "../queue/postgres-queue.js";
import { createQueue } from "./create-queue.js";

describe("createQueue", () => {
  // pg.Pool is lazy: constructing one does not open a connection, so this
  // stays a fast unit test with no Docker/Postgres dependency.
  let pool: Pool;

  beforeEach(() => {
    pool = new Pool({ connectionString: "postgres://unused/unused" });
  });

  afterEach(async () => {
    await pool.end();
  });

  it("returns a PostgresQueue for the simple profile", () => {
    const queue = createQueue(pool, "my-queue", "simple");

    expect(queue).toBeInstanceOf(PostgresQueue);
  });

  it("returns a PostgresQueue for the hardened profile (Postgres is used in both)", () => {
    const queue = createQueue(pool, "my-queue", "hardened");

    expect(queue).toBeInstanceOf(PostgresQueue);
  });
});
