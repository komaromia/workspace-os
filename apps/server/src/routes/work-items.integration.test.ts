import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConnectionString, runMigrations } from "@workspace-os/adapters";
import { buildServer } from "../build-server.js";

describe("work board routes (requires local docker Postgres)", () => {
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

  async function tokenFor(email: string): Promise<string> {
    await app.inject({
      method: "POST",
      url: "/signup",
      payload: { email, password: "password123", displayName: email },
    });
    const login = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email, password: "password123" },
    });
    return login.json().token as string;
  }

  function auth(token: string) {
    return { authorization: `Bearer ${token}` };
  }

  it("requires authentication to publish", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/work-items",
      payload: { title: "Anon" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("publishes a work item and lists it on the board", async () => {
    const token = await tokenFor("pub@example.com");

    const publish = await app.inject({
      method: "POST",
      url: "/work-items",
      headers: auth(token),
      payload: { title: "Write the doc", priority: 5 },
    });
    expect(publish.statusCode).toBe(201);
    expect(publish.json()).toMatchObject({ title: "Write the doc", state: "open", priority: 5 });

    const list = await app.inject({ method: "GET", url: "/work-items", headers: auth(token) });
    expect(list.statusCode).toBe(200);
    const titles = list.json().map((w: { title: string }) => w.title);
    expect(titles).toContain("Write the doc");
  });

  it("claims the next item, then starts and completes it", async () => {
    const token = await tokenFor("worker@example.com");
    await app.inject({
      method: "POST",
      url: "/work-items",
      headers: auth(token),
      payload: { title: "Task", priority: 1 },
    });

    const claim = await app.inject({
      method: "POST",
      url: "/work-items/claim-next",
      headers: auth(token),
    });
    expect(claim.statusCode).toBe(200);
    const claimed = claim.json();
    expect(claimed.state).toBe("claimed");
    expect(claimed.assigneeMemberId).toBeTruthy();

    const start = await app.inject({
      method: "POST",
      url: `/work-items/${claimed.id}/start`,
      headers: auth(token),
    });
    expect(start.statusCode).toBe(200);
    expect(start.json().state).toBe("in_progress");

    const complete = await app.inject({
      method: "POST",
      url: `/work-items/${claimed.id}/complete`,
      headers: auth(token),
    });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().state).toBe("done");
  });

  it("returns 404 from claim-next when the board is empty", async () => {
    const token = await tokenFor("empty@example.com");

    const res = await app.inject({
      method: "POST",
      url: "/work-items/claim-next",
      headers: auth(token),
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "no-work-available" });
  });

  it("forbids a non-assignee from transitioning someone else's item", async () => {
    const owner = await tokenFor("owner@example.com");
    const other = await tokenFor("other@example.com");
    await app.inject({
      method: "POST",
      url: "/work-items",
      headers: auth(owner),
      payload: { title: "Owned" },
    });
    const claim = await app.inject({
      method: "POST",
      url: "/work-items/claim-next",
      headers: auth(owner),
    });
    const id = claim.json().id;

    const start = await app.inject({
      method: "POST",
      url: `/work-items/${id}/start`,
      headers: auth(other),
    });

    expect(start.statusCode).toBe(403);
    expect(start.json()).toEqual({ error: "not-assignee" });
  });

  it("rejects an invalid transition with 409", async () => {
    const token = await tokenFor("bad@example.com");
    await app.inject({
      method: "POST",
      url: "/work-items",
      headers: auth(token),
      payload: { title: "Task" },
    });
    const claim = await app.inject({
      method: "POST",
      url: "/work-items/claim-next",
      headers: auth(token),
    });
    const id = claim.json().id;

    // Completing a claimed-but-not-started item is not a valid transition.
    const complete = await app.inject({
      method: "POST",
      url: `/work-items/${id}/complete`,
      headers: auth(token),
    });

    expect(complete.statusCode).toBe(409);
    expect(complete.json()).toMatchObject({ error: "invalid-transition" });
  });
});
