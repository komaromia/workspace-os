import type { FastifyRequest } from "fastify";
import type { Member, MemberRepository } from "@workspace-os/core";
import type { SessionTokenService } from "./session-token.js";

export interface AuthDeps {
  sessions: SessionTokenService;
  members: MemberRepository;
  /** Injectable clock for token verification; defaults to real time. */
  now?: () => Date;
}

/**
 * Resolves the acting Member from a request's Bearer session token, or null
 * if the token is absent, invalid/expired, or points at a member that no
 * longer exists. Shared by every authenticated route so attribution and
 * authorization always run against a real principal.
 */
export async function authenticate(
  request: FastifyRequest,
  deps: AuthDeps,
): Promise<Member | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const now = (deps.now ?? (() => new Date()))();
  const claims = deps.sessions.verify(token, now);
  if (!claims) return null;
  return deps.members.findById(claims.memberId);
}

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token === "" ? null : token;
}
