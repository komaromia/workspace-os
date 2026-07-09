import type { FastifyInstance } from "fastify";
import { createDb, DrizzleMemberRepository } from "@workspace-os/adapters";
import { buildApp } from "./app.js";
import { registerMemberRoutes } from "./routes/members.js";

/** The pg Pool type, derived from createDb so the server needn't declare pg
 * as a direct dependency. */
type Pool = ReturnType<typeof createDb>["pool"];

export interface BuiltServer {
  app: FastifyInstance;
  pool: Pool;
}

/**
 * Composition root: wires the Postgres-backed repositories into the Fastify
 * app. Readiness actually pings Postgres, so /ready reflects whether the
 * database is reachable, not just that the process is up.
 *
 * The DB is currently the same in both profiles (only its location differs —
 * Epic 15), so this takes a connection string directly. Profile-specific
 * adapters (object store, model provider) plug in here via createAdapters as
 * those surfaces gain HTTP routes.
 */
export function buildServer(connectionString: string, logger = false): BuiltServer {
  const { db, pool } = createDb(connectionString);
  const members = new DrizzleMemberRepository(db);

  const app = buildApp({
    logger,
    readinessCheck: async () => {
      await pool.query("select 1");
      return true;
    },
  });
  registerMemberRoutes(app, { members });

  return { app, pool };
}
