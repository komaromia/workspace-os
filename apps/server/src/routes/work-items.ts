import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type ActivityLog,
  type Member,
  WorkItem,
  WorkItemTransitionError,
} from "@workspace-os/core";
import type { DrizzleWorkItemRepository } from "@workspace-os/adapters";
import { authenticate, type AuthDeps } from "../auth/require-member.js";

export interface WorkItemRouteDeps extends AuthDeps {
  workItems: DrizzleWorkItemRepository;
  activity: ActivityLog;
}

interface PublishBody {
  title?: unknown;
  description?: unknown;
  priority?: unknown;
  requiredRole?: unknown;
}

export function registerWorkItemRoutes(app: FastifyInstance, deps: WorkItemRouteDeps): void {
  const authDeps: AuthDeps = { sessions: deps.sessions, members: deps.members, now: deps.now };

  async function currentMember(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<Member | null> {
    const member = await authenticate(request, authDeps);
    if (!member) {
      reply.code(401).send({ error: "unauthenticated" });
      return null;
    }
    return member;
  }

  app.post("/work-items", async (request, reply) => {
    const member = await currentMember(request, reply);
    if (!member) return reply;

    const body = (request.body ?? {}) as PublishBody;
    if (typeof body.title !== "string" || body.title.trim() === "") {
      return reply.code(400).send({ error: "invalid-work-item", message: "title is required" });
    }
    const item = WorkItem.create({
      id: `w_${randomUUID()}`,
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      priority: Number.isInteger(body.priority) ? (body.priority as number) : 0,
      requiredRole: typeof body.requiredRole === "string" ? body.requiredRole : null,
    });
    await deps.workItems.save(item);
    await deps.activity.record({
      actor: member,
      action: "work.publish",
      resourceType: "work_item",
      resourceId: item.id,
    });
    return reply.code(201).send(item.toJSON());
  });

  app.get("/work-items", async (request, reply) => {
    const member = await currentMember(request, reply);
    if (!member) return reply;
    const open = await deps.workItems.listOpen();
    return open.map((item) => item.toJSON());
  });

  app.post("/work-items/claim-next", async (request, reply) => {
    const member = await currentMember(request, reply);
    if (!member) return reply;

    const claimed = await deps.workItems.claimNext(member);
    if (!claimed) {
      return reply.code(404).send({ error: "no-work-available" });
    }
    await deps.activity.record({
      actor: member,
      action: "work.claim",
      resourceType: "work_item",
      resourceId: claimed.id,
    });
    return reply.code(200).send(claimed.toJSON());
  });

  app.post<{ Params: { id: string } }>("/work-items/:id/start", (request, reply) =>
    transition(request, reply, "start", (item) => item.start()),
  );

  app.post<{ Params: { id: string } }>("/work-items/:id/complete", (request, reply) =>
    transition(request, reply, "complete", (item) => item.complete()),
  );

  async function transition(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    action: string,
    apply: (item: WorkItem) => WorkItem,
  ): Promise<unknown> {
    const member = await currentMember(request, reply);
    if (!member) return reply;

    const item = await deps.workItems.findById(request.params.id);
    if (!item) return reply.code(404).send({ error: "not-found" });
    if (item.assigneeMemberId !== member.id) {
      return reply.code(403).send({ error: "not-assignee" });
    }
    let next: WorkItem;
    try {
      next = apply(item);
    } catch (err) {
      if (err instanceof WorkItemTransitionError) {
        return reply.code(409).send({ error: "invalid-transition", message: err.message });
      }
      throw err;
    }
    await deps.workItems.save(next);
    await deps.activity.record({
      actor: member,
      action: `work.${action}`,
      resourceType: "work_item",
      resourceId: next.id,
    });
    return reply.code(200).send(next.toJSON());
  }
}
