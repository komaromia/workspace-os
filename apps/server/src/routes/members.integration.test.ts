import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConnectionString, runMigrations } from "@workspace-os/adapters";
import { buildServer } from "../build-server.js";

describe("members routes (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  let app: FastifyInstance;
  let close: () => Promise<void>;

  beforeEach(async () => {
    await runMigrations(connectionString);
    const server = buildServer(connectionString);
    app = server.app;
    close = async () => {
      await app.close();
      await server.pool.end();
    };
    await server.pool.query("truncate table members restart identity cascade");
  });

  afterEach(async () => {
    await close();
  });

  it("creates a member via POST /members and reads it back via GET /members/:id", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/members",
      payload: {
        id: "m_api_1",
        type: "agent",
        identityRef: "cred|api",
        displayName: "API Bot",
        roles: ["data-analyst"],
      },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json()).toMatchObject({ id: "m_api_1", type: "agent" });

    const get = await app.inject({ method: "GET", url: "/members/m_api_1" });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toMatchObject({
      id: "m_api_1",
      type: "agent",
      displayName: "API Bot",
      roles: ["data-analyst"],
    });
  });

  it("returns 400 for an invalid member payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/members",
      payload: { id: "", type: "agent", identityRef: "x", displayName: "y", roles: [] },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "invalid-member" });
  });

  it("returns 400 for an unknown member type", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/members",
      payload: { id: "m_x", type: "robot", identityRef: "x", displayName: "y", roles: [] },
    });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for an unknown member id", async () => {
    const res = await app.inject({ method: "GET", url: "/members/does-not-exist" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "not-found" });
  });

  it("reports readiness by actually pinging Postgres", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ready" });
  });
});
