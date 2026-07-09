import { describe, expect, it, vi } from "vitest";
import { Member, Persona } from "@workspace-os/core";
import { McpTool, McpToolError, type McpClientLike } from "./mcp-tool.js";
import { type ActivityLog, type RecordActivityInput } from "@workspace-os/core";
import { ToolGateway, type ToolAuthorizer } from "./tool-gateway.js";

function fakeClient(result: {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}): McpClientLike & { callTool: ReturnType<typeof vi.fn> } {
  return { callTool: vi.fn().mockResolvedValue(result) };
}

describe("McpTool", () => {
  it("forwards the input as arguments under the server tool name and maps text output", async () => {
    const client = fakeClient({ content: [{ type: "text", text: "42 results" }] });
    const tool = new McpTool(client, { name: "marketing.search", serverToolName: "search" });

    const result = await tool.invoke({ query: "shoes" }, { credentials: {} });

    expect(result).toEqual({ output: "42 results" });
    expect(client.callTool).toHaveBeenCalledWith({
      name: "search",
      arguments: { query: "shoes" },
    });
  });

  it("throws McpToolError when the MCP call returns an error result", async () => {
    const client = fakeClient({ content: [{ type: "text", text: "boom" }], isError: true });
    const tool = new McpTool(client, { name: "marketing.search", serverToolName: "search" });

    await expect(tool.invoke({}, { credentials: {} })).rejects.toThrow(McpToolError);
  });

  it("exposes action and requiredSecrets for the gateway to authorize and broker", () => {
    const tool = new McpTool(fakeClient({ content: [] }), {
      name: "marketing.search",
      serverToolName: "search",
      action: "tool.marketing_search",
      requiredSecrets: ["MARKETING_API_KEY"],
    });

    expect(tool.name).toBe("marketing.search");
    expect(tool.action).toBe("tool.marketing_search");
    expect(tool.requiredSecrets).toEqual(["MARKETING_API_KEY"]);
  });

  it("plugs into the ToolGateway end to end", async () => {
    const client = fakeClient({ content: [{ type: "text", text: "done" }] });
    const tool = new McpTool(client, { name: "analytics.query", serverToolName: "query" });

    const activity: ActivityLog = {
      async record(input: RecordActivityInput) {
        return {
          id: "a1",
          actorMemberId: input.actor.id,
          actorType: input.actor.type,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          metadata: input.metadata ?? {},
          occurredAt: new Date(0),
        };
      },
      async listByActor() {
        return [];
      },
      async listByResource() {
        return [];
      },
    };
    const authorizer: ToolAuthorizer = {
      authorize: () => ({ outcome: "allow", reason: "routine-allowed" }),
    };
    const gateway = new ToolGateway({
      tools: [tool],
      authorizer,
      secrets: {
        async get() {
          return "";
        },
        async tryGet() {
          return null;
        },
      },
      activity,
    });

    const member = Member.create({
      id: "m",
      type: "agent",
      identityRef: "c",
      displayName: "Bot",
      roles: [],
    });
    const persona = Persona.create({
      personaId: "p",
      name: "n",
      role: "r",
      systemPrompt: "s",
      allowedTools: ["analytics.query"],
      model: { modelId: "m" },
    });

    const outcome = await gateway.invoke({
      member,
      persona,
      toolName: "analytics.query",
      input: { sql: "select 1" },
    });

    expect(outcome.status).toBe("invoked");
    expect(outcome.result).toEqual({ output: "done" });
  });
});
