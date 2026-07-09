import type { Tool, ToolInvocationContext, ToolResult } from "./tool-gateway.js";

export interface McpCallToolParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface McpCallToolResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/**
 * The slice of an MCP client this adapter uses. The `@modelcontextprotocol/sdk`
 * `Client` satisfies it structurally (`client.callTool({ name, arguments })`),
 * so a real stdio/SSE transport plugs in without changing this file — and tests
 * inject a fake, no live MCP server required.
 */
export interface McpClientLike {
  callTool(params: McpCallToolParams): Promise<McpCallToolResult>;
}

export interface McpToolOptions {
  /** The tool name as exposed on this workspace's board (persona allowlist). */
  name: string;
  /** The tool name as the MCP server knows it. */
  serverToolName: string;
  action?: string;
  requiredSecrets?: string[];
}

export class McpToolError extends Error {
  constructor(
    public readonly toolName: string,
    message: string,
  ) {
    super(`MCP tool ${toolName} failed: ${message}`);
    this.name = "McpToolError";
  }
}

/**
 * Adapts an MCP server tool to the workspace's Tool interface so it flows
 * through the ToolGateway (persona allowlist, per-call authorization,
 * credential brokering, audit — Epic 9). This adapter owns only the transport
 * mapping; the credential/authorization guarantees live in the gateway.
 */
export class McpTool implements Tool {
  readonly name: string;
  readonly action?: string;
  readonly requiredSecrets?: string[];

  constructor(
    private readonly client: McpClientLike,
    options: McpToolOptions,
  ) {
    this.name = options.name;
    this.action = options.action;
    this.requiredSecrets = options.requiredSecrets;
    this.serverToolName = options.serverToolName;
  }

  private readonly serverToolName: string;

  async invoke(input: unknown, _context: ToolInvocationContext): Promise<ToolResult> {
    const result = await this.client.callTool({
      name: this.serverToolName,
      arguments: isRecord(input) ? input : {},
    });
    const text = result.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");
    if (result.isError) {
      throw new McpToolError(this.name, text || "unknown error");
    }
    return { output: text };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
