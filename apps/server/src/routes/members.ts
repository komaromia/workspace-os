import type { FastifyInstance } from "fastify";
import { InvalidMemberError, Member, type MemberRepository } from "@workspace-os/core";

export interface MemberRouteDeps {
  members: MemberRepository;
}

interface CreateMemberBody {
  id?: unknown;
  type?: unknown;
  identityRef?: unknown;
  displayName?: unknown;
  roles?: unknown;
}

export function registerMemberRoutes(app: FastifyInstance, deps: MemberRouteDeps): void {
  app.post("/members", async (request, reply) => {
    const body = (request.body ?? {}) as CreateMemberBody;
    let member: Member;
    try {
      member = Member.create({
        id: String(body.id),
        type: body.type as Member["type"],
        identityRef: String(body.identityRef),
        displayName: String(body.displayName),
        roles: Array.isArray(body.roles) ? (body.roles as string[]) : [],
      });
    } catch (err) {
      if (err instanceof InvalidMemberError) {
        return reply.code(400).send({ error: "invalid-member", message: err.message });
      }
      throw err;
    }
    await deps.members.save(member);
    return reply.code(201).send(member.toJSON());
  });

  app.get<{ Params: { id: string } }>("/members/:id", async (request, reply) => {
    const member = await deps.members.findById(request.params.id);
    if (!member) {
      return reply.code(404).send({ error: "not-found" });
    }
    return member.toJSON();
  });
}
