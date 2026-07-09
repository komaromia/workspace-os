import type { FastifyInstance } from "fastify";
import {
  createDb,
  DrizzleActivityLog,
  DrizzleHumanCredentialRepository,
  DrizzleMemberRepository,
  DrizzleWorkItemRepository,
} from "@workspace-os/adapters";
import { buildApp } from "./app.js";
import { SessionTokenService } from "./auth/session-token.js";
import { SignupService } from "./auth/signup-service.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerMemberRoutes } from "./routes/members.js";
import { registerWorkItemRoutes } from "./routes/work-items.js";

/** Dev-only fallback secret. In the hardened profile SESSION_SECRET is
 * injected from the vault; this default only exists so local dev works. */
const DEV_SESSION_SECRET = "dev-only-insecure-session-secret";

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
  const credentials = new DrizzleHumanCredentialRepository(db);
  const workItems = new DrizzleWorkItemRepository(db);
  const activity = new DrizzleActivityLog(db);
  const signup = new SignupService({ members, credentials });
  const sessions = new SessionTokenService(process.env.SESSION_SECRET ?? DEV_SESSION_SECRET);

  const app = buildApp({
    logger,
    readinessCheck: async () => {
      await pool.query("select 1");
      return true;
    },
  });
  registerMemberRoutes(app, { members });
  registerAuthRoutes(app, { signup, sessions, members });
  registerWorkItemRoutes(app, { workItems, activity, sessions, members });

  return { app, pool };
}
