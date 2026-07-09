import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Member, Persona, WorkItem } from "@workspace-os/core";
import {
  createDb,
  defaultConnectionString,
  DrizzleActivityLog,
  DrizzleMemberRepository,
  DrizzleWorkItemRepository,
  runMigrations,
} from "@workspace-os/adapters";
import { AgentRunner, FakeModelProvider, ModelGateway } from "@workspace-os/agent";

/**
 * The capstone: the owned agent loop driving the real Postgres-backed board
 * and audit trail. DrizzleWorkItemRepository satisfies the AgentTaskBoard
 * interface structurally, so no glue is needed — the agent claims a real work
 * item via FOR UPDATE SKIP LOCKED, reasons through the gateway (a deterministic
 * fake, so no API key/network), completes the item, and the whole thing is
 * attributed in the activities table.
 */
describe("AgentRunner against real Postgres (requires local docker Postgres)", () => {
  const connectionString = defaultConnectionString();
  const { db, pool } = createDb(connectionString);
  const members = new DrizzleMemberRepository(db);
  const workItems = new DrizzleWorkItemRepository(db);
  const activity = new DrizzleActivityLog(db);

  const agent = Member.create({
    id: "m_agent_runtime",
    type: "agent",
    identityRef: "cred|runtime",
    displayName: "Runtime Analyst",
    roles: ["data-analyst"],
  });

  const persona = Persona.create({
    personaId: "p_runtime",
    name: "Runtime Analyst",
    role: "data-analyst",
    systemPrompt: "Analyze the work item and summarize.",
    allowedTools: [],
    model: { modelId: "fake-1" },
  });

  function gateway() {
    return new ModelGateway({
      providers: {
        local: { provider: new FakeModelProvider({ response: "analysis done" }), external: false },
      },
      routing: { reasoning: { providerName: "local", model: "fake-1" } },
    });
  }

  beforeEach(async () => {
    await runMigrations(connectionString);
    await pool.query("truncate table members restart identity cascade");
    await members.save(agent);
  });

  afterAll(async () => {
    await pool.end();
  });

  it("claims a real DB work item, completes it, and records an audit trail", async () => {
    await workItems.save(WorkItem.create({ id: "w_runtime_1", title: "Analyze Q4", priority: 5 }));

    const runner = new AgentRunner({
      agent,
      persona,
      board: workItems,
      gateway: gateway(),
      activity,
    });
    const result = await runner.runOnce();

    expect(result.status).toBe("completed");
    expect(result.workItemId).toBe("w_runtime_1");
    expect(result.output).toBe("analysis done");

    // The item's state is persisted as done, assigned to the agent.
    const reloaded = await workItems.findById("w_runtime_1");
    expect(reloaded!.state).toBe("done");
    expect(reloaded!.assigneeMemberId).toBe("m_agent_runtime");

    // The audit trail in Postgres shows both claim and completion by the agent.
    const trail = await activity.listByResource("work_item", "w_runtime_1");
    const actions = trail.map((r) => r.action);
    expect(actions).toContain("work.claim");
    expect(actions).toContain("work.complete");
    expect(trail.every((r) => r.actorMemberId === "m_agent_runtime")).toBe(true);
  });

  it("reports idle and records nothing when the board is empty", async () => {
    const runner = new AgentRunner({
      agent,
      persona,
      board: workItems,
      gateway: gateway(),
      activity,
    });

    const result = await runner.runOnce();

    expect(result.status).toBe("idle");
    await expect(activity.listByActor("m_agent_runtime")).resolves.toHaveLength(0);
  });

  it("two agents draining the board never complete the same item twice", async () => {
    const second = Member.create({
      id: "m_agent_runtime_2",
      type: "agent",
      identityRef: "cred|runtime2",
      displayName: "Runtime Analyst 2",
      roles: ["data-analyst"],
    });
    await members.save(second);
    for (let i = 0; i < 6; i++) {
      await workItems.save(WorkItem.create({ id: `w_r_${i}`, title: `Item ${i}`, priority: i }));
    }

    const runnerA = new AgentRunner({
      agent,
      persona,
      board: workItems,
      gateway: gateway(),
      activity,
    });
    const runnerB = new AgentRunner({
      agent: second,
      persona,
      board: workItems,
      gateway: gateway(),
      activity,
    });

    const completed = new Set<string>();
    for (let round = 0; round < 6; round++) {
      const [a, b] = await Promise.all([runnerA.runOnce(), runnerB.runOnce()]);
      for (const r of [a, b]) {
        if (r.status === "completed") {
          expect(completed.has(r.workItemId!)).toBe(false);
          completed.add(r.workItemId!);
        }
      }
    }

    expect(completed.size).toBe(6);
  });
});
