import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export function createDb(connectionString: string): {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
} {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export function defaultConnectionString(): string {
  return (
    process.env.DATABASE_URL ?? "postgres://workspace_os:workspace_os@localhost:55432/workspace_os"
  );
}
