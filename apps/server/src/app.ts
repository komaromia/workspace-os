import Fastify, { type FastifyInstance } from "fastify";

export interface BuildAppOptions {
  /**
   * Returns true when the process is ready to serve traffic (e.g. the
   * database is reachable). Defaults to always-ready. A throw is treated as
   * not-ready, so callers don't have to catch inside the check.
   */
  readinessCheck?: () => Promise<boolean>;
  logger?: boolean;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "not-found" });
  });

  // Liveness: the process is up. Deliberately does not touch dependencies.
  app.get("/health", async () => ({ status: "ok" }));

  // Readiness: the process can serve traffic (dependencies reachable).
  app.get("/ready", async (_request, reply) => {
    const check = options.readinessCheck ?? (async () => true);
    let ready = false;
    try {
      ready = await check();
    } catch {
      ready = false;
    }
    if (!ready) {
      return reply.code(503).send({ status: "not-ready" });
    }
    return { status: "ready" };
  });

  return app;
}
