import { describe, expect, it } from "vitest";
import {
  type ActivityLog,
  type ActivityRecord,
  Member,
  Persona,
  type RecordActivityInput,
  WorkItem,
} from "@workspace-os/core";
import { FakeModelProvider } from "../model/fake-model-provider.js";
import { ModelGateway } from "../model/model-gateway.js";
import { AgentRunner, type AgentTaskBoard } from "./agent-runner.js";

class InMemoryBoard implements AgentTaskBoard {
  private items: WorkItem[];
  constructor(items: WorkItem[]) {
    this.items = items;
  }
  async claimNext(agent: Member): Promise<WorkItem | null> {
    const idx = this.items.findIndex((i) => i.canBeClaimedBy(agent));
    if (idx === -1) return null;
    const claimed = this.items[idx]!.claimBy(agent);
    this.items[idx] = claimed;
    return claimed;
  }
  async save(item: WorkItem): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === item.id);
    if (idx !== -1) this.items[idx] = item;
  }
  find(id: string): WorkItem | undefined {
    return this.items.find((i) => i.id === id);
  }
}

class InMemoryActivityLog implements ActivityLog {
  public readonly records: ActivityRecord[] = [];
  private seq = 0;
  async record(input: RecordActivityInput): Promise<ActivityRecord> {
    const rec: ActivityRecord = {
      id: `a_${++this.seq}`,
      actorMemberId: input.actor.id,
      actorType: input.actor.type,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata ?? {},
      occurredAt: new Date(0),
    };
    this.records.push(rec);
    return rec;
  }
  async listByActor(actorMemberId: string): Promise<ActivityRecord[]> {
    return this.records.filter((r) => r.actorMemberId === actorMemberId);
  }
  async listByResource(resourceType: string, resourceId: string): Promise<ActivityRecord[]> {
    return this.records.filter(
      (r) => r.resourceType === resourceType && r.resourceId === resourceId,
    );
  }
}

function makeGateway(response: string) {
  return new ModelGateway({
    providers: { local: { provider: new FakeModelProvider({ response }), external: false } },
    routing: { reasoning: { providerName: "local", model: "fake-1" } },
  });
}

const agent = Member.create({
  id: "m_agent",
  type: "agent",
  identityRef: "cred|a",
  displayName: "Analyst",
  roles: ["data-analyst"],
});

const persona = Persona.create({
  personaId: "p_analyst",
  name: "Analyst",
  role: "data-analyst",
  systemPrompt: "You analyze the work item and summarize it.",
  allowedTools: [],
  model: { modelId: "fake-1" },
});

describe("AgentRunner", () => {
  it("claims a work item, reasons with the model, completes it, and reports (perceive→reason→act→report)", async () => {
    const board = new InMemoryBoard([
      WorkItem.create({ id: "w_1", title: "Analyze sales", priority: 5 }),
    ]);
    const activity = new InMemoryActivityLog();
    const runner = new AgentRunner({
      agent,
      persona,
      board,
      gateway: makeGateway("analysis complete"),
      activity,
    });

    const result = await runner.runOnce();

    expect(result.status).toBe("completed");
    expect(result.workItemId).toBe("w_1");
    expect(result.output).toBe("analysis complete");

    // The item finished the lifecycle and is attributed to the agent.
    const done = board.find("w_1")!;
    expect(done.state).toBe("done");
    expect(done.assigneeMemberId).toBe("m_agent");

    // Both claim and completion are recorded, attributed to the agent.
    const actions = activity.records.map((r) => r.action);
    expect(actions).toContain("work.claim");
    expect(actions).toContain("work.complete");
    expect(activity.records.every((r) => r.actorMemberId === "m_agent")).toBe(true);
  });

  it("reports idle when there is no claimable work, recording nothing", async () => {
    const board = new InMemoryBoard([]);
    const activity = new InMemoryActivityLog();
    const runner = new AgentRunner({ agent, persona, board, gateway: makeGateway("x"), activity });

    const result = await runner.runOnce();

    expect(result.status).toBe("idle");
    expect(result.workItemId).toBeUndefined();
    expect(activity.records).toHaveLength(0);
  });

  it("meters the model usage against the acting agent", async () => {
    const board = new InMemoryBoard([WorkItem.create({ id: "w_1", title: "Task", priority: 1 })]);
    const gateway = makeGateway("ok");
    const runner = new AgentRunner({
      agent,
      persona,
      board,
      gateway,
      activity: new InMemoryActivityLog(),
    });

    await runner.runOnce();

    expect(gateway.usageFor("m_agent").totalTokens).toBeGreaterThan(0);
  });

  it("does not claim work the agent is ineligible for (role-gated)", async () => {
    const board = new InMemoryBoard([
      WorkItem.create({ id: "w_eng", title: "Eng only", priority: 9, requiredRole: "engineer" }),
    ]);
    const runner = new AgentRunner({
      agent,
      persona,
      board,
      gateway: makeGateway("x"),
      activity: new InMemoryActivityLog(),
    });

    const result = await runner.runOnce();

    expect(result.status).toBe("idle");
    expect(board.find("w_eng")!.state).toBe("open");
  });
});
