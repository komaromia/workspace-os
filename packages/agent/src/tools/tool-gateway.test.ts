import { describe, expect, it } from "vitest";
import {
  type ActivityLog,
  type ActivityRecord,
  Member,
  Persona,
  type RecordActivityInput,
  type SecretsBroker,
  SecretNotFoundError,
} from "@workspace-os/core";
import {
  type Tool,
  ToolCredentialError,
  ToolGateway,
  type ToolAuthorizer,
} from "./tool-gateway.js";

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
  async listByActor(id: string) {
    return this.records.filter((r) => r.actorMemberId === id);
  }
  async listByResource(type: string, id: string) {
    return this.records.filter((r) => r.resourceType === type && r.resourceId === id);
  }
}

class FakeSecretsBroker implements SecretsBroker {
  constructor(private readonly secrets: Record<string, string>) {}
  async get(name: string): Promise<string> {
    const v = this.secrets[name];
    if (v === undefined) throw new SecretNotFoundError(name);
    return v;
  }
  async tryGet(name: string): Promise<string | null> {
    return this.secrets[name] ?? null;
  }
}

// Authorizer: routine tool actions allow, "tool.transfer" needs approval,
// "tool.forbidden" is denied. PolicyEngine satisfies this shape structurally.
const authorizer: ToolAuthorizer = {
  authorize(_member, actionName) {
    if (actionName === "tool.transfer") {
      return { outcome: "requires_approval", reason: "consequential-requires-approval" };
    }
    if (actionName === "tool.forbidden") {
      return { outcome: "deny", reason: "insufficient-role" };
    }
    return { outcome: "allow", reason: "routine-allowed" };
  },
};

const SECRET = "sk-super-secret-value";

const agent = Member.create({
  id: "m_agent",
  type: "agent",
  identityRef: "cred|a",
  displayName: "Bot",
  roles: ["data-analyst"],
});

const persona = Persona.create({
  personaId: "p",
  name: "Analyst",
  role: "data-analyst",
  systemPrompt: "x",
  allowedTools: ["analytics.query", "money.transfer"],
  model: { modelId: "m" },
});

describe("ToolGateway", () => {
  function setup(tools: Tool[]) {
    const activity = new InMemoryActivityLog();
    const secrets = new FakeSecretsBroker({ ANALYTICS_KEY: SECRET });
    const gateway = new ToolGateway({ tools, authorizer, secrets, activity });
    return { gateway, activity };
  }

  it("brokers the secret to the tool without leaking it into the result or the audit log", async () => {
    let received: string | undefined;
    const tool: Tool = {
      name: "analytics.query",
      requiredSecrets: ["ANALYTICS_KEY"],
      async invoke(_input, ctx) {
        received = ctx.credentials.ANALYTICS_KEY; // tool sees the secret
        return { output: "3 rows" }; // but never returns it
      },
    };
    const { gateway, activity } = setup([tool]);

    const outcome = await gateway.invoke({
      member: agent,
      persona,
      toolName: "analytics.query",
      input: { sql: "select 1" },
    });

    expect(outcome.status).toBe("invoked");
    expect(outcome.result).toEqual({ output: "3 rows" });
    expect(received).toBe(SECRET);

    // The secret appears nowhere in the outcome or the audit trail.
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
    expect(JSON.stringify(activity.records)).not.toContain(SECRET);

    // The call is audited, attributed to the agent.
    const rec = activity.records.find((r) => r.action === "tool.invoke");
    expect(rec).toBeDefined();
    expect(rec!.actorMemberId).toBe("m_agent");
    expect(rec!.resourceId).toBe("analytics.query");
  });

  it("refuses a tool not in the persona's allowlist (deny-by-default), without invoking it", async () => {
    let invoked = false;
    const tool: Tool = {
      name: "secrets.dump",
      async invoke() {
        invoked = true;
        return { output: "x" };
      },
    };
    const { gateway, activity } = setup([tool]);

    const outcome = await gateway.invoke({
      member: agent,
      persona,
      toolName: "secrets.dump",
      input: {},
    });

    expect(outcome.status).toBe("denied");
    expect(invoked).toBe(false);
    expect(activity.records[0]!.action).toBe("tool.denied");
  });

  it("refuses an unknown tool even if the persona lists it", async () => {
    const { gateway } = setup([]);

    const outcome = await gateway.invoke({
      member: agent,
      persona,
      toolName: "analytics.query",
      input: {},
    });

    expect(outcome.status).toBe("denied");
    expect(outcome.reason).toBe("unknown-tool");
  });

  it("routes a consequential tool call to approval instead of executing it", async () => {
    let invoked = false;
    const tool: Tool = {
      name: "money.transfer",
      action: "tool.transfer",
      async invoke() {
        invoked = true;
        return { output: "sent" };
      },
    };
    const { gateway, activity } = setup([tool]);

    const outcome = await gateway.invoke({
      member: agent,
      persona,
      toolName: "money.transfer",
      input: { amount: 100 },
    });

    expect(outcome.status).toBe("requires_approval");
    expect(invoked).toBe(false);
    expect(activity.records[0]!.action).toBe("tool.proposed");
  });

  it("denies a tool the policy refuses, without invoking it", async () => {
    let invoked = false;
    const tool: Tool = {
      name: "analytics.query",
      action: "tool.forbidden",
      async invoke() {
        invoked = true;
        return { output: "x" };
      },
    };
    const { gateway } = setup([tool]);

    const outcome = await gateway.invoke({
      member: agent,
      persona,
      toolName: "analytics.query",
      input: {},
    });

    expect(outcome.status).toBe("denied");
    expect(invoked).toBe(false);
  });

  it("errors clearly when a required secret is missing", async () => {
    const tool: Tool = {
      name: "analytics.query",
      requiredSecrets: ["MISSING_KEY"],
      async invoke() {
        return { output: "x" };
      },
    };
    const { gateway } = setup([tool]);

    await expect(
      gateway.invoke({ member: agent, persona, toolName: "analytics.query", input: {} }),
    ).rejects.toThrow(ToolCredentialError);
  });
});
