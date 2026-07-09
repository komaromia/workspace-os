import type { Pool } from "pg";
import type { Queue, QueueMessage } from "@workspace-os/core";

export class PostgresQueue<T> implements Queue<T> {
  constructor(
    private readonly pool: Pool,
    private readonly queueName: string,
  ) {}

  async enqueue(payload: T): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `insert into queue_messages (queue_name, payload)
       values ($1, $2)
       returning id`,
      [this.queueName, JSON.stringify(payload)],
    );
    return result.rows[0]!.id;
  }

  async claim(): Promise<QueueMessage<T> | null> {
    const result = await this.pool.query<{ id: string; payload: T; attempts: number }>(
      `update queue_messages
       set status = 'claimed', claimed_at = now(), attempts = attempts + 1
       where id = (
         select id from queue_messages
         where queue_name = $1 and status = 'pending'
         order by created_at
         for update skip locked
         limit 1
       )
       returning id, payload, attempts`,
      [this.queueName],
    );
    const row = result.rows[0];
    if (!row) return null;
    return { id: row.id, payload: row.payload, attempts: row.attempts };
  }

  async complete(id: string): Promise<void> {
    await this.pool.query(
      `update queue_messages set status = 'completed', completed_at = now() where id = $1`,
      [id],
    );
  }

  async fail(id: string, error: string): Promise<void> {
    await this.pool.query(
      `update queue_messages
       set status = 'pending', last_error = $2, claimed_at = null
       where id = $1`,
      [id, error],
    );
  }
}
