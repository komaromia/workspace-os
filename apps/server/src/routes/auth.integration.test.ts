import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defaultConnectionString, runMigrations } from "@workspace-os/adapters";
import { buildServer } from "../build-server.js";

describe("auth routes (requires local docker Postgres)", () => {
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

  async function signup(email: string, password: string, displayName = "User") {
    return app.inject({
      method: "POST",
      url: "/signup",
      payload: { email, password, displayName },
    });
  }

  it("signs up a new human member and returns it (201)", async () => {
    const res = await signup("ada@example.com", "s3cret-password", "Ada");

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toMatchObject({ type: "human", displayName: "Ada" });
    expect(body.identityRef).toBe("local|ada@example.com");
    // The response never echoes the password or its hash.
    expect(JSON.stringify(body)).not.toContain("s3cret-password");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("rejects a duplicate email with 409", async () => {
    await signup("dup@example.com", "pw-one-two", "First");
    const res = await signup("dup@example.com", "pw-three-four", "Second");

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "email-taken" });
  });

  it("normalizes the email so casing/whitespace does not create duplicates", async () => {
    await signup("Case@Example.com", "pw-one-two", "First");
    const res = await signup("  case@example.com  ", "pw-three-four", "Second");

    expect(res.statusCode).toBe(409);
  });

  it("returns 400 when required fields are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/signup",
      payload: { email: "x@example.com" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("logs in with correct credentials, returning the member and a session token", async () => {
    await signup("login@example.com", "correct-password", "Login User");

    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: "login@example.com", password: "correct-password" },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.member).toMatchObject({ displayName: "Login User", type: "human" });
    expect(typeof body.token).toBe("string");
    expect(body.token.length).toBeGreaterThan(0);
  });

  it("accepts the session token from login on GET /me", async () => {
    await signup("me@example.com", "correct-password", "Me User");
    const login = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: "me@example.com", password: "correct-password" },
    });
    const { token } = login.json();

    const me = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({
      displayName: "Me User",
      identityRef: "local|me@example.com",
    });
  });

  it("rejects GET /me without a token (401)", async () => {
    const res = await app.inject({ method: "GET", url: "/me" });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "unauthenticated" });
  });

  it("rejects GET /me with a garbage token (401)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("rejects login with a wrong password (401)", async () => {
    await signup("wrongpw@example.com", "correct-password", "User");

    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: "wrongpw@example.com", password: "not-it" },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid-credentials" });
  });

  it("rejects login for an unknown email (401)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/login",
      payload: { email: "ghost@example.com", password: "whatever" },
    });

    expect(res.statusCode).toBe(401);
  });
});
