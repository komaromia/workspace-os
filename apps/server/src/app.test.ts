import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

describe("buildApp", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("responds to GET /health with ok (liveness)", async () => {
    app = buildApp();

    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });

  it("responds to GET /ready with ready when the readiness check passes", async () => {
    app = buildApp({ readinessCheck: async () => true });

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready" });
  });

  it("returns 503 not-ready when the readiness check fails", async () => {
    app = buildApp({ readinessCheck: async () => false });

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "not-ready" });
  });

  it("returns 503 not-ready when the readiness check throws", async () => {
    app = buildApp({
      readinessCheck: async () => {
        throw new Error("db down");
      },
    });

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: "not-ready" });
  });

  it("defaults readiness to ready when no check is supplied", async () => {
    app = buildApp();

    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready" });
  });

  it("returns a JSON 404 for an unknown route", async () => {
    app = buildApp();

    const res = await app.inject({ method: "GET", url: "/nope" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not-found" });
  });
});
