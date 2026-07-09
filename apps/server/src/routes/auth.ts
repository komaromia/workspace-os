import type { FastifyInstance } from "fastify";
import { EmailAlreadyRegisteredError, type MemberRepository } from "@workspace-os/core";
import { authenticate } from "../auth/require-member.js";
import type { SignupService } from "../auth/signup-service.js";
import type { SessionTokenService } from "../auth/session-token.js";

/** Session lifetime for a browser login (simple profile): one hour. */
export const SESSION_TTL_MS = 60 * 60 * 1000;

export interface AuthRouteDeps {
  signup: SignupService;
  sessions: SessionTokenService;
  members: MemberRepository;
  /** Injectable clock so token issue/expiry is testable. Defaults to real time. */
  now?: () => Date;
}

interface SignupBody {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
}

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const now = deps.now ?? (() => new Date());

  app.post("/signup", async (request, reply) => {
    const body = (request.body ?? {}) as SignupBody;
    if (
      !isNonEmptyString(body.email) ||
      !isNonEmptyString(body.password) ||
      !isNonEmptyString(body.displayName)
    ) {
      return reply.code(400).send({
        error: "invalid-signup",
        message: "email, password, and displayName are required",
      });
    }
    try {
      const member = await deps.signup.signup({
        email: body.email,
        password: body.password,
        displayName: body.displayName,
      });
      return reply.code(201).send(member.toJSON());
    } catch (err) {
      if (err instanceof EmailAlreadyRegisteredError) {
        return reply.code(409).send({ error: "email-taken" });
      }
      throw err;
    }
  });

  app.post("/login", async (request, reply) => {
    const body = (request.body ?? {}) as LoginBody;
    if (!isNonEmptyString(body.email) || !isNonEmptyString(body.password)) {
      return reply.code(400).send({ error: "invalid-login" });
    }
    const member = await deps.signup.authenticate(body.email, body.password);
    if (!member) {
      return reply.code(401).send({ error: "invalid-credentials" });
    }
    const token = deps.sessions.issue(member.id, new Date(now().getTime() + SESSION_TTL_MS));
    return reply.code(200).send({ member: member.toJSON(), token });
  });

  app.get("/me", async (request, reply) => {
    const member = await authenticate(request, {
      sessions: deps.sessions,
      members: deps.members,
      now,
    });
    if (!member) {
      return reply.code(401).send({ error: "unauthenticated" });
    }
    return member.toJSON();
  });
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}
