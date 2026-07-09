import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, defaultConnectionString } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { PostgresQueue } from "./postgres-queue.js";

interface TaskPayload {
  taskId: string;
}

describe("PostgresQueue (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);

  beforeEach(async () => {
    await runMigrations(connectionString);
    await db.execute(sql`delete from queue_messages`);
  });

  afterAll(async () => {
    await pool.end();
  });

  function makeQueue(queueName: string): PostgresQueue<TaskPayload> {
    return new PostgresQueue<TaskPayload>(pool, queueName);
  }

  it("claim() returns null when the queue is empty", async () => {
    const queue = makeQueue("empty-queue");

    await expect(queue.claim()).resolves.toBeNull();
  });

  it("enqueues a message and claims it back with attempts incremented", async () => {
    const queue = makeQueue("basic-queue");

    const id = await queue.enqueue({ taskId: "abc" });
    const claimed = await queue.claim();

    expect(claimed).not.toBeNull();
    expect(claimed!.id).toBe(id);
    expect(claimed!.payload).toEqual({ taskId: "abc" });
    expect(claimed!.attempts).toBe(1);
  });

  it("does not return a claimed message to a second claim()", async () => {
    const queue = makeQueue("no-double-claim");
    await queue.enqueue({ taskId: "only-one" });

    const first = await queue.claim();
    const second = await queue.claim();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("only claims messages belonging to its own queue name", async () => {
    const queueA = makeQueue("queue-a");
    const queueB = makeQueue("queue-b");
    await queueA.enqueue({ taskId: "for-a" });

    await expect(queueB.claim()).resolves.toBeNull();
    await expect(queueA.claim()).resolves.not.toBeNull();
  });

  it("complete() marks a message so it is never claimed again", async () => {
    const queue = makeQueue("complete-queue");
    await queue.enqueue({ taskId: "finish-me" });
    const claimed = await queue.claim();

    await queue.complete(claimed!.id);

    const rows = await db.execute(
      sql`select status, completed_at from queue_messages where id = ${claimed!.id}`,
    );
    expect(rows.rows[0]).toMatchObject({ status: "completed" });
    expect(rows.rows[0]!.completed_at).not.toBeNull();
  });

  it("fail() records the error and returns the message to pending for retry", async () => {
    const queue = makeQueue("fail-queue");
    await queue.enqueue({ taskId: "retry-me" });
    const claimed = await queue.claim();

    await queue.fail(claimed!.id, "boom");

    const reclaimed = await queue.claim();
    expect(reclaimed).not.toBeNull();
    expect(reclaimed!.id).toBe(claimed!.id);
    expect(reclaimed!.attempts).toBe(2);

    const rows = await db.execute(
      sql`select last_error from queue_messages where id = ${claimed!.id}`,
    );
    expect(rows.rows[0]).toMatchObject({ last_error: "boom" });
  });

  it("never lets two concurrent claimers on the same queue see the same message", async () => {
    const queue = makeQueue("concurrency-queue");
    const messageCount = 20;
    for (let i = 0; i < messageCount; i++) {
      await queue.enqueue({ taskId: `task-${i}` });
    }

    const claimerCount = 5;
    const claimsPerClaimer = await Promise.all(
      Array.from({ length: claimerCount }, async () => {
        const claims = [];
        for (;;) {
          const claimed = await queue.claim();
          if (!claimed) break;
          claims.push(claimed.id);
        }
        return claims;
      }),
    );

    const allClaimedIds = claimsPerClaimer.flat();
    expect(allClaimedIds).toHaveLength(messageCount);
    expect(new Set(allClaimedIds).size).toBe(messageCount);
  });
});
